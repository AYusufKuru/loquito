import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";

import {
  getStorageBucket,
  getSupabaseAdmin,
  isSupabaseStorageEnabled,
} from "@/lib/files/supabase";

const STORAGE_ROOT = path.resolve(
  process.cwd(),
  process.env.STORAGE_PATH?.trim() || "storage",
);

/** En büyük yükleme boyutu (bayt). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const ALLOWED_UPLOAD_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".txt",
  ".csv",
  ".ofx",
] as const;

export class UploadValidationError extends Error {}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "_");
}

/** `subdir` içindeki her parçayı temizler; `..` ve mutlak yol kaçışlarını engeller. */
function sanitizeSubdir(subdir: string): string {
  return subdir
    .split(/[\\/]+/)
    .filter((part) => part && part !== "." && part !== "..")
    .map(sanitizeSegment)
    .join("/");
}

export function contentTypeForFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (lower.endsWith(".ofx")) return "application/x-ofx";
  return "application/octet-stream";
}

export function assertAllowedUpload(fileName: string, size: number): void {
  if (size <= 0) {
    throw new UploadValidationError("Dosya boş.");
  }
  if (size > MAX_UPLOAD_BYTES) {
    const mb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    throw new UploadValidationError(`Dosya boyutu ${mb} MB sınırını aşıyor.`);
  }
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext as (typeof ALLOWED_UPLOAD_EXTENSIONS)[number])) {
    throw new UploadValidationError(
      `Desteklenmeyen dosya türü (${ext || "uzantısız"}). İzin verilenler: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}`,
    );
  }
}

export async function saveUploadedFile(
  subdir: string,
  buffer: Buffer,
  originalName: string,
): Promise<{ filePath: string; fileName: string }> {
  const safeSubdir = sanitizeSubdir(subdir);
  const safeName = sanitizeSegment(originalName) || "upload";
  const unique = `${Date.now()}-${safeName}`;
  const storagePath = [safeSubdir, unique].filter(Boolean).join("/");

  if (isSupabaseStorageEnabled()) {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(getStorageBucket())
      .upload(storagePath, buffer, {
        contentType: contentTypeForFileName(originalName),
        upsert: false,
      });

    if (error) {
      throw new UploadValidationError(error.message || "Dosya yüklenemedi.");
    }

    return { filePath: storagePath, fileName: originalName };
  }

  const dir = path.join(STORAGE_ROOT, safeSubdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, unique), buffer);
  return { filePath: storagePath, fileName: originalName };
}

export async function readUploadedFile(filePath: string): Promise<Buffer> {
  if (isSupabaseStorageEnabled()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(getStorageBucket())
      .download(filePath);

    if (error || !data) {
      throw new Error("Dosya okunamadı.");
    }

    return Buffer.from(await data.arrayBuffer());
  }

  const fullPath = resolveStoragePath(filePath);
  return readFile(fullPath);
}

export async function listUploadedFiles(prefix: string): Promise<string[]> {
  const safePrefix = sanitizeSubdir(prefix);

  if (isSupabaseStorageEnabled()) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(getStorageBucket())
      .list(safePrefix);

    if (error || !data) return [];
    return data
      .filter((entry) => entry.name && !entry.name.endsWith("/"))
      .map((entry) => entry.name!);
  }

  const dir = resolveStoragePath(safePrefix);
  return readdir(dir);
}

/**
 * Depolama köküne göre çözer. Sonuç kökün dışına çıkarsa hata fırlatır —
 * `filePath` kullanıcı girdisinden türeyebildiği için path traversal koruması şart.
 */
export function resolveStoragePath(filePath: string): string {
  const full = path.resolve(STORAGE_ROOT, filePath);
  const rootWithSep = STORAGE_ROOT.endsWith(path.sep)
    ? STORAGE_ROOT
    : STORAGE_ROOT + path.sep;
  if (full !== STORAGE_ROOT && !full.startsWith(rootWithSep)) {
    throw new Error("Geçersiz dosya yolu.");
  }
  return full;
}
