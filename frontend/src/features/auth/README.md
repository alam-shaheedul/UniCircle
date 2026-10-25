# Authentication feature

The frontend authentication flow now calls the FastAPI backend through same-origin
Next.js route handlers. Start FastAPI and set `BACKEND_API_URL` in
`frontend/.env.local` (the default is `http://127.0.0.1:8000`).

- `/register` collects first name, last name, home address, username, role, and the
  corresponding Student/Teacher/Staff ID. It validates all required fields, the exact
  `@cuet.ac.bd` or `@student.cuet.ac.bd` domain, and password strength.
- After `Create account`, `/verify-otp?email=...` opens on mobile and desktop.
  Its compact mobile header keeps code entry visible, with numeric keyboard,
  one-time-code autofill, invalid-code feedback, and resend/cooldown behavior.
  A failed SMTP send still opens code entry with a retry notice. Repeating the
  same pending registration with the correct password resumes verification.
- `/login` signs in a verified General User and redirects to Home.
- `Forgot password?` opens `/forgot-password` → `/verify-otp?purpose=reset`
  → `/reset-password` → `/login?reset=1`. Sign-in remains password-only.
- Recovery challenge IDs and the verified reset grant stay in short-lived
  HttpOnly cookies, never browser storage or URLs. Reset grants are hashed in
  the database, single-use, and expire after ten minutes. Saving a valid new
  password revokes all previous sessions and clears pending OTPs/reset grants.
- `/admin/login` signs in a separately provisioned App Admin.
- The BFF keeps the JWT in a host-only HttpOnly cookie and uses a separate CSRF
  cookie/header for authenticated writes. It never stores the JWT in browser storage.
- Protected pages check the live backend session on the server; the Admin page
  additionally requires the persisted App Admin role.

All production features now use the typed API service layer. ESLint rejects imports
from the removed `src/mocks` tree so a feature cannot silently fall back to local
data. Real registration requires a reachable PostgreSQL backend and working SMTP
credentials; without SMTP it fails closed rather than pretending an email was sent.
