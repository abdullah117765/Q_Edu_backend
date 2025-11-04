# Q Edu Platform – Feature & Flow Guide

This guide provides the panoramic view of the Q Edu platform, summarising backend capabilities, frontend flows, deployment practices, and integration touchpoints.  
Each backend module also has a dedicated companion document under `docs/module-guides/` for deep dives into DTOs, endpoints, UI interactions, and troubleshooting.  
When you need a Word document, convert this Markdown file with `pandoc docs/platform-feature-guide.md -o platform-feature-guide.docx`.

---

## 1. System Overview

| Area | Technologies | Notes |
| ---- | ------------ | ----- |
| Frontend | React 18, Vite, TailwindCSS, Framer Motion | Lives in `SaaS/`; implements dashboards per persona. |
| Backend | NestJS, Prisma ORM, MySQL/MariaDB | Resides in `Q_Edu_backend/`; REST API served under `/api`. |
| Auth | JWT access tokens + refresh tokens | Managed by `AuthContext` (frontend) and `AuthModule` (backend). |
| Storage | Local filesystem by default | Configurable via `FILE_STORAGE_*`; assets served from `/storage`. |
| Integrations | Zoom Server-to-Server OAuth | Class scheduling provisions Zoom meetings when credentials are present. |

### Personas

1. **Super Administrator** – governs the entire platform, manages academies and global settings.
2. **Academy Owner** – owns a single academy, onboards staff/students, monitors usage and credits.
3. **Teacher** – schedules classes, uploads resources, tracks students.
4. **Student** – joins sessions, accesses resources, views progress.

---

## 2. Backend Feature Map

A concise map of modules and their responsibilities (see `docs/module-guides/*.md` for details).

| Module | Purpose | Key Endpoints |
| ------ | ------- | ------------- |
| `auth` | Authentication, OTP flows, change password | `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/change-password` |
| `users` | CRUD for all roles, profile management | `/users`, `/users/teachers`, `/users/students`, `/users/me` |
| `academies` | Academy lifecycle, onboarding, memberships | `/academies`, `/academies/owner/onboarding`, `/academies/memberships` |
| `classes` | Scheduling, Zoom integration, participants | `/classes`, `/classes/:id`, `/classes/:id/participants` |
| `dashboard` | Aggregated metrics for owner/teacher dashboards | `/dashboard/overview` |
| `zoom-credits` | Credit ledger for Zoom usage | `/zoom-credits/transactions` |
| `resources` | Upload + manage learning materials | `/resources` |
| `zoom` | S2S OAuth, meeting provisioning | Internal service, no direct routes |

Cross-cutting behaviour:

* **Prisma transactions** guarantee consistency during class creation, membership approval, etc.
* **Date & ownership checks** ensure teachers belong to the academy before scheduling classes.
* **Zoom fallback**: if credentials are missing or Zoom returns an error, placeholder meetings are issued (with clear WARN logs) so teachers can keep scheduling while admins remediate credentials.

---

## 3. Frontend Flow Summary

### Authentication

1. User submits credentials (`/auth/login`).
2. Backend issues access & refresh tokens; frontend stores them via `auth/apiClient`.
3. `AuthContext` rehydrates sessions on page load and exposes `user`, `userRole`, and helpers.

### Super Admin Dashboard (`/super-admin/dashboard`)

* Overview cards for pending academies, teacher/student counts.
* Workflow: review academy onboarding → approve/reject users → adjust platform settings.

### Academy Owner Dashboard (`/academy/dashboard`)

* Tabs: Overview, Users, Classes, Resources, Payments/Credits, Profile.
* `UsersTab` includes expanded cards (avatar, contact, membership) and “View profile” modal.
* Credit usage synced with Zoom transactions; owners can purchase additional credits.

### Teacher Dashboard (`/teacher/dashboard`)

