"use client";

import { useState } from "react";

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
import { buildErrors, email, minLength, required } from "@/lib/forms/validation";
import type { RoleRow, SettingsCapabilities, UserRow } from "@/lib/settings/types";

interface UsersSectionProps {
  initialUsers: UserRow[];
  roles: RoleRow[];
  currentUserId: string;
  capabilities: SettingsCapabilities;
}

interface UserFormState {
  email: string;
  name: string;
  password: string;
  roleId: string;
  isActive: boolean;
  canSetPrice: boolean;
  canApproveOrder: boolean;
  canApproveFinance: boolean;
}

function emptyForm(roles: RoleRow[]): UserFormState {
  return {
    email: "",
    name: "",
    password: "",
    roleId: roles[0]?.id ?? "",
    isActive: true,
    canSetPrice: false,
    canApproveOrder: false,
    canApproveFinance: false,
  };
}

function fromUser(user: UserRow): UserFormState {
  return {
    email: user.email,
    name: user.name,
    password: "",
    roleId: user.roleId,
    isActive: user.isActive,
    canSetPrice: user.canSetPrice,
    canApproveOrder: user.canApproveOrder,
    canApproveFinance: user.canApproveFinance,
  };
}

function validateUserForm(form: UserFormState, isCreating: boolean) {
  return buildErrors([
    ["name", required(form.name, "Ad")],
    ["email", email(form.email, "E-posta")],
    ["roleId", required(form.roleId, "Rol")],
    [
      "password",
      isCreating
        ? minLength(form.password, 6, "Şifre")
        : form.password
          ? minLength(form.password, 6, "Şifre")
          : null,
    ],
  ]);
}

