"use client";

import { useCallback, useState } from "react";

import { ErrorDialog } from "@/components/ui/error-dialog";
import { hasFieldErrors, type FieldErrors } from "@/lib/forms/validation";

export function useFormErrors(title = "Hata") {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [modalError, setModalError] = useState<string | null>(null);

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setModalError(null);
  }, []);

  const showError = useCallback((message: string) => {
    setModalError(message);
  }, []);

  const showApiError = useCallback(
    (data: { error?: string } | null | undefined, fallback: string) => {
      setModalError(data?.error || fallback);
    },
    [],
  );

  const applyValidationErrors = useCallback((errors: FieldErrors | null): boolean => {
    if (!hasFieldErrors(errors)) return true;
    setFieldErrors(errors);
    setModalError(Object.values(errors).join("\n"));
    return false;
  }, []);

  const fieldError = useCallback(
    (field: string) => fieldErrors[field],
    [fieldErrors],
  );

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const ErrorModal = (
    <ErrorDialog
      open={modalError !== null}
      title={title}
      message={modalError ?? ""}
      onClose={() => setModalError(null)}
    />
  );

  return {
    fieldErrors,
    fieldError,
    clearFieldError,
    clearErrors,
    showError,
    showApiError,
    applyValidationErrors,
    ErrorModal,
  };
}
