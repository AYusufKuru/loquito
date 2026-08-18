import { mkdir, writeFile } from "fs/promises";
import path from "path";

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
  const dir = path.join(STORAGE_ROOT, safeSubdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, unique), buffer);
  return {
    filePath: [safeSubdir, unique].filter(Boolean).join("/"),
    fileName: originalName,
  };
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
