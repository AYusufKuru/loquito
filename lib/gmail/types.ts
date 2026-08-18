export interface GmailInboxRow {
  id: string;
  gmailMessageId: string;
  subject: string | null;
  fromEmail: string | null;
  receivedAt: string | null;
  status: string;
  orderId: string | null;
  orderNo: string | null;
  attachmentName: string | null;
  errorMessage: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface GmailStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  demoMode: boolean;
  pendingCount: number;
  processedCount: number;
}

export interface GmailSyncResult {
  synced: number;
  created: number;
  failed: number;
  skipped: number;
  messages: GmailInboxRow[];
}
