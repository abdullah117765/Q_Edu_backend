# Academy Dashboard – Overview Data Contract

This document captures the current inventory of backend capabilities powering the academy dashboard and defines the API contract we will implement to replace the hard-coded “dummy” data on the front end. It focuses on the high-level overview screen (cards, activity feed, zoom credit summary) that is rendered immediately after login by academy owners.

---

## 1. Frontend Overview Requirements

The `OverviewTab` component expects the following data sets:

| Widget / Section | Data Needed | Notes |
| --- | --- | --- |
| KPI cards (Teachers, Students, Scheduled Classes, Zoom credits) | Total approved teachers, total approved students, count of upcoming classes, usable/used Zoom credits | Counts should reflect academy owner’s scope only. |
| Upcoming classes list (first 5) | Class id, title, teacher display name, scheduled start/end, timezone, status, participants count, join URL | Sorted by `scheduledStart`. |
| Zoom credit usage ring | Total credited, total debited, current balance | Should align with `/zoom-credits/:userId/summary`. |
| Subscription usage | Student limit vs. count, teacher limit vs. count, storage limit vs. used, zoom credit budget vs. used | Limits are plan-based; defaults currently baked in the front end. |
| Recent activity feed | Up to 10 items with type, timestamp, summary text (e.g., “Jane Doe approved as Teacher”, “Class Algebra 101 scheduled for Mon, 4pm”) | Derived from classes, user approvals and credit transactions. |
| Meta information | Academy display name, owner name/email, last refreshed timestamp | Displayed at top of sidebar/header. |

The React hook `useAcademyData` currently composes these metrics from multiple calls and hard-coded fallbacks. Our goal is to supply one dedicated endpoint that returns a single payload describing everything above to simplify the client and avoid inconsistent data.

---

## 2. Existing Backend Inventory

| Namespace | Endpoint | What It Provides Today | Gaps for Overview |
| --- | --- | --- | --- |
| `classes` | `GET /classes` with filters | Paginates classes and includes teacher relation + participant counts. | No aggregation, requires multi requests for counts & upcoming subset. |
| `users` | `GET /users/teachers`, `GET /users/students` | Paginated role-specific results with filters. | Need only counts for approved users; current response wraps data in pagination envelope. |
| `zoom-credits` | `GET /zoom-credits/:userId/summary` | Balance, credited, debited per user. | Requires owner user id each time; client currently calls directly. |
| `zoom-credits` | `GET /zoom-credits/:userId/transactions` | Paginated history. | We only need last few items for activity feed. |
| `auth` / `users` | `GET /users/:id` | Full profile for one user. | Works for header details. |
| *(none)* | *(inventory of subscription limits, storage usage, academy metadata)* | N/A | Needs to be computed (limits are static for now). |
| *(none)* | *(recent activity abstraction)* | N/A | Must be composed by backend. |

Conclusion: The dashboard requires multiple calls plus client-side aggregation. We will implement a server-side orchestrator to produce a cohesive snapshot.

---

## 3. Proposed Endpoint – `GET /dashboard/overview`

### Rationale

- Keeps URL owner-agnostic (the authenticated user context is sufficient).
- Allows us to reuse existing services (classes, users, zoom credits) behind the scenes and cache the result per user.
- Simplifies the front end to a single request with clear loading/error handling.

### Authentication & Authorization

- Guard: `@Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)`
- The Prisma queries will scope results to the requesting user (academy owner) once ownership relationships are modeled. For now, counts will cover global collections until tenancy metadata exists.

### Request

```
GET /dashboard/overview
Authorization: Bearer <access-token>
Accept: application/json
```

No query parameters required initially. Future extensions may include `?forceRefresh=true` to bypass caches.

### Successful Response

