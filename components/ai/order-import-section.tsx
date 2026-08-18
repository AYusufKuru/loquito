"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedOrderDraft, ParsedOrderLine } from "@/lib/ocr/types";
import { ORDER_CHANNELS } from "@/lib/orders/constants";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface SampleMeta {
  id: string;
  fileName: string;
  channel: string;
  label: string;
}

interface OrderImportSectionProps {
  customers: Array<{ id: string; name: string }>;
  canCreate: boolean;
  labels: Record<string, string>;
}

export function OrderImportSection({
  customers,
  canCreate,
  labels,
}: OrderImportSectionProps) {
  const [samples, setSamples] = useState<SampleMeta[]>([]);
  const [draft, setDraft] = useState<ParsedOrderDraft | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [storedPath, setStoredPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [channel, setChannel] = useState("retail_form");
  const [pasteText, setPasteText] = useState("");

  const loadSamples = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/order-import/samples");
      const data = await res.json();
      if (res.ok) setSamples(data.samples);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  function applyDraft(next: ParsedOrderDraft) {
    setDraft(next);
    setCustomerId(next.customerId ?? "");
    setChannel(next.channel);
  }

  async function loadSample(sampleId: string) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/ai/order-import/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.loadError);
        return;
      }
      applyDraft(data.draft);
      setImportId(null);
      setPreviewUrl(null);
      setFileName(data.fileName);
      setFileType(data.fileType);
      setStoredPath(null);
      setPasteText(data.draft.rawTextPreview);
      setMessage(labels.sampleLoaded);
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file: File) {
    if (!canCreate) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      if (channel) form.append("channel", channel);
      if (customerId) form.append("customerId", customerId);

      const res = await fetch("/api/ai/order-import/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.parseError);
        return;
      }
      applyDraft(data.draft);
      setImportId(data.importId);
      setPreviewUrl(data.previewUrl);
      setFileName(data.fileName);
      setFileType(data.fileType);
      setStoredPath(data.storedPath);
      setMessage(labels.parsed);
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function parseText() {
    if (!canCreate || !pasteText.trim()) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/ai/order-import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: pasteText,
          channel,
          customerId: customerId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.parseError);
        return;
      }
      applyDraft(data.draft);
      setMessage(labels.parsed);
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  function updateLine(index: number, patch: Partial<ParsedOrderLine>) {
    if (!draft) return;
    const lines = draft.lines.map((line) =>
      line.lineIndex === index ? { ...line, ...patch } : line,
    );
    setDraft({ ...draft, lines });
  }

  async function confirmOrder() {
    if (!canCreate || !draft) return;
    if (!customerId) {
      setError(labels.customerRequired);
      return;
    }

    const unresolved = draft.lines.filter((l) => !l.skuResolved || !l.productId);
    if (unresolved.length > 0) {
      setError(labels.skuUnresolved);
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/ai/order-import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          channel: draft.channel,
          orderNo: draft.referenceNo,
          referenceNo: draft.referenceNo,
          orderDate: draft.orderDate,
          deliveryDate: draft.deliveryDate,
          paymentTerms: draft.paymentTerms,
          freightType: draft.freightType,
          freightCents: draft.freightCents,
          notes: draft.notes,
          status: "draft",
          importId,
          storedPath,
          fileName,
          fileType,
          lines: draft.lines.map((l) => ({
            productId: l.productId,
            quantityBoxes: l.quantityBoxes,
            quantityUnits: l.quantityUnits,
            unitPriceCents: l.unitPriceCents,
            boxPriceCents: l.boxPriceCents,
            discountPercent: l.discountPercent,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || labels.confirmError);
        return;
      }
      setMessage(`${labels.orderCreated}: ${data.order.orderNo}`);
    } catch {
      setError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  const isPdfPreview =
    previewUrl && (fileType?.includes("pdf") || fileName?.toLowerCase().endsWith(".pdf"));
  const isTextPreview =
    !isPdfPreview &&
    (fileType?.includes("text") || fileName?.toLowerCase().endsWith(".txt"));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{labels.uploadTitle}</CardTitle>
          <CardDescription>{labels.uploadDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {samples.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => loadSample(s.id)}
              >
                {s.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{labels.channel}</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                {ORDER_CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {labels[`channel_${c.value}`] ?? c.value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{labels.customer}</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">{labels.selectCustomer}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {canCreate && (
            <div>
              <Label>{labels.fileUpload}</Label>
              <Input
                type="file"
                accept=".pdf,.txt,.png,.jpg,.jpeg"
                disabled={loading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                }}
              />
            </div>
          )}

          <div>
            <Label>{labels.pasteText}</Label>
            <textarea
              className="mt-1 flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={labels.pastePlaceholder}
            />
            {canCreate && (
              <Button
                type="button"
                className="mt-2"
                variant="secondary"
                disabled={loading || !pasteText.trim()}
                onClick={parseText}
              >
                {labels.parseText}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {message && (
        <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {draft && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{labels.previewTitle}</CardTitle>
              <CardDescription>
                {fileName ?? labels.textPreview}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isPdfPreview && previewUrl ? (
                <iframe
                  src={previewUrl}
                  title={labels.previewTitle}
                  className="h-[480px] w-full rounded border"
                />
              ) : isTextPreview && pasteText ? (
                <pre className="max-h-[480px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                  {pasteText}
                </pre>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  title={labels.previewTitle}
                  className="h-[480px] w-full rounded border"
                />
              ) : (
                <pre className="max-h-[480px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                  {draft.rawTextPreview}
                </pre>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{labels.validationTitle}</CardTitle>
              <CardDescription>{labels.validationDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge>{draft.channelLabel}</Badge>
                <Badge variant="outline">
                  {draft.quantityMode === "box"
                    ? labels.quantityModeBox
                    : labels.quantityModeUnit}
                </Badge>
              </div>

              {draft.parseWarnings.length > 0 && (
                <ul className="text-sm text-amber-600 dark:text-amber-400 space-y-1">
                  {draft.parseWarnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              )}

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">{labels.reference}</span>
                  <p>{draft.referenceNo ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{labels.detectedCustomer}</span>
                  <p>{draft.customerName ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{labels.paymentTerms}</span>
                  <p>{draft.paymentTerms ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{labels.total}</span>
                  <p className="font-semibold">
                    {formatBrlFromCents(draft.totalCents)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-2">{labels.sku}</th>
                      <th className="pb-2 pr-2">{labels.internalSku}</th>
                      <th className="pb-2 pr-2">
                        {draft.quantityMode === "box"
                          ? labels.boxes
                          : labels.units}
                      </th>
                      <th className="pb-2 pr-2">{labels.unitPrice}</th>
                      <th className="pb-2">{labels.lineTotal}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.lines.map((line) => (
                      <tr
                        key={line.lineIndex}
                        className="border-b last:border-0 align-top"
                      >
                        <td className="py-2 pr-2">
                          <span className="font-mono text-xs">
                            {line.externalSku}
                          </span>
                          {!line.skuResolved && (
                            <Badge variant="destructive" className="ml-1">
                              ?
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 pr-2 font-mono text-xs">
                          {line.internalSku ?? "—"}
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            type="number"
                            className="h-8 w-20"
                            value={
                              draft.quantityMode === "box"
                                ? line.quantityBoxes
                                : line.quantityUnits
                            }
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              if (draft.quantityMode === "box") {
                                updateLine(line.lineIndex, {
                                  quantityBoxes: v,
                                  quantityInput: v,
                                });
                              } else {
                                updateLine(line.lineIndex, {
                                  quantityUnits: v,
                                  quantityInput: v,
                                });
                              }
                            }}
                          />
                          {line.unitsPerBox && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {line.quantityUnits} {labels.unitsShort}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {formatBrlFromCents(line.unitPriceCents)}
                        </td>
                        <td className="py-2">
                          {formatBrlFromCents(line.lineTotalCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canCreate && (
                <Button
                  type="button"
                  disabled={loading}
                  onClick={confirmOrder}
                >
                  {labels.confirmOrder}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
