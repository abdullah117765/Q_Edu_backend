# API Reference

> Base URL (dev): `http://localhost:3000/api`
> Swagger UI: `http://localhost:3000/docs` (disabled when `NODE_ENV=production`)

All non-auth endpoints require `Authorization: Bearer <accessToken>` (or the auth cookie set by `/auth/login`).

## Conventions

- Pagination: `?page=<int>&limit=<int>` (defaults `1`, `25`; max `limit=100`).
- Response shape:
  ```json
  { "data": ..., "meta": { "total": 0, "currentPage": 1, "totalPages": 1, "nextPage": null, "previousPage": null }, "summary": { ... } }
  ```
- Errors: `{ "statusCode": 400, "message": "...", "error": "Bad Request" }`

## Auth — `/auth`

| Method | Path               | Roles | Description                                      |
| ------ | ------------------ | ----- | ------------------------------------------------ |
| POST   | `/register`        | —     | Create account, sends OTP. Throttled 5/min.      |
| POST   | `/verify-otp`      | —     | Activate account. Throttled 5/min.               |
| POST   | `/resend-otp`      | —     | Resend OTP. Throttled 3/min, 60s cooldown.       |
| POST   | `/login`           | —     | Returns tokens, sets cookies. Throttled 5/min.   |
| POST   | `/refresh`         | —     | Rotates refresh token, returns new access token. |
| POST   | `/logout`          | any   | Revokes refresh tokens.                          |
| POST   | `/forgot-password` | —     | Sends reset OTP. Throttled 3/min.                |
| POST   | `/reset-password`  | —     | Consumes OTP. Throttled 5/min.                   |
| PATCH  | `/change-password` | any   | Requires current password.                       |

## Users — `/users`

| Method | Path          | Roles                                        | Description                                                                          |
| ------ | ------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/`           | SUPER_ADMIN, ACADEMY_OWNER                   | Directory; supports `?status=&search=`.                                              |
| GET    | `/admins`     | SUPER_ADMIN                                  | Lists academy owners with summary counts.                                            |
| GET    | `/teachers`   | SUPER_ADMIN, ACADEMY_OWNER, TEACHER, STUDENT | List teachers (students only see APPROVED).                                          |
| GET    | `/students`   | SUPER_ADMIN, ACADEMY_OWNER, TEACHER          | List students (teachers see masked emails).                                          |
| GET    | `/me`         | any                                          | Current user profile.                                                                |
| PATCH  | `/me`         | any                                          | Update profile fields.                                                               |
| PATCH  | `/me/photo`   | any                                          | Multipart upload (≤5 MB, png/jpg/gif/webp).                                          |
| GET    | `/:id`        | any (scoped)                                 | Fetch single user. Non-elevated roles can only fetch self or shared-academy members. |
| PATCH  | `/:id`        | SUPER_ADMIN, ACADEMY_OWNER                   | Update user.                                                                         |
| PATCH  | `/:id/status` | SUPER_ADMIN                                  | Approve/Reject (rejection requires `rejectionReason`).                               |
| DELETE | `/:id`        | SUPER_ADMIN                                  | Hard delete.                                                                         |
| POST   | `/admins`     | SUPER_ADMIN                                  | Create academy owner.                                                                |
| POST   | `/teachers`   | SUPER_ADMIN, ACADEMY_OWNER                   | Create teacher.                                                                      |
| POST   | `/students`   | SUPER_ADMIN, ACADEMY_OWNER                   | Create student.                                                                      |

## Academies — `/academies`

| Method | Path                            | Roles                      | Description                             |
| ------ | ------------------------------- | -------------------------- | --------------------------------------- | --------------------- |
| GET    | `/`                             | any                        | Public directory of approved academies. |
| GET    | `/me`                           | ACADEMY_OWNER              | Owner's academy detail.                 |
| POST   | `/owner/onboarding`             | ACADEMY_OWNER              | Submit/refresh academy details.         |
| GET    | `/admin`                        | SUPER_ADMIN                | Admin listing with status summary.      |
| GET    | `/admin/:id`                    | SUPER_ADMIN                | Academy detail.                         |
| PATCH  | `/admin/:id/review`             | SUPER_ADMIN                | `{ status: APPROVED                     | REJECTED, reason? }`. |
| POST   | `/:id/membership`               | TEACHER, STUDENT           | Request membership.                     |
| GET    | `/:id/members`                  | ACADEMY_OWNER, SUPER_ADMIN | List members.                           |
| PATCH  | `/:id/members/:memberId/status` | ACADEMY_OWNER, SUPER_ADMIN | Approve/reject membership.              |

## Classes — `/classes`

| Method | Path                     | Roles                  | Description                                                         |
| ------ | ------------------------ | ---------------------- | ------------------------------------------------------------------- |
| POST   | `/`                      | TEACHER, ACADEMY_OWNER | Schedule (provisions Zoom meeting if enabled).                      |
| GET    | `/`                      | any                    | Scoped list. Filters: `academyId`, `teacherId`, `status`, `search`. |
| GET    | `/:id`                   | any (scoped)           | Class detail with participants.                                     |
| PATCH  | `/:id`                   | TEACHER, ACADEMY_OWNER | Update class.                                                       |
| DELETE | `/:id`                   | TEACHER, ACADEMY_OWNER | Cancel class.                                                       |
| GET    | `/:id/participants`      | scoped                 | Paginated participants (`?search=`).                                |
| POST   | `/:id/participants/sync` | scoped                 | Pulls latest attendance from Zoom.                                  |

## Resources — `/resources`

CRUD over teacher-uploaded materials with academy-scoped visibility.

## Payments — `/payments`

- `GET /` — list payments with summary totals.
- `POST /` — create payment intent.
- `GET /summary` — admin summary metrics.

## Zoom credits — `/zoom-credits`

- `GET /` — current academy credit balance and ledger.
- `POST /` — admin grants credits.

## Dashboard — `/dashboard`

- `GET /overview` — totals (teachers, students, academies, payments).

For the **complete** request/response schemas, see Swagger UI at `/docs`.
