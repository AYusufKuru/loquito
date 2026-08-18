import type { ModuleId } from "@/lib/modules";

export interface PermissionRow {
  module: ModuleId;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roleId: string;
  roleName: string;
  canSetPrice: boolean;
  canApproveOrder: boolean;
  canApproveFinance: boolean;
}

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: PermissionRow[];
}

export interface SettingsCapabilities {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}
