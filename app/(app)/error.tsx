"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Bir hata oluştu</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        İşlem tamamlanamadı. Tekrar deneyin veya yöneticinize bildirin.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Kod: {error.digest}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={reset}>Tekrar dene</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Kontrol paneline dön</Link>
        </Button>
      </div>
    </div>
  );
}
