"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body>
        <main className="app-shell" id="main-content">
          <section className="error-state" role="alert">
            <h1>UniCircle encountered an unexpected error</h1>
            <p>Reload this application shell and try the request again.</p>
            {error.digest ? <p>Reference: {error.digest}</p> : null}
            <button type="button" onClick={reset}>
              Reload application
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
