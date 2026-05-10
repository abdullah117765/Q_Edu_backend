# Architecture Overview

## High-level

```
┌─────────────────────────────┐        ┌─────────────────────────────┐
│        SaaS (React 18)      │ HTTPS  │     Q_Edu_backend (Nest)    │
│  Vite • TailwindCSS • RTQ   │ ─────▶ │  REST /api • Swagger /docs  │
│  React Router • Framer      │        │  JWT cookies + bearer       │
└─────────────────────────────┘        └──────────────┬──────────────┘
                                                       │
                            ┌──────────────────────────┼──────────────────────────┐
                            ▼                          ▼                          ▼
                    ┌──────────────┐          ┌──────────────┐           ┌──────────────┐
                    │  MySQL via   │          │ Local / S3   │           │  Zoom v2 API │
                    │  Prisma ORM  │          │  Storage     │           │  (server-to- │
                    │              │          │  /storage    │           │   server)    │
                    └──────────────┘          └──────────────┘           └──────────────┘
```

## Backend modules

| Module              | Responsibility                                                                  |
| ------------------- | ------------------------------------------------------------------------------- |
| `auth`              | Registration, OTP verification, login, refresh, password reset, change password |
| `users`             | User CRUD, profile, photo upload, directory queries with role scoping           |
| `academies`         | Owner onboarding, admin review, membership lifecycle, settings                  |
| `academy-settings`  | Per-academy preferences (meeting defaults, branding)                            |
| `platform-settings` | Global flags such as Zoom enablement                                            |
| `classes`           | Class scheduling, attendance, Zoom meeting provisioning                         |
| `zoom`              | Zoom OAuth (server-to-server) and meeting CRUD                                  |
| `zoom-credits`      | Credit pool, consumption, payments link                                         |
| `payments`          | Payment intents, history, summaries                                             |
| `resources`         | Teacher uploaded materials, access control                                      |
| `dashboard`         | Aggregated overview metrics                                                     |
| `mail`              | Transactional SMTP delivery                                                     |
| `storage`           | Pluggable storage driver (local + interface for S3)                             |

## Cross-cutting concerns

- **Validation** — global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` enforces DTO contracts. Custom decorators in `src/common/validators/`.
- **Throttling** — `@nestjs/throttler` global guard, 60 req/min default, 3-5/min on auth endpoints.
- **Security headers** — `helmet()` middleware in `main.ts`.
- **CORS** — origins from `CORS_ALLOWED_ORIGINS` env. Credentials enabled.
- **Auth guard** — `@Auth(...roles)` decorator wraps `JwtAuthGuard + RolesGuard`. Roles: `SUPER_ADMIN`, `ACADEMY_OWNER`, `TEACHER`, `STUDENT`.
- **Errors** — `AllExceptionsFilter` normalises errors into `{ statusCode, message, error }`.
- **Responses** — `ResponseInterceptor` wraps payloads with `data`, `meta`, `summary` fields where applicable.

## Onboarding & approval flow

1. User signs up via `/auth/register` (role chosen client-side).
2. Email OTP delivered via SMTP, verified at `/auth/verify-otp`.
3. `SUPER_ADMIN` & `ACADEMY_OWNER` are auto-approved on OTP success. `TEACHER` & `STUDENT` remain `PENDING` until manually approved.
4. On `ACADEMY_OWNER` registration, an academy stub is provisioned (`AcademyStatus.PENDING`).
5. Owner completes onboarding via `/academies/owner/onboarding` (sets real `academyName` + description).
6. Super Admin reviews academy via `/academies/admin/:id/review` → `APPROVED` or `REJECTED`.
7. Approved academy enables full owner-dashboard features.

## Membership flow

```
Student/Teacher  ── request ──▶  Academy (PENDING membership)
Academy Owner    ── approve ──▶  Membership APPROVED → access classes/resources
                 └─ reject  ──▶  Membership REJECTED (with reason)
```

## Frontend layout

```
src/
├── pages/                     # Top-level routes (lazy loaded in App.jsx)
├── components/
│   ├── academy/               # Owner & academy-specific widgets
│   ├── teacher/               # Teacher dashboard tabs & data hooks
│   ├── student/               # Student dashboard widgets
│   ├── super-admin/           # Layout + sidebar
│   └── common/                # Pagination, toasts, modals, etc.
├── contexts/                  # AuthContext, ToastContext
├── hooks/                     # useDebouncedValue, useProfileManager
└── utils/apiClient.js         # Wrapped fetch with auth, refresh, error normalization
```

State is local-first (React state + URL query). Auth context exposes `user`, `userDetails`, `isPending`, `login`, `logout`, `refreshProfile`.
