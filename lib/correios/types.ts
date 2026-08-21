export const TRACKING_STATUSES = [
  "posted",
  "in_transit",
  "out_for_delivery",
  "waiting_pickup",
  "delivered",
  "returned",
  "issue",
  "unknown",
] as const;

export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

export interface TrackingEvent {
  at: string;
  code: string;
  type: string;
  description: string;
  detail: string | null;
  city: string | null;
  uf: string | null;
  unitType: string | null;
}

export interface TrackingSnapshot {
  code: string;
  status: TrackingStatus;
  statusText: string;
  expectedAt: string | null;
  service: string | null;
  events: TrackingEvent[];
  checkedAt: string;
}

export interface CorreiosEventRaw {
  codigo?: string;
  tipo?: string;
  dtHrCriado?: string;
  descricao?: string;
  detalhe?: string;
  unidade?: {
    tipo?: string;
    endereco?: {
      cidade?: string;
      uf?: string;
    };
  };
}

export interface CorreiosObjetoRaw {
  codObjeto?: string;
  mensagem?: string;
  dtPrevista?: string;
  tipoPostal?: {
    descricao?: string;
    categoria?: string;
  };
  eventos?: CorreiosEventRaw[];
}

export interface CorreiosSroRaw {
  versao?: string;
  quantidade?: number;
  objetos?: CorreiosObjetoRaw[];
}