```json
{
  "data": {
    "academy": {
      "id": "user-123",
      "name": "Jane Doe Academy",
      "ownerEmail": "owner@example.com",
      "ownerName": "Jane Doe",
      "updatedAt": "2025-10-17T11:42:01.281Z"
    },
    "totals": {
      "teachers": {
        "approved": 12,
        "pending": 3
      },
      "students": {
        "approved": 180,
        "pending": 12
      },
      "classes": {
        "upcoming": 4,
        "ongoing": 1,
        "completedLast30Days": 16
      }
    },
    "upcomingClasses": [
      {
        "id": "cls_01HEQ...",
        "title": "Geometry Foundations",
        "teacher": {
          "id": "usr_teacher1",
          "name": "Alex Rivera",
          "email": "alex@example.com"
        },
        "scheduledStart": "2025-10-18T14:00:00.000Z",
        "scheduledEnd": "2025-10-18T15:00:00.000Z",
        "timezone": "America/New_York",
        "participantsCount": 24,
        "status": "UPCOMING",
        "zoomJoinUrl": "https://zoom.us/j/123..."
      }
    ],
    "subscription": {
      "plan": "Professional",
      "limits": {
        "students": 200,
        "teachers": 25,
        "storageGb": 100
      },
      "usage": {
        "students": 180,
        "teachers": 12,
        "storageGb": 48.5
      }
    },
    "zoomCredits": {
      "balance": 1200,
      "totalCredited": 5000,
      "totalDebited": 3800,
      "recentTransactions": [
        {
          "id": "txn_01HF...",
          "timestamp": "2025-10-17T09:15:12.812Z",
          "type": "DEBIT",
          "amount": 200,
          "summary": "Zoom usage for class Algebra 101"
        }
      ]
    },
    "recentActivity": [
      {
        "id": "activity_01",
        "timestamp": "2025-10-17T10:05:19.004Z",
        "type": "class_scheduled",
        "message": "Scheduled “Physics Lab” for Oct 19, 11:00 AM."
      },
      {
        "id": "activity_02",
        "timestamp": "2025-10-16T17:43:54.221Z",
        "type": "user_approved",
        "message": "Approved John Smith as Teacher."
      }
    ]
  }
}
```

### Error Responses

| Status | Body | Trigger |
| --- | --- | --- |
| `401 Unauthorized` | `{ "status": "error", "message": "Unauthorized", "code": 401 }` | Missing/invalid JWT |
| `403 Forbidden` | `{ "status": "error", "message": "Access denied for this role.", "code": 403 }` | Role not permitted |
| `500 Internal Server Error` | Standard global filter response | Unexpected errors from downstream services |

### Aggregation Details

| Field | Computation |
| --- | --- |
| `totals.teachers.approved` | `prisma.user.count({ where: { role: TEACHER, status: APPROVED } })` |
| `totals.students.approved` | `prisma.user.count({ where: { role: STUDENT, status: APPROVED } })` |
| `totals.classes.upcoming` | `prisma.class.count({ where: { status: UPCOMING, scheduledStart: { gte: now } } })` |
| `upcomingClasses` | `prisma.class.findMany({ where: { status: UPCOMING }, include: teacher, orderBy: scheduledStart ASC, take: 5 })` |
| `recentActivity` | Merge of: last 5 approved users (derived), last 5 classes created, last 5 credit transactions -> sorted by timestamp, truncated to 10. |
| `subscription.limits` | For now: constants (same as `DEFAULT_SUBSCRIPTION_LIMITS` in client). Leave room for future DB fields. |
| `subscription.usage.storageGb` | Placeholder derived from `classes.length * 0.5` until storage data model exists. |
| `zoomCredits.*` | `ZoomCreditsService.getSummary` + first 5 entries from `getTransactions`. |

Caching strategy (optional implementation detail): store response in-memory per user for 30 seconds to reduce load when the dashboard is revisited frequently.

---

## 4. Frontend Changes Overview

Once the endpoint is available, `useAcademyData` will:

1. Replace the multi-request `Promise.all` with a single `apiRequest('/dashboard/overview')` call.
2. Map the payload into the existing state slices (`academyData`, `subscriptionUsage`, `classes`, `zoomCredits`, etc.).
3. Remove baked-in defaults (`DEFAULT_SUBSCRIPTION_LIMITS`, manual recent activity builder) in favour of server values.
4. Keep loading/error handling identical for UX stability.

We will implement these updates as part of Step 2 alongside the backend endpoint.

---

## 5. Acceptance Checklist for Step 1

- [x] Documented every overview widget and the data it needs.
- [x] Audited existing APIs and identified missing pieces.
- [x] Defined the new `GET /dashboard/overview` endpoint, response schema, and error handling.
- [x] Clarified planned frontend adjustments.
- [x] Ready to proceed with backend/frontend implementation (Step 2).
