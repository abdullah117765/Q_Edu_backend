# Billing module

The billing module provides Stripe-powered checkout, subscriptions, customer portal, coupons and admin analytics on top of the Zoom credit ledger.

## Capabilities

- **Credit packages (one-time)** — `ZoomCreditPackage` rows mapped to Stripe products/prices. Purchases grant `credits + bonusCredits` to the buyer's `ZoomCreditBalance` and write a `CREDIT` `ZoomCreditTransaction`.
- **Subscription plans (recurring)** — `SubscriptionPlan` rows synced to Stripe. Active subscriptions are tracked in `Subscription` and renew automatically.
- **Coupons** — Platform-wide `Coupon` rows mirrored to Stripe (`coupons` + `promotion_codes`). Supports percent or fixed-amount discounts, scoped to packages, plans, or all checkouts. Validation endpoint computes the resolved discount before checkout.
- **Customer portal** — `POST /billing/portal` returns a Stripe-hosted URL for managing payment methods, invoices and cancelling subscriptions.
- **Notifications** — Successful payments, failed payments, subscription activations and coupon redemptions raise `Notification` rows and email notifications (when SMTP is configured). Super admins are also notified on every payment event.
- **Platform fee** — `PLATFORM_FEE_PERCENT` (default 10) is split out of every gross payment into `platformFeeAmount` and `netAmount` for accurate revenue reporting.

## Key endpoints

### Self-service (any authenticated user)

| Verb | Path | Description |
| --- | --- | --- |
| `GET` | `/api/billing/packages` | List active credit packages. |
| `GET` | `/api/billing/plans` | List active subscription plans. |
| `GET` | `/api/billing/me` | Credit balance, active subscription, recent payments, Stripe publishable key. |
| `POST` | `/api/billing/checkout/package` | Create a Stripe Checkout session for a credit pack. Body: `{ id, successUrl, cancelUrl, couponCode? }`. |
| `POST` | `/api/billing/checkout/plan` | Create a Stripe Checkout session for a subscription plan. |
| `POST` | `/api/billing/portal` | Open Stripe-hosted billing portal. Optional `?returnUrl=...`. |
| `POST` | `/api/billing/subscription/cancel` | Cancel current subscription at period end. |
| `GET` | `/api/billing/coupons/marketing` | Highlighted active coupons for marketing surfaces. |
| `POST` | `/api/billing/coupons/validate?kind=package\|plan&grossCents=N` | Body `{ code }`. Returns coupon + computed discount. |

### Admin (super admin)

| Verb | Path | Description |
| --- | --- | --- |
| `GET` | `/api/billing/admin/analytics?from&to` | Gross / fee / net totals, MRR, by-provider/package breakdowns. |
| `GET` | `/api/billing/admin/payments?from&to&status&...` | Paginated payment list. |
| `GET` | `/api/billing/admin/subscriptions?status&...` | Paginated subscriptions. |
| CRUD | `/api/billing/admin/packages` | Create / update / delete credit packages (also syncs to Stripe). |
| CRUD | `/api/billing/admin/plans` | Create / update / delete subscription plans. |
| CRUD | `/api/billing/admin/coupons` | Create / update / delete coupons. |

### Webhook

| Verb | Path | Description |
| --- | --- | --- |
| `POST` | `/api/billing/webhook` | Stripe webhook receiver. Validates the `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET`, persists every event to `StripeWebhookEvent` for idempotency, and dispatches:<br>• `checkout.session.completed` → grants credits or records subscription payment, redeems coupon, dispatches notifications.<br>• `customer.subscription.created/updated/deleted` → upserts `Subscription` row.<br>• `invoice.paid` → writes a `Payment` row (subscription renewal) and notifies the user.<br>• `invoice.payment_failed` → marks subscription `PAST_DUE`, notifies the user and admins. |

## Configuration

| Env var | Required | Default | Notes |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | yes (in prod) | — | `sk_live_...` or `sk_test_...`. |
| `STRIPE_PUBLISHABLE_KEY` | optional | — | Returned to the frontend through `/billing/me` so a single source of truth drives the UI. |
| `STRIPE_WEBHOOK_SECRET` | yes (in prod) | — | Used to verify `Stripe-Signature`. |
| `STRIPE_API_VERSION` | optional | `'2024-06-20'` | Pin a Stripe API version. |
| `STRIPE_DEFAULT_CURRENCY` | optional | `usd` | Used when a price is missing currency. |
| `PLATFORM_FEE_PERCENT` | optional | `10` | Whole-number percentage retained from gross. |
| `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` | optional | — | Default redirect targets if a request omits them. May contain `{CHECKOUT_SESSION_ID}`. |

## Data model summary

```
ZoomCreditPackage   ───┐
SubscriptionPlan    ───┼─► Stripe products + prices
Coupon              ───┘   (mirrored, durations supported)

User
 ├─ StripeCustomer (1:1)
 ├─ ZoomCreditBalance + ZoomCreditTransaction (ledger)
 ├─ Subscription (current + history)
 ├─ Payment        (every gross/fee/net event)
 └─ Notification   (in-app + email fan-out)

StripeWebhookEvent  ──► idempotency for replayed events
```

## Local development

1. Run `npx prisma migrate dev` to apply the latest migrations (notifications + billing).
2. Seed the catalog: `npm run seed:billing` (creates Stripe products if keys are present, falls back to local-only otherwise).
3. Start a Stripe CLI listener: `stripe listen --forward-to http://localhost:3000/api/billing/webhook` and copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
4. Trigger a test purchase from the React app at `/academy/billing`.
