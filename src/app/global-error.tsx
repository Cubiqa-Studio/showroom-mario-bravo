"use client";

// Pantalla de error de último recurso. NO reporta a PostHog: el error tracking está
// apagado a propósito (ver instrumentation-client.ts).
export default function GlobalError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <html lang="es">
      <body>
        <main>
          <h1>Algo salió mal</h1>
          <p>Ocurrió un error inesperado. Por favor, intentá nuevamente.</p>
          <button type="button" onClick={reset}>
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
