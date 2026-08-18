import { parseMoneyBrl } from "./orders-validation";
import { buildErrors, required, type FieldErrors } from "./validation";

export function validatePeriodMonth(
  value: string,
  label = "Dönem",
): FieldErrors | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return buildErrors([[ "periodMonth", `${label} zorunludur.` ]]);
  }
  const match = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return buildErrors([[ "periodMonth", `${label} geçerli bir ay olmalıdır (YYYY-AA).` ]]);
  }
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return buildErrors([[ "periodMonth", `${label} geçerli bir ay olmalıdır.` ]]);
  }
  return null;
}

export function validatePaymentForm(form: { amount: string }): FieldErrors | null {
  const amount = parseMoneyBrl(form.amount, "Tutar", true);
  if (amount.error) return buildErrors([["amount", amount.error]]);
  if (amount.value !== null && amount.value <= 0) {
    return buildErrors([["amount", "Tutar sıfırdan büyük olmalıdır."]]);
  }
  return null;
}

export function validateFixedExpenseForm(form: {
  name: string;
  amount: string;
  category: string;
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [
    ["name", required(form.name, "Gider adı")],
    ["category", required(form.category, "Kategori")],
  ];

  const amount = parseMoneyBrl(form.amount, "Tutar", true);
  if (amount.error) entries.push(["amount", amount.error]);
  else if (amount.value !== null && amount.value <= 0) {
    entries.push(["amount", "Tutar sıfırdan büyük olmalıdır."]);
  }

  return buildErrors(entries);
}

export function validateFileRequired(
  file: File | null,
  label = "Dosya",
): FieldErrors | null {
  if (!file) {
    return buildErrors([[ "file", `${label} seçimi zorunludur.` ]]);
  }
  return null;
}

export function validateCustomerId(customerId: string): FieldErrors | null {
  return buildErrors([["customerId", required(customerId, "Müşteri")]]);
}

export function validateExpenseAmount(amount: string): FieldErrors | null {
  const parsed = parseMoneyBrl(amount, "Tutar", true);
  if (parsed.error) return buildErrors([["amount", parsed.error]]);
  if (parsed.value !== null && parsed.value <= 0) {
    return buildErrors([["amount", "Tutar sıfırdan büyük olmalıdır."]]);
  }
  return null;
}
