import { LoadingState } from "@/components/ui/feedback/loading-state";

export default function Loading() {
  return (
    <main className="app-shell" id="main-content">
      <LoadingState label="Loading UniCircle" />
    </main>
  );
}