* Tabs: My Classes, Students, Resources, Academies, Profile.
* Class form triggers backend scheduling → Zoom meeting.  
  * On success: real `join`/`start` URLs stored.  
  * On Zoom failure: placeholder URLs recorded + WARN log.
* Student tab offers filtering by status/search/academy, with inline badges per membership.

### Student Dashboard (`/student/dashboard`)

* Sections: Metrics, Class Schedule, Teachers, Resources, Academies, Profile.
* Schedule table now shows “Join class” buttons when a session is upcoming and has a valid `zoomJoinUrl`.
* If user lacks academy membership, a prompt directs them to the academy directory.

### Profile Management (Shared)

* `ProfileTab` provides contact details, address, “choose your vibe” gender selector.
* `useProfileManager` keeps session state in sync with backend JSON.

---

## 4. Zoom Integration Essentials

* **Credentials**: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`.
* **Optional flag**: `ZOOM_ENABLED=true`. If omitted, the service enables itself automatically when all credentials exist.
* **OAuth URL normalisation**: any misconfigured value is coerced to `https://zoom.us/oauth/token` (with a warning log) so the OAuth flow succeeds.
* **Token logging**: debug logs reveal when the token is requested and which account ID is used (redacted).
* **Database schema**: `zoomJoinUrl` and `zoomStartUrl` are `VARCHAR(512)` (see migration `20251103100000_expand_zoom_urls`) to store full Zoom URLs without truncation.
* **Placeholder meetings**: created only when Zoom is unreachable; warn logs direct operators to check credentials.

---

## 5. Environment & Deployment Checklist

| Step | Command | Notes |
| ---- | ------- | ----- |
| Install deps | `npm install` (backend & frontend) | Run separately in each project root. |
| Apply migrations | `npx prisma migrate dev` (or `... deploy` in CI) | Includes zoom URL column expansion. |
| Run backend | `npm run start:dev` | Exposes API at `http://localhost:3000/api`. |
| Run frontend | `npm run dev` | Vite default port `5173`. |
| Build for production | `npm run build` | Both backend and frontend supply build commands. |
| Convert docs to Word | `pandoc docs/platform-feature-guide.md -o platform-feature-guide.docx` | Optional for stakeholders. |

Backend `.env` essentials:

```
DATABASE_URL=mysql://user:pass@host:3306/qedu
JWT_ACCESS_SECRET=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASSWORD=...
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_ENABLED=true
FILE_STORAGE_PUBLIC_URL=http://localhost:3000/storage
```

Frontend `.env`:

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_ASSET_BASE_URL=http://localhost:3000
```

---

## 6. Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
| ------- | ------------ | ---- |
| Placeholder meeting URL in class schedule | Zoom credentials invalid or Zoom unreachable (fallback triggered) | Confirm `ZOOM_*` vars, check logs for OAuth errors, restart backend after updating credentials. |
| Prisma error: `value too long for column zoomStartUrl` | Database not migrated to wider column | Run `npx prisma migrate deploy` to apply `20251103100000_expand_zoom_urls`. |
| 403 when teachers create classes | Teacher not approved for academy | Approve membership or perform action as owner/super admin. |
| Student sees empty schedule | Student not enrolled or filters misconfigured | Approve membership; verify `/classes` response and frontend filters. |
| Broken emojis in profile “vibe” selector | Platform font lacks certain emoji glyphs | Provide fallback fonts or replace emoji in UI copy. |

---

## 7. Document Index

The following module guides expand on the summaries above:

* `docs/module-guides/auth.md`
* `docs/module-guides/users.md`
* `docs/module-guides/academies.md`
* `docs/module-guides/classes.md`
* `docs/module-guides/dashboard.md`
* `docs/module-guides/resources.md`
* `docs/module-guides/zoom.md`

Each file lists primary DTOs, request/response contracts, UI integrations, and module-specific troubleshooting tips.

---

_Maintained by the Q Edu engineering team. Update this guide whenever new flows or modules are added._ 
