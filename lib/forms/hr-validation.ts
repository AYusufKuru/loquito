import { parseMoneyBrl } from "./orders-validation";
import {
  buildErrors,
  optionalEmail,
  parseDecimal,
  parseNonNegativeInt,
  required,
  type FieldErrors,
} from "./validation";

function validateDate(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} zorunludur.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${label} geçerli bir tarih olmalıdır (YYYY-AA-GG).`;
  }
  const d = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(d.getTime())) return `${label} geçerli bir tarih olmalıdır.`;
  return null;
}

function validateTime(value: string, label: string, requiredField = true): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return requiredField ? `${label} zorunludur.` : null;
  }
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
    return `${label} geçerli bir saat olmalıdır (ör. 08:00).`;
  }
  return null;
}

export function validateEmployeeForm(form: {
  name: string;
  monthlySalary: string;
  hourlyRate: string;
  overtimeMultiplier: string;
  email: string;
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [
    ["name", required(form.name, "Personel adı")],
  ];

  const salary = parseMoneyBrl(form.monthlySalary, "Aylık maaş", true);
  if (salary.error) entries.push(["monthlySalary", salary.error]);
  else if (salary.value !== null && salary.value <= 0) {
    entries.push(["monthlySalary", "Aylık maaş sıfırdan büyük olmalıdır."]);
  }

  if (form.hourlyRate.trim()) {
    const hourly = parseMoneyBrl(form.hourlyRate, "Saatlik ücret");
    if (hourly.error) entries.push(["hourlyRate", hourly.error]);
    else if (hourly.value !== null && hourly.value <= 0) {
      entries.push(["hourlyRate", "Saatlik ücret sıfırdan büyük olmalıdır."]);
    }
  }

  if (form.overtimeMultiplier.trim()) {
    const mult = parseDecimal(form.overtimeMultiplier, "Mesai çarpanı", {
      required: false,
      min: 1,
    });
    if (mult.error) entries.push(["overtimeMultiplier", mult.error]);
  }

  const emailErr = optionalEmail(form.email, "E-posta");
  if (emailErr) entries.push(["email", emailErr]);

  return buildErrors(entries);
}

export function validateAttendanceForm(params: {
  employeeId: string;
  employeeLabel: string;
  date: string;
  status: string;
  clockIn: string;
  clockOut: string;
  overtimeHours: string;
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [
    ["employeeId", required(params.employeeId, params.employeeLabel)],
    ["date", validateDate(params.date, "Tarih")],
  ];

  if (params.status === "present") {
    const inErr = validateTime(params.clockIn, "Giriş saati");
    if (inErr) entries.push(["clockIn", inErr]);

    const outErr = validateTime(params.clockOut, "Çıkış saati");
    if (outErr) entries.push(["clockOut", outErr]);
  }

  if (params.overtimeHours.trim()) {
    const ot = parseNonNegativeInt(params.overtimeHours, "Mesai saati", false);
    if (ot.error) entries.push(["overtimeHours", ot.error]);
  }

  return buildErrors(entries);
}

export function validateWorkAssignmentForm(params: {
  employeeId: string;
  employeeLabel: string;
  date: string;
  hours: string;
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [
    ["employeeId", required(params.employeeId, params.employeeLabel)],
    ["date", validateDate(params.date, "Tarih")],
  ];

  const hours = parseDecimal(params.hours, "Çalışma saati", { required: true, min: 0.001 });
  if (hours.error) entries.push(["hours", hours.error]);

  return buildErrors(entries);
}

export function validatePayrollMonth(value: string, label = "Dönem"): FieldErrors | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return buildErrors([[ "month", `${label} zorunludur.` ]]);
  }
  if (!/^(\d{4})-(\d{2})$/.test(trimmed)) {
    return buildErrors([[ "month", `${label} geçerli bir ay olmalıdır (YYYY-AA).` ]]);
  }
  const month = Number(trimmed.split("-")[1]);
  if (month < 1 || month > 12) {
    return buildErrors([[ "month", `${label} geçerli bir ay olmalıdır.` ]]);
  }
  return null;
}
