# Zoom Credits Module Guide

## Purpose
Track credit usage for Zoom meetings so academies can monitor consumption and remain within plan limits.

## Core Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/zoom-credits/transactions` | Paginated credit transactions for current academy/owner. |
| `POST` | `/zoom-credits/transactions` | Adjust credits (debit or credit) – typically invoked internally. |

## Integration with Classes

* `ClassesService.create` calls `zoomCreditsService.adjustCredits` with operation `DEBIT` when `creditsConsumed > 0`.
* Credits are recorded with metadata (`classId`, `scheduledStart`, reason).
* Refunds or manual adjustments can be added via admin tooling (future extension).

## Frontend Touchpoints

* Academy owner dashboard `Payments/Credits` tab displays recent transactions and remaining balance.
* Overview cards in `dashboard/overview` show aggregate `zoomCredits.limit` and `zoomCredits.used`.

## Troubleshooting

| Symptom | Cause | Resolution |
| ------- | ----- | ---------- |
| Credits not deducted | `creditsConsumed` not set in class payload or transaction failed; check backend logs. |
| Negative balance | Owner exceeded plan; adjust plan or top up credits. |
| Transactions missing from dashboard | Ensure `/dashboard/overview` is invoked; if still missing, query `/zoom-credits/transactions` directly to inspect data. |
