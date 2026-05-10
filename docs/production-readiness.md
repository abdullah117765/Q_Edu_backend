# Production Readiness Checklist

Use this list before promoting to production.

## Infrastructure

- [ ] DNS, TLS certificate (HSTS preload optional).
- [ ] Reverse proxy (Nginx / ALB) with request body limit ≤ 10 MB and timeout ≥ 30 s for uploads.
- [ ] MySQL 8.x with daily backup + 14-day retention + point-in-time recovery.
- [ ] Object storage configured if `FILE_STORAGE_DRIVER` is `s3` (otherwise `local` with persistent volume mounted at `LOCAL_STORAGE_ROOT`).
- [ ] SMTP credentials provisioned and verified.
- [ ] Zoom Server-to-Server OAuth app created; `ZOOM_*` vars populated; `ZOOM_ENABLED=true`.

## Backend env

- [ ] `NODE_ENV=production` (disables Swagger).
- [ ] `JWT_ACCESS_SECRET` is ≥ 32 random bytes (rotated quarterly).
- [ ] `AUTH_COOKIE_SECURE=true`.
- [ ] `AUTH_COOKIE_SAMESITE=strict` (same-site) or `none` (cross-site, requires Secure).
- [ ] `AUTH_COOKIE_DOMAIN` set if cookies cross subdomains.
- [ ] `CORS_ALLOWED_ORIGINS` lists exact frontend origins (no `*`).
- [ ] `DATABASE_URL` uses dedicated DB user with least privilege (no DDL in steady state).

## Frontend env

- [ ] `VITE_API_BASE_URL` points to production API.
- [ ] `VITE_ASSET_BASE_URL` points to production static origin.
- [ ] Built with `npm run build`; bundle deployed behind CDN.

## Data & migrations

- [ ] `npx prisma migrate deploy` runs as a release step.
- [ ] First Super Admin seeded via secure script.

## Security

- [ ] `npm audit --omit=dev` shows no Critical/High vulnerabilities.
- [ ] Throttling reachable through load balancer (no IP rewriting that breaks per-IP buckets).
- [ ] Logs forwarded to a SIEM; secrets excluded.
- [ ] Periodic backup restore drill completed.

## Monitoring

- [ ] `/api` health probe wired into liveness/readiness checks.
- [ ] Error tracking (Sentry / Datadog) capturing both backend and frontend.
- [ ] Uptime alerts on registration, login, class creation flows.

## Smoke test

After every deploy run the smoke checklist:

1. Register a new test user, verify OTP delivery.
2. Login, refresh, change password.
3. Super Admin: approve a teacher and a student.
4. Owner: complete onboarding, schedule a class, see Zoom URL.
5. Teacher: see students list — emails masked.
6. Student: join class, attendance recorded after class ends.
