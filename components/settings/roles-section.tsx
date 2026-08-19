"use client";

import { useState } from "react";

import { PermissionMatrix } from "@/components/settings/permission-matrix";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useFormErrors } from "@/hooks/use-form-errors";
import { useLiveState } from "@/hooks/use-live-state";
import { apiFetch } from "@/lib/http";
import { buildErrors, required } from "@/lib/forms/validation";
import { MODULE_IDS } from "@/lib/modules";
import type {
  PermissionRow,
  RoleRow,
  SettingsCapabilities,
} from "@/lib/settings/types";

interface RolesSectionProps {
  initialRoles: RoleRow[];
  labels: Record<string, string>;
  capabilities: SettingsCapabilities;
}

function emptyPermissions(): PermissionRow[] {
  return MODULE_IDS.map((module) => ({
    module,
    canView: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canApprove: false,
  }));
}

export function RolesSection({
  initialRoles,
  labels,
  capabilities,
}: RolesSectionProps) {
  const [roles, setRoles] = useLiveState(initialRoles);
  const [selectedId, setSelectedId] = useState(initialRoles[0]?.id ?? "");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<PermissionRow[]>(emptyPermissions());
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const {
    fieldError,
    clearErrors,
    clearFieldError,
    showApiError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();

  const selected = roles.find((r) => r.id === selectedId);

  function selectRole(role: RoleRow) {
    setSelectedId(role.id);
    setIsCreating(false);
    setFormName(role.name);
    setFormDescription(role.description ?? "");
    setFormPermissions(role.permissions);
    clearErrors();
    setMessage("");
  }

  function startCreate() {
    setIsCreating(true);
    setSelectedId("");
    setFormName("");
    setFormDescription("");
    setFormPermissions(emptyPermissions());
    clearErrors();
    setMessage("");
  }

  async function handleSave() {
    if (!applyValidationErrors(buildErrors([["name", required(formName, "Rol adı")]]))) {
      return;
    }

    setLoading(true);
    clearErrors();
    setMessage("");

    try {
      if (isCreating) {
        const res = await apiFetch("/api/settings/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            description: formDescription,
            permissions: formPermissions,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, "Rol oluşturulamadı.");
          return;
        }
        setRoles((prev) => [...prev, data.role]);
        selectRole(data.role);
        setMessage("Rol oluşturuldu.");
      } else if (selected) {
        const res = await apiFetch(`/api/settings/roles/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            description: formDescription,
            permissions: formPermissions,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, "Rol güncellenemedi.");
          return;
        }
        setRoles((prev) => prev.map((r) => (r.id === data.role.id ? data.role : r)));
        setMessage("Rol kaydedildi.");
      }
    } catch {
      showError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!selected || selected.isSystem) return;
    if (!confirm(`"${selected.name}" rolünü silmek istediğinize emin misiniz?`)) return;

    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/settings/roles/${selected.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, "Rol silinemedi.");
        return;
      }
      const next = roles.filter((r) => r.id !== selected.id);
      setRoles(next);
      if (next[0]) selectRole(next[0]);
      else startCreate();
      setMessage("Rol silindi.");
    } catch {
      showError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {ErrorModal}
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Roller</CardTitle>
          <CardDescription>{roles.length} rol tanımlı</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => selectRole(role)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selectedId === role.id && !isCreating
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{role.name}</span>
                {role.isSystem && (
                  <Badge variant="secondary" className="text-[10px]">Sistem</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{role.userCount} kullanıcı</p>
            </button>
          ))}
          {capabilities.canCreate && (
            <Button variant="outline" size="sm" className="w-full" onClick={startCreate}>
              + Yeni Rol
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isCreating ? "Yeni Rol" : selected?.name ?? "Rol Seçin"}
          </CardTitle>
          <CardDescription>
            Modül bazlı yetki matrisi — görüntüle / ekle / düzenle / sil / onayla
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isCreating || selected) && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Rol adı"
                  htmlFor="role-name"
                  required
                  error={fieldError("name")}
                >
                  <Input
                    id="role-name"
                    value={formName}
                    onChange={(e) => {
                      clearFieldError("name");
                      setFormName(e.target.value);
                    }}
                    disabled={!capabilities.canEdit && !isCreating}
                    aria-invalid={!!fieldError("name")}
                  />
                </FormField>
                <FormField label="Açıklama" htmlFor="role-desc">
                  <Input
                    id="role-desc"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                </FormField>
              </div>

              <PermissionMatrix
                permissions={formPermissions}
                labels={labels}
                disabled={!capabilities.canEdit && !isCreating}
                onChange={setFormPermissions}
              />

              <div className="flex flex-wrap gap-2">
                {(capabilities.canCreate && isCreating) || (capabilities.canEdit && !isCreating) ? (
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? "Kaydediliyor…" : isCreating ? "Rol Oluştur" : "Kaydet"}
                  </Button>
                ) : null}
                {capabilities.canDelete && selected && !selected.isSystem && !isCreating && (
                  <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                    Rolü Sil
                  </Button>
                )}
              </div>
            </>
          )}

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
