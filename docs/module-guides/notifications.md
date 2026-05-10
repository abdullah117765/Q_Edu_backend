# Notifications module

In-app + email notification system. Backed by the `Notification` Prisma model and exposed under `/api/notifications`.

## Endpoints

| Verb | Path | Description |
| --- | --- | --- |
| `GET` | `/api/notifications?unreadOnly=true&take=20&skip=0` | Lists the caller's notifications (newest first). Returns `{ items, total, unread, take, skip }`. |
| `PATCH` | `/api/notifications/:id/read` | Marks a single notification as read. 404 if the notification does not belong to the caller. |
| `POST` | `/api/notifications/read-all` | Marks all of the caller's unread notifications as read. Returns `{ updated }`. |

All endpoints require an authenticated user (any role).

## Notification types

| Type | Source |
| --- | --- |
| `PAYMENT_RECEIVED` | Stripe `checkout.session.completed` (package), `invoice.paid` (subscription). |
| `PAYMENT_FAILED` | Stripe `invoice.payment_failed`. |
| `SUBSCRIPTION_ACTIVATED` | Stripe `checkout.session.completed` (subscription). |
| `SUBSCRIPTION_CANCELLED` | Reserved for future cancellation events. |
| `COUPON_REDEEMED` | When a coupon is redeemed at checkout. |
| `MEMBERSHIP_PENDING` / `MEMBERSHIP_APPROVED` / `MEMBERSHIP_REJECTED` | `UsersService.updateStatus` for `TEACHER` / `STUDENT` users. |
| `GENERIC` | Fallback for ad-hoc notifications. |

## Dispatching from other modules

`NotificationsService` exports `notify({ userId, type, title, body, data, email })`. Email is best-effort and does not block the DB write. Failed sends are logged and swallowed.

```ts
await this.notifications.notify({
  userId,
  type: 'PAYMENT_RECEIVED',
  title: 'Payment received',
  body: '+100 Zoom credits added to your balance.',
  data: { packageId, credits: 100 },
});
```

`BillingService` provides two private helpers:

- `safeNotify(userId, type, title, body, data)` — single user, swallows errors.
- `notifyAdmins(type, title, body, data)` — fan-out to every active `SUPER_ADMIN`.

## Frontend integration

- `src/utils/notificationsApi.js` exposes `listNotifications`, `markNotificationRead`, `markAllNotificationsRead`.
- `Navbar.jsx` polls every 30 seconds for the unread count and renders a red badge on the bell.
- `/notifications` (lazy `NotificationsPage.jsx`) lists notifications with All / Unread filters and per-row + bulk read actions.
