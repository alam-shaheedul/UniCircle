import { EmptyState } from "@/components/ui/feedback/empty-state";

export default function NotFound() {
  return (
    <main className="app-shell" id="main-content">
      <EmptyState
        title="Page not found"
        description="The requested UniCircle page does not exist or has moved."
      />
    </main>
  );
}
