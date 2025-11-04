# Dashboard Module Guide

## Purpose
Expose aggregated metrics used by academy owner and teacher dashboards.  
Pulls counts from classes, memberships, zoom credit usage, and resources.

## Core Endpoint

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/dashboard/overview` | Returns summary for the authenticated user (role-aware). |

### Response Structure (simplified)

```json
{
  "academy": {
    "id": "...",
    "name": "...",
    "studentCount": 42,
    "teacherCount": 5,
    "pendingCount": 3
  },
  "classes": {
    "upcoming": 4,
    "ongoing": 0,
    "ended": 12,
    "cancelled": 1
  },
  "zoomCredits": {
    "limit": 100,
    "used": 32,
    "recentTransactions": [...]
  },
  "notifications": [...],
  "resources": {
    "total": 18,
    "recent": [...]
  }
}
```

## Frontend Usage

* Academy owner dashboard overview cards.
* Teacher dashboard hero metrics (total classes, upcoming sessions).
* Notification panels (if enabled) display latest items.

## Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| Empty metrics for owner | Owner hasn’t completed onboarding → no academy ID. |
| Teacher sees zero classes | `/classes` query empty; verify teacher membership and class status filters. |
| Credit usage stale | Ensure `zoomCreditsService.adjustCredits` runs during class creation; check logs for failures. |
