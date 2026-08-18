"use client";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void _error;
  return (
    <html lang="tr">
      <body className="flex min-h-screen items-center justify-center bg-background p-4 font-sans antialiased">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold">Kritik hata</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Uygulama beklenmedik bir durumla karşılaştı.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  );
}
