# Security

This document captures the security posture of the Q Edu backend and the controls in place to satisfy OWASP Top 10 considerations.

## Transport & headers

- HTTPS termination is expected at the reverse proxy / load balancer.
- `helmet()` is enabled in `src/main.ts` (default secure headers including HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
- CORS is **explicit allow-list** via `CORS_ALLOWED_ORIGINS`. Requests without an `Origin` header are accepted (server-to-server). Credentials are enabled.

## Authentication

- JWT access token (`JWT_ACCESS_SECRET`, default 15 min TTL) carried via HttpOnly cookie or `Authorization: Bearer`.
- Refresh tokens are stored hashed in `RefreshToken` table; rotation on every `POST /auth/refresh`.
- Cookies: `HttpOnly`, `SameSite=lax`, `Secure` controlled by `AUTH_COOKIE_SECURE` (must be `true` in production).
- Passwords hashed with bcrypt, **12 rounds** (`PASSWORD_SALT_ROUNDS`).
- OTP for registration & password reset stored hashed (SHA-256) with explicit expiry & single-consume semantics.

## Authorization

- `@Auth(...roles)` decorator combines `JwtAuthGuard` (validate token + load user) and `RolesGuard` (role match).
- Service layer always re-checks scope: super admins are unrestricted; academy owners and lower roles have queries narrowed to their academies via `AcademiesService.getAccessibleAcademyScope`.
- No service trusts the client to send the acting user's id — it is read off the request context.

## Input handling

- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` strips unknown properties and rejects bad payloads.
- Custom `@NoEmoji()` validator rejects emoji / pictographs in identity fields (name, email, phone, gender).
- Production length caps on all text inputs:
  | Field | Max |
  | ---------- | --: |
  | first/last | 80 |
  | bio | 500 |
  | email | 254 |
  | phone | 32 |
  | password | 128 |
  | gender | 64 |
  | address | 128 |
- Phone numbers must match `PHONE_REGEX` (digits, spaces, leading `+`, length 5-32).
- All file uploads pass `ParseFilePipe` with `MaxFileSizeValidator` (5 MB) and `FileTypeValidator` whitelisting `image/(png|jpe?g|gif|webp)`.

## SQL injection

- Prisma is the only data access layer. All queries use the parameterised query API.
- The single `$queryRaw` call (`classes.service.ts → listParticipants`) uses the `Prisma.sql` template tag, which binds parameters; user `search` input is interpolated as a parameter, not raw text.

## Rate limiting

- Global `ThrottlerGuard` at 60 req/min per IP.
- Per-endpoint overrides on auth-sensitive routes:
  | Route | Limit (per IP) |
  | ------------------------------------------------ | -------------- |
  | `POST /auth/login` | 5/min |
  | `POST /auth/register` | 5/min |
  | `POST /auth/resend-otp` | 3/min |
  | `POST /auth/verify-otp` | 5/min |
  | `POST /auth/forgot-password` | 3/min |
  | `POST /auth/reset-password` | 5/min |

## Privacy

- Student email addresses are masked (`a***@domain.com`) when returned via `/users/students` to a `TEACHER` role.
- Password hashes are stripped before any user object leaves the service layer (`UsersService.toEntity`).
- Refresh tokens are deleted on logout, password change, and password reset.

## Secrets & config

- Environment variables validated with Joi (`src/config/validation.ts`). Boot fails fast on missing critical secrets.
- `.env` is git-ignored; `.env.example` documents required keys.
- Zoom credentials only loaded when `ZOOM_ENABLED=true`.

## Logging & errors

- `AllExceptionsFilter` returns sanitised messages; internal stack traces are logged but not returned in production.
- No PII is included in logs by default; only ids and operation names.

## Recommended deployment hardening

1. Run behind a reverse proxy with HTTPS, HTTP/2 and request body size limits (≤ 10 MB).
2. Set `NODE_ENV=production`, `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=strict` (when frontend is same-site) or `none` (cross-site).
3. Rotate `JWT_ACCESS_SECRET` periodically and on suspected compromise — invalidates all access tokens.
4. Backup MySQL with point-in-time recovery; keep retention ≥ 14 days.
5. Run `npm audit --omit=dev` in CI and address Critical/High findings before deploy.
