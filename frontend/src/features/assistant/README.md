# Campus AI assistant feature

The responsive conversation uses the typed `CampusAssistantService` and the
same-origin `/api/assistant/ask` proxy. That proxy forwards the HttpOnly session
token to FastAPI; the local Ollama model service remains backend-only.

Retrieval sources remain internal to the RAG service; answers do not show citation
markers, source cards, or source URLs. The UI supports grounded answers,
no-context responses, loading, retry, and API errors.
