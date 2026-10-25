"use client";

import { ErrorState } from "@/components/ui/feedback/error-state";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RouteError({ error, reset }: RouteErrorProps) {
  return (
    <main className="app-shell" id="main-content">
      <ErrorState
        title="This page could not be loaded"
        description="Please try again. If the problem continues, return later."
        onRetry={reset}
        reference={error.digest}
      />
    </main>
  );
}
