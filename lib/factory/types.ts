export interface FactorySettingRow {
  key: string;
  value: string;
  label: string;
  category: string;
  updatedAt?: string;
}

export interface FactorySettingsGroup {
  category: string;
  label: string;
  settings: FactorySettingRow[];
}

export interface ProductionLineRow {
  id: string;
  code: string;
  name: string;
  type: string;
  teamSize: number;
  dailyTargetUnits: number;
  dailyProducedUnits: number;
  status: string;
  isActive: boolean;
}

export interface WorkSchedule {
  workStart: string;
  workEnd: string;
  workDays: string;
}