export function UsersSection({
  initialUsers,
  roles,
  currentUserId,
  capabilities,
}: UsersSectionProps) {
  const [users, setUsers] = useLiveState(initialUsers);
  const [selectedId, setSelectedId] = useState(initialUsers[0]?.id ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyForm(roles));
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

  const selected = users.find((u) => u.id === selectedId);

  function selectUser(user: UserRow) {
    setSelectedId(user.id);
    setIsCreating(false);
    setForm(fromUser(user));
    clearErrors();
    setMessage("");
  }

  function startCreate() {
    setIsCreating(true);
    setSelectedId("");
    setForm(emptyForm(roles));
    clearErrors();
    setMessage("");
  }

  async function handleSave() {
    if (!applyValidationErrors(validateUserForm(form, isCreating))) return;

    setLoading(true);
    clearErrors();
    setMessage("");

    try {
      if (isCreating) {
        const res = await apiFetch("/api/settings/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, "Kullanıcı oluşturulamadı.");
          return;
        }
        setUsers((prev) => [...prev, data.user]);
        selectUser(data.user);
        setMessage("Kullanıcı oluşturuldu.");
      } else if (selected) {
        const payload: Record<string, unknown> = {
          email: form.email,
          name: form.name,
          roleId: form.roleId,
          isActive: form.isActive,
          canSetPrice: form.canSetPrice,
          canApproveOrder: form.canApproveOrder,
          canApproveFinance: form.canApproveFinance,
        };
        if (form.password) payload.password = form.password;

        const res = await apiFetch(`/api/settings/users/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          showApiError(data, "Kullanıcı güncellenemedi.");
          return;
        }
        setUsers((prev) => prev.map((u) => (u.id === data.user.id ? data.user : u)));
        setForm(fromUser(data.user));
        setMessage("Kullanıcı kaydedildi.");
      }
    } catch {
      showError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate() {
    if (!selected) return;
    if (!confirm(`"${selected.name}" hesabını devre dışı bırakmak istediğinize emin misiniz?`)) return;

    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/settings/users/${selected.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, "İşlem başarısız.");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === selected.id ? { ...u, isActive: false } : u)),
      );
      setForm((f) => ({ ...f, isActive: false }));
      setMessage("Kullanıcı devre dışı bırakıldı.");
    } catch {
      showError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {ErrorModal}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Kullanıcılar</CardTitle>
          <CardDescription>{users.length} hesap</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selectedId === user.id && !isCreating
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{user.name}</span>
                {!user.isActive && (
                  <Badge variant="secondary" className="text-[10px]">Pasif</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">{user.roleName}</p>
            </button>
          ))}
          {capabilities.canCreate && (
            <Button variant="outline" size="sm" className="w-full" onClick={startCreate}>
              + Yeni Kullanıcı
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isCreating ? "Yeni Kullanıcı" : selected?.name ?? "Kullanıcı Seçin"}
          </CardTitle>
          <CardDescription>
            Hesap bilgileri ve özel yetkiler (fiyat, sipariş onayı, muhasebe onayı)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isCreating || selected) && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Ad" htmlFor="user-name" required error={fieldError("name")}>
                  <Input
                    id="user-name"
                    value={form.name}
                    onChange={(e) => {
                      clearFieldError("name");
                      setForm({ ...form, name: e.target.value });
                    }}
                    disabled={!capabilities.canEdit && !isCreating}
                    aria-invalid={!!fieldError("name")}
                  />
                </FormField>
                <FormField
                  label="E-posta"
                  htmlFor="user-email"
                  required
                  error={fieldError("email")}
                >
                  <Input
                    id="user-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => {
                      clearFieldError("email");
                      setForm({ ...form, email: e.target.value });
                    }}
                    disabled={!capabilities.canEdit && !isCreating}
                    aria-invalid={!!fieldError("email")}
                  />
                </FormField>
                <FormField label="Rol" htmlFor="user-role" required error={fieldError("roleId")}>
                  <select
                    id="user-role"
                    className={`flex h-9 w-full rounded-md border bg-background px-3 text-sm ${
                      fieldError("roleId") ? "border-destructive" : "border-input"
                    }`}
                    value={form.roleId}
                    onChange={(e) => {
                      clearFieldError("roleId");
                      setForm({ ...form, roleId: e.target.value });
                    }}
                    disabled={!capabilities.canEdit && !isCreating}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label={isCreating ? "Şifre" : "Yeni şifre (isteğe bağlı)"}
                  htmlFor="user-password"
                  required={isCreating}
                  error={fieldError("password")}
                >
                  <Input
                    id="user-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => {
                      clearFieldError("password");
                      setForm({ ...form, password: e.target.value });
                    }}
                    disabled={!capabilities.canEdit && !isCreating}
                    placeholder={isCreating ? "En az 6 karakter" : "Değiştirmek için girin"}
                    aria-invalid={!!fieldError("password")}
                  />
                </FormField>
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">Özel Yetkiler</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={form.canSetPrice}
                    onChange={(e) => setForm({ ...form, canSetPrice: e.target.checked })}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                  Fiyat girebilir
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={form.canApproveOrder}
                    onChange={(e) => setForm({ ...form, canApproveOrder: e.target.checked })}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                  Sipariş onaylayabilir
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={form.canApproveFinance}
                    onChange={(e) => setForm({ ...form, canApproveFinance: e.target.checked })}
                    disabled={!capabilities.canEdit && !isCreating}
                  />
                  Muhasebe onayı verebilir
                </label>
                {!isCreating && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      disabled={
                        !capabilities.canEdit || selected?.id === currentUserId
                      }
                    />
                    Hesap aktif
                  </label>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {(capabilities.canCreate && isCreating) || (capabilities.canEdit && !isCreating) ? (
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? "Kaydediliyor…" : isCreating ? "Kullanıcı Oluştur" : "Kaydet"}
                  </Button>
                ) : null}
                {capabilities.canDelete &&
                  selected &&
                  selected.isActive &&
                  selected.id !== currentUserId &&
                  !isCreating && (
                    <Button variant="destructive" onClick={handleDeactivate} disabled={loading}>
                      Devre Dışı Bırak
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
