# RAG knowledge-source policy

## Default: reviewed local knowledge

The 2026-10-08 requirement replaces whole-site scraping as the runtime corpus.
`backend/app/modules/assistant/knowledge/CUET_Knowledge_Base.md` is authoritative;
the `.txt` file is its deterministic plain-text companion. Both ship with the
backend. Ingestion validates consistency and never indexes both copies.

The independently written summary contains stable section IDs, factual text,
public evidence URLs, review dates and review-after dates. Sources include CUET
documents, government institutional information, QS/THE/EduRank's own tables,
dated reputable reporting, and attributed OpenStreetMap-derived campus markers.
Community food listings establish cafeteria identity, not verified prices or
opening hours. Map positions are approximate, not navigation guarantees.
Prototype pages and old summaries are cross-checked; navigation-only extraction
cannot establish academic or personnel counts.

Rankings identify publisher and edition. Current appointments take precedence
over old biographies. Historical pro-VC appointments are not current appointments;
inability to identify a holder does not prove vacancy. No dummy names, fabricated
phones, unverified room directions, live admission dates or invented teacher
headcounts belong in this corpus.

## Ingestion and refresh

Run `python -m app.modules.assistant.ingest --check` to validate files without
database/model access. After editing Markdown, use `--export-txt` in a writable
checkout, review the companion, and run ingestion without crawler flags.
In Docker, rebuild the backend image after editing the corpus and run the
existing ingestion command inside the backend container.

LangChain splits each section independently; chunks repeat their topic and
as-of date. Ollama embeds with the configured model; chunks and evidence metadata
are stored in PostgreSQL. All vectors are prepared and validated before an
atomic commit. Provider failures cannot remove the last good index. Unchanged
sections skip embedding; model changes and `--force` rebuild vectors.

Re-verify leadership weekly, rankings monthly, and campus/academic facts on their
recorded quarterly/half-yearly dates. Ingestion updates index time, not research
validity. Update review dates only after checking evidence. Unknown administrative
appointments should be confirmed with the Registrar.

## Retrieval and privacy

`RAG_KNOWLEDGE_MODE=curated` is the default. Retrieve only local sources whose
corpus hash matches the bundled document, pipeline version and embedding model
match, and review period includes today in Bangladesh time. Legacy website rows
remain stored for recovery but cannot contaminate curated answers. Removed
sections and old snapshots are excluded. Expired sections cannot supply a stale
current appointment. An entirely ineligible index returns a setup error; a ready
index with insufficient relevance returns a no-context answer. Admin status counts
eligible sources/chunks and reports review-due sections.

Cosine similarity ranks a bounded corpus; low-scoring chunks are not sent to Qwen.
Retrieved content remains untrusted data, never instructions or authority.
The prompt respects dates and uncertainty. Evidence URLs stay in files/database
for maintenance; answers return no source cards, URLs or citation markers.
Audits store a question hash, user ID, outcome, source count and timestamp,
not raw questions or conversations. Ollama stays backend-only.

Chat generation uses Groq-hosted `qwen/qwen3.8-27b` when the backend has a
`GROQ_API_KEY` (`RAG_CHAT_PROVIDER=auto`); explicit `groq` and `ollama` selections
are also supported. Only the question and retrieved public excerpts are sent
to Groq, not account records or authentication credentials. The key is masked
in settings and kept in ignored environment files/deployment secret settings.
Upstream errors and keys never appear in public API responses. Respect the
provider's shared quota; no unrelated question should spend chat quota.

Embeddings remain Ollama `embeddinggemma:300m`. Changing the chat provider does
not alter or rebuild the vectors. A cloud deployment must provision a reachable
embedding server or implement another embedding provider and re-index; hosting
chat alone does not eliminate the laptop dependency for retrieval.

## Optional legacy crawler

`--web` explicitly invokes the strict approved-host HTTPS crawler with robots
checks, throttling, page/depth/download limits, `WebBaseLoader` for HTML and
`PyPDFLoader` for PDFs. Adding a host requires review; portals, assets and unrelated
sources remain blocked. Web results enter retrieval only if an operator
deliberately selects `RAG_KNOWLEDGE_MODE=web`. Manually consulting external
evidence does not expand that crawler allowlist. There is no scraping or online
research inside a question request.

## Verification boundary

Deterministic-provider tests cover local loading, file parity, grounding
contracts, old-source exclusion, review expiry, corpus/model compatibility,
idempotency and failure preservation. Groq contract tests cover provider selection,
masked credentials, prompts, output/timeout bounds, upstream quota/auth failures,
malformed responses and authenticated API/audit behavior. On 2026-10-12 a live
location question retrieved five eligible chunks from the existing curated index
and received a grounded answer from Groq `qwen/qwen3.8-27b`. This verifies the
development setup, not production embedding hosting or every possible answer.
