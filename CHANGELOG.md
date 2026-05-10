# Changelog

All notable changes to the Q Edu backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Notifications**: new `Notification` Prisma model with `NotificationType` enum (`PAYMENT_RECEIVED`, `PAYMENT_FAILED`, `SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_CANCELLED`, `COUPON_REDEEMED`, `MEMBERSHIP_PENDING`, `MEMBERSHIP_APPROVED`, `MEMBERSHIP_REJECTED`, `GENERIC`).
  - `NotificationsModule` exposing `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`.
  - `BillingService` now dispatches notifications on Stripe `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, subscription activation and coupon redemption (also broadcasts to active super admins).
  - `UsersService.updateStatus` notifies the affected teacher/student when their membership is approved, rejected or set to pending.
- **Owner-scoped membership management**: `ACADEMY_OWNER`s can now approve/reject their own teachers and students through `PATCH /api/users/:id/status`. Newly created teachers/students by an owner are auto-linked as `PENDING` `AcademyMembership` rows in the owner's academy.
- **Credit usage trend**: `GET /api/zoom-credits/me/usage-trend?days=N` returns per-day credited/debited/net totals (1–365 days, default 30) for the authenticated user.
- **Contact inbox backend**: new `ContactMessage` model + `ContactMessagesModule`.
  - Public submit endpoint: `POST /api/contact-messages`.
  - Super-admin inbox endpoints: `GET /api/contact-messages/admin`, `PATCH /api/contact-messages/admin/:id/status`, `PATCH /api/contact-messages/admin/:id/read`.

### Stripe billing — initial release

- Full integration with checkout, webhooks, customer portal and subscription management.
  - New Prisma models: `ZoomCreditPackage`, `SubscriptionPlan`, `Subscription`, `StripeCustomer`, `StripeWebhookEvent`.
  - New `Payment` columns: `platformFeeAmount`, `netAmount`, `description`, `packageId`, `subscriptionId`.
  - `StripeModule` (global) wrapping the Stripe SDK; lazy-initialised when `STRIPE_SECRET_KEY` is present.
  - `BillingModule` exposing:
    - `GET /billing/packages`, `GET /billing/plans` — public catalogs.
    - `GET /billing/me` — credit balance, current subscription and recent payments.
    - `POST /billing/checkout/package`, `POST /billing/checkout/plan` — Stripe Checkout sessions.
    - `POST /billing/portal` — Stripe customer billing portal.
    - `POST /billing/subscription/cancel` — cancel at period end.
    - `GET /billing/admin/analytics` — gross/fee/net totals, MRR, by-provider/package breakdowns (super admin only).
    - Admin CRUD for credit packages and subscription plans.
  - Webhook receiver at `POST /api/billing/webhook` with raw-body signature verification and idempotent event storage.
  - Configurable platform fee (`PLATFORM_FEE_PERCENT`, default 10%) automatically split into `platformFeeAmount` / `netAmount` on every payment.
  - Seed script `prisma/seed-billing.ts` provisions four credit packs (Starter/Pro/Scale/Enterprise) and five subscription plans (Free, Pro/Scale × monthly + yearly), syncing products+prices to Stripe when keys are present.
  - Tests: `stripe.service.spec.ts` covering platform-fee math and config flags.
- `@nestjs/throttler` global guard (60 req/min per IP) plus stricter limits on auth endpoints (login/register 5/min, OTP & password endpoints 3-5/min).
- `@NoEmoji()` class-validator decorator backed by Unicode property escapes; applied to identity fields (name, email, phone, gender).
- `UsersDirectoryQueryDto` so the Super Admin Directory can filter `/users` by `status` and `search`.
- `academy` field on `UserEntity` exposing the owner's academy `id`, `name`, `status` for accurate dashboard display.
- Docs: `architecture.md`, `security.md`, `api-reference.md`, `production-readiness.md`.

### Changed

- `UsersService.findAll` and `findByRole` now include the owner's academy and the user's approved academy memberships, fixing missing/incorrect academy names in the User Management list.
- `GET /api/users` now excludes `SUPER_ADMIN` rows from directory results by default and supports backend filters `role`, `academyId`, and `ownerId` in addition to `status` and `search`.
- Production input length limits: name ≤ 80, bio ≤ 500, phone ≤ 32, email ≤ 254, password ≤ 128, gender ≤ 64.
- `GET /users/students` now masks student emails as `a***@domain.com` when the caller is a `TEACHER`.
- `GET /api/billing/admin/analytics` now supports `interval=day|week|month` and optional `provider`, returning `timeSeries` points for chart-based dashboards.

### Fixed

- "property status should not exist" 400 when filtering the Super Admin Directory.
- Super Admin academy preview previously showed user-status (always APPROVED for owners) instead of the academy review status.
