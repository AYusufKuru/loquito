export type FieldErrors = Record<string, string>;

export function hasFieldErrors(
  errors: FieldErrors | null | undefined,
): errors is FieldErrors {
  return !!errors && Object.keys(errors).length > 0;
}

export function buildErrors(
  entries: Array<[string, string | null | undefined]>,
): FieldErrors | null {
  const errors: FieldErrors = {};
  for (const [field, message] of entries) {
    if (message) errors[field] = message;
  }
  return hasFieldErrors(errors) ? errors : null;
}

export function required(value: string, label: string): string | null {
  if (!value.trim()) return `${label} zorunludur.`;
  return null;
}

export function email(value: string, label: string): string | null {
  const req = required(value, label);
  if (req) return req;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return `${label} geçerli bir e-posta adresi olmalıdır.`;
  }
  return null;
}

export function minLength(value: string, min: number, label: string): string | null {
  const req = required(value, label);
  if (req) return req;
  if (value.trim().length < min) {
    return `${label} en az ${min} karakter olmalıdır.`;
  }
  return null;
}

export interface IntParseResult {
  error: string | null;
  value: number | null;
}

export function parsePositiveInt(
  value: string,
  label: string,
  options?: { required?: boolean; min?: number },
): IntParseResult {
  const trimmed = value.trim();
  const isRequired = options?.required !== false;
  const min = options?.min ?? 1;

  if (!trimmed) {
    return isRequired
      ? { error: `${label} zorunludur.`, value: null }
      : { error: null, value: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { error: `${label} tam sayı olmalıdır.`, value: null };
  }
  const n = Number.parseInt(trimmed, 10);
  if (n < min) {
    return { error: `${label} en az ${min} olmalıdır.`, value: null };
  }
  return { error: null, value: n };
}

export function parseNonNegativeInt(
  value: string,
  label: string,
  requiredField = true,
): IntParseResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return requiredField
      ? { error: `${label} zorunludur.`, value: null }
      : { error: null, value: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { error: `${label} tam sayı olmalıdır.`, value: null };
  }
  return { error: null, value: Number.parseInt(trimmed, 10) };
}

export function parseDecimal(
  value: string,
  label: string,
  options?: { required?: boolean; min?: number },
): { error: string | null; value: number | null } {
  const trimmed = value.trim().replace(",", ".");
  const isRequired = options?.required !== false;
  const min = options?.min ?? 0;

  if (!trimmed) {
    return isRequired
      ? { error: `${label} zorunludur.`, value: null }
      : { error: null, value: null };
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { error: `${label} geçerli bir sayı olmalıdır.`, value: null };
  }
  const n = Number.parseFloat(trimmed);
  if (Number.isNaN(n) || n < min) {
    return { error: `${label} en az ${min} olmalıdır.`, value: null };
  }
  return { error: null, value: n };
}

export function sanitizeIntInput(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export function sanitizeDecimalInput(value: string): string {
  let result = value.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const parts = result.split(".");
  if (parts.length > 2) {
    result = `${parts[0]}.${parts.slice(1).join("")}`;
  }
  return result;
}

export function optionalEmail(value: string, label: string): string | null {
  if (!value.trim()) return null;
  return email(value, label);
}

export function parsePercent(
  value: string,
  label: string,
): { error: string | null; value: number | null } {
  const parsed = parseDecimal(value, label, { required: false, min: 0 });
  if (parsed.error) return parsed;
  if (parsed.value !== null && parsed.value > 100) {
    return { error: `${label} 100'den büyük olamaz.`, value: null };
  }
  return parsed;
}

export function sanitizeMoneyInput(value: string): string {
  return value.replace(/[^\d.,]/g, "");
}
