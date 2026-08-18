export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  canSetPrice: boolean;
  canApproveOrder: boolean;
  canApproveFinance: boolean;
}
