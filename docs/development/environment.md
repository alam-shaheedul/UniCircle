# Environment configuration

UniCircle uses separate development, testing, and production configuration. The committed `.env.example` is the inventory of supported variables; actual `.env` files are ignored by Git.

## Variable ownership

| Variable | Owner | Browser-visible | Purpose |
| --- | --- | --- | --- |
| `APP_ENV` | Backend/runtime | No | Selects development, testing, or production behavior. |
| `FRONTEND_URL` | Backend/runtime | No | Canonical frontend origin for links and CORS configuration. |
| `BACKEND_URL` | Runtime | No | Canonical backend origin for future deployment wiring. |
| `BACKEND_API_URL` | Next.js server | No | FastAPI origin used by the same-origin authentication BFF; set in `frontend/.env.local` or deployment environment. |
| `DATABASE_URL` | Backend | No | PostgreSQL connection string. |
| `JWT_SECRET` | Backend | No | Signs/verifies authentication tokens. |
| `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_TOKEN_MINUTES` | Backend | No | Required token context and bounded access-token lifetime. |
| `OTP_PEPPER` | Backend | No | Separate secret for hashing one-time email codes. |
| `OTP_EXPIRY_MINUTES`, `OTP_RESEND_COOLDOWN_SECONDS`, `OTP_MAX_ATTEMPTS` | Backend | No | Email-code lifetime, resend throttle, and retry limit. |
| `SMTP_HOST` | Backend | No | SMTP server hostname. |
| `SMTP_PORT` | Backend | No | SMTP server port. |
| `SMTP_TLS_MODE` | Backend | No | `starttls` or implicit `ssl`; plaintext SMTP is not supported. |
| `SMTP_USERNAME` | Backend | No | SMTP account identifier. |
| `SMTP_PASSWORD` | Backend | No | SMTP credential. |
| `SMTP_FROM_EMAIL` | Backend | No | Sender address for OTP messages. |
| `OLLAMA_BASE_URL` | Backend | No | Private URL of the local Ollama service. |
| `OLLAMA_CHAT_MODEL` | Backend | No | Local chat model; defaults to `qwen3:1.7b`. |
| `OLLAMA_EMBEDDING_MODEL` | Backend | No | Local embedding model; defaults to `embeddinggemma:300m`. |

## Environment rules

- Development uses local services and developer-specific `.env` values.
- Testing uses isolated credentials and databases; it must not reuse development or production data.
- Production values come from the chosen platform's secret manager, not files committed to Git or baked into images.
- Only variables deliberately prefixed with `NEXT_PUBLIC_` may be read by browser code.
- Add vector-store or object-storage variables only after those technologies are approved.
- The root `.env` is ignored and may contain local dummy placeholders. Replace `JWT_SECRET` and `OTP_PEPPER` with two distinct, random signing keys before using authentication or OTP; a JWT access token is issued by the server and must **not** be pasted into `JWT_SECRET`.
- The auth BFF does not use `NEXT_PUBLIC_API_URL`. Browser code calls same-origin
  `/api/auth/*` and `/api/profile`, and never receives a JWT. `BACKEND_API_URL`
  defaults to `http://127.0.0.1:8000` for local development.
