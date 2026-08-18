import { parseBrlAmount } from "@/lib/ocr/field-extract";

/** Loquitos Brasil CNPJ — alıcı tahsilat, gönderen ödeme */
export const LOQUITO_CNPJ = "61.581.495/0001-84";
export const LOQUITO_CNPJ_DIGITS = "61581495000184";

export interface BradescoParsed {
  transactionDate: string | null;
  controlNo: string | null;
  e2eId: string | null;
  amountCents: number;
  direction: "in" | "out";
  counterparty: string | null;
  counterpartyCnpj: string | null;
  orderReference: string | null;
  description: string | null;
  rawText: string;
}

function extractField(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function normalizeCnpj(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 11 ? digits : null;
}

export function parseBradescoConfirmation(text: string): BradescoParsed {
  const rawText = text.trim();

  const dateRaw = extractField(rawText, [
    /Data da opera[cç][aã]o:\s*([\d/.-]+)/i,
    /Data:\s*([\d/.-]+)/i,
  ]);
  let transactionDate: string | null = null;
  if (dateRaw) {
    const dm = dateRaw.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    if (dm) {
      const day = dm[1].padStart(2, "0");
      const month = dm[2].padStart(2, "0");
      let year = dm[3];
      if (year.length === 2) year = `20${year}`;
      transactionDate = `${year}-${month}-${day}`;
    }
  }

  const controlNo =
    extractField(rawText, [
      /N[º°] de Controle:\s*([^\n]+)/i,
      /Controle:\s*([^\n]+)/i,
    ]) ?? null;

  const e2eId =
    extractField(rawText, [
      /Identifica[cç][aã]o E2E:\s*([^\n]+)/i,
      /E2E:\s*([^\n]+)/i,
    ]) ?? null;

  const amountRaw = extractField(rawText, [
    /Valor da opera[cç][aã]o:\s*R?\$?\s*([\d.,]+)/i,
    /Valor:\s*R?\$?\s*([\d.,]+)/i,
  ]);
  const amountCents = amountRaw ? parseBrlAmount(amountRaw) : 0;

  const beneficiaryName = extractField(rawText, [
    /Benefici[aá]rio:\s*([^\n]+)/i,
  ]);
  const beneficiaryCnpj = normalizeCnpj(
    extractField(rawText, [/CNPJ Benefici[aá]rio:\s*([^\n]+)/i]),
  );
  const payerName = extractField(rawText, [/Pagador:\s*([^\n]+)/i]);
  const payerCnpj = normalizeCnpj(
    extractField(rawText, [/CNPJ Pagador:\s*([^\n]+)/i]),
  );

  const loquitoIsBeneficiary =
    beneficiaryCnpj === LOQUITO_CNPJ_DIGITS ||
    (beneficiaryName?.toLowerCase().includes("loquitos") ?? false);
  const loquitoIsPayer =
    payerCnpj === LOQUITO_CNPJ_DIGITS ||
    (payerName?.toLowerCase().includes("loquitos") ?? false);

  let direction: "in" | "out" = "in";
  if (loquitoIsPayer && !loquitoIsBeneficiary) direction = "out";
  if (/PIX Enviado|Débito|Debito|pagamento enviado/i.test(rawText)) {
    direction = "out";
  }
  if (/PIX Recebido|Crédito|Credito|recebido/i.test(rawText)) {
    direction = "in";
  }

  const counterparty =
    direction === "in"
      ? payerName ?? beneficiaryName
      : beneficiaryName ?? payerName;
  const counterpartyCnpj =
    direction === "in" ? payerCnpj : beneficiaryCnpj;

  const orderRef =
    extractField(rawText, [
      /Refer[eê]ncia:\s*(PED-[A-Z0-9-]+)/i,
      /\b(PED-[A-Z0-9-]+)\b/i,
    ]) ?? null;

  const description =
    extractField(rawText, [/Tipo:\s*([^\n]+)/i]) ?? null;

  return {
    transactionDate,
    controlNo,
    e2eId,
    amountCents,
    direction,
    counterparty,
    counterpartyCnpj,
    orderReference: orderRef,
    description,
    rawText: rawText.slice(0, 2000),
  };
}

export interface StatementLineParsed {
  lineIndex: number;
  transactionDate: string | null;
  direction: "in" | "out";
  reference: string | null;
  amountCents: number;
  description: string | null;
  controlNo: string | null;
}

export function parseWeeklyStatement(text: string): StatementLineParsed[] {
  const lines: StatementLineParsed[] = [];
  const rows = text.split("\n");

  for (const row of rows) {
    const trimmed = row.trim();
    if (
      !trimmed ||
      trimmed.startsWith("Data |") ||
      trimmed.startsWith("EXTRATO")
    ) {
      continue;
    }
    if (!/\d{1,2}[\/.\-]\d{1,2}/.test(trimmed)) continue;

    const parts = trimmed.split("|").map((p) => p.trim());
    if (parts.length < 4) continue;

    const dateRaw = parts[0];
    const typeRaw = parts[1] ?? "";
    const reference = parts[2] && parts[2] !== "—" ? parts[2] : null;
    const amountRaw = parts[3];
    const description = parts[4] ?? null;

    let transactionDate: string | null = null;
    const dm = dateRaw.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    if (dm) {
      const day = dm[1].padStart(2, "0");
      const month = dm[2].padStart(2, "0");
      let year = dm[3];
      if (year.length === 2) year = `20${year}`;
      transactionDate = `${year}-${month}-${day}`;
    }

    const direction: "in" | "out" =
      /cr[eé]dito|credito|recebido/i.test(typeRaw) ? "in" : "out";

    const amountCents = parseBrlAmount(amountRaw);
    const orderRef =
      reference?.match(/PED-[A-Z0-9-]+/i)?.[0]?.toUpperCase() ?? null;

    lines.push({
      lineIndex: lines.length,
      transactionDate,
      direction,
      reference: orderRef ?? reference,
      amountCents,
      description,
      controlNo: reference?.startsWith("CTRL") ? reference : null,
    });
  }

  return lines;
}

export function parseFinanceDocument(
  text: string,
  fileName: string,
): BradescoParsed | null {
  if (
    /Confirma[cç][aã]o de Opera[cç][aã]o/i.test(text) ||
    fileName.toLowerCase().includes("dekont") ||
    fileName.toLowerCase().includes("bradesco")
  ) {
    return parseBradescoConfirmation(text);
  }
  return null;
}
