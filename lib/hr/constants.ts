export const EMPLOYEE_ROLES = [
  "Pişirme",
  "Kesim",
  "Dizim",
  "Paketleme",
  "Genel İmalat",
  "İdari",
] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export const EMPLOYEE_SHIFTS = [
  { value: "morning", label: "08:00–17:00" },
  { value: "afternoon", label: "14:00–22:00" },
  { value: "night", label: "22:00–06:00" },
] as const;

export const DEFAULT_OVERTIME_MULTIPLIER = 1.5;
export const HOURS_PER_MONTH = 220;
export const STANDARD_WORK_HOURS = 8;

export const ATTENDANCE_STATUSES = [
  { value: "present", label: "Mesai" },
  { value: "absent", label: "Devamsız" },
  { value: "leave", label: "İzin" },
  { value: "sick", label: "Rapor" },
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]["value"];

export const DEFAULT_CLOCK_IN = "08:00";
export const DEFAULT_CLOCK_OUT = "17:00";

export const ROLE_LABELS: Record<string, string> = {
  Pişirme: "Pişirme",
  "Pişirme Yardımcısı": "Pişirme",
  Kesim: "Kesim",
  Dizim: "Dizim",
  Paketleme: "Paketleme",
  "Genel İmalat": "Genel İmalat",
  İdari: "İdari",
  "İdari Kısım": "İdari",
  "İdari Kısım Yetkilisi": "İdari",
  "İmalat Yetkilisi": "Genel İmalat",
  "Genel Sorumlu": "Genel İmalat",
};
