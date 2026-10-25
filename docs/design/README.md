# UniCircle design documents

These project-owner-requested, **working** designs guide Phase 7. They describe intended behavior; they do not mean the tables, endpoints, worker, or AI integration are already implemented.

The [API design](api_desing.md) is an implementation-aligned reference. Older diagrams may still describe planned contracts; consult the API catalogue and current source when integrating implemented endpoints.

| Artifact | Purpose |
| --- | --- |
| [HLD](HLD.md) | System architecture, runtime components, trust boundaries, deployment shape |
| [LLD](LLD.md) | Module responsibilities, planned API surface, state transitions, transaction rules |
| [API design](api_desing.md) | Implemented API catalogue, BFF mappings, permissions, contracts, examples, and error/retry rules |
| [ERD](ERD.md) | Logical entities, relationships, constraints, authentication/session storage |
| [Document flow diagram](Document_Flow_Diagram.md) | Forms, review records, notifications, and development artifact handoffs |
| [Data flow diagrams](Data_Flow_Diagram.md) | System context, processes, stores, and authentication data movement |
| [Sequence diagrams](Sequence_Diagram.md) | Order and failure branches for authentication, club/event, chat, notifications, RAG |
| [Use-case diagrams](Use_Case_Diagram.md) | Actors, capabilities, preconditions, and permission boundaries |
| [RAG source policy](RAG_Knowledge_Source_Policy.md) | Approved CUET sources, crawl limits, refresh rules, vector storage, and prompt safety |

The [project context](../../UniCircle_AI_Project_Context.md) and [feature plan](../../UniCircle_Feature_Wise_Implementation_TODO.md) define product behavior and build order. Review each feature's detailed migration and Pydantic/OpenAPI contracts against these designs before implementation. If a design choice is deliberately changed, update the affected diagrams and tests in the same feature cycle. Provider choices for hosting and SMTP remain open; RAG currently uses local Ollama models with PostgreSQL-backed bounded vector retrieval as documented in the source policy.

The working defaults are a Next.js same-origin BFF, short-lived JWT plus revocable database session, PostgreSQL-backed outbox for notifications, REST refresh/polling for chat, static Home content, and an explicit CLI-based RAG refresh. Deployment still needs real environment secrets, an SMTP provider, private Ollama hosting with the configured models, retention rules, and production hosting/network details.
