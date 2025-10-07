# Classes & Zoom Credits API Guide

This document summarizes the production-ready endpoints introduced for the Classes and Zoom Credits modules, along with notes to integrate the frontend dashboard.

## Environment Variables

| Variable | Description |
| --- | --- |
| `ZOOM_ACCOUNT_ID` | Zoom server-to-server OAuth account identifier. |
| `ZOOM_CLIENT_ID` | Zoom OAuth client ID. |
| `ZOOM_CLIENT_SECRET` | Zoom OAuth client secret. |
| `ZOOM_API_BASE_URL` | Optional override for Zoom API base URL _(defaults to `https://api.zoom.us/v2`)_. |
| `ZOOM_OAUTH_URL` | Optional override for Zoom OAuth token URL _(defaults to `https://zoom.us/oauth/token`)_. |

## Classes Module

Base path: `/api/classes`

### Create Class
- **POST** `/`
- **Body**: `CreateClassDto`
  ```json
  {
    "title": "Japanese 101",
    "description": "Introductory session",
    "teacherId": "ck_teacher_123",
    "scheduledStart": "2025-01-10T14:00:00.000Z",
    "scheduledEnd": "2025-01-10T15:00:00.000Z",
    "timezone": "America/New_York",
    "creditsConsumed": 30,
    "participants": [
      { "userId": "student_01" },
      { "email": "guest@example.com", "displayName": "Guest" }
    ],
    "zoomSettings": {
      "waiting_room": true,
      "host_video": true
    }
  }
  ```
- **Response**: `ClassEntity`
- Creates the class record, provisions a Zoom meeting, and stores any seed participants.

### List Classes
- **GET** `/`
- **Query**: `page`, `limit`, `status`, `teacherId`, `search`, `from`, `to`
- **Response**: `PaginatedClassesResponseDto`

### Retrieve Class
- **GET** `/:id`
- **Response**: `ClassEntity` including aggregated participant count and teacher summary.

### Update Class
- **PATCH** `/:id`
- **Body**: `UpdateClassDto`
- Syncs updates to Zoom. If `creditsConsumed` increases, the delta is debited from the teacher via the Zoom Credits module.

### Delete Class
- **DELETE** `/:id`
- Removes the class, cascading participants, and attempts to delete the associated Zoom meeting.

### Participants (Optimised via Raw SQL)
- **GET** `/:id/participants`
- **Query**: `page`, `limit`, `search`
- Uses `Prisma.$queryRaw` for efficient pagination over large participant sets.
- **Response**: `PaginatedClassParticipantsResponseDto`

### Sync Participants from Zoom
- **POST** `/:id/sync-participants`
- Fetches meeting participants from Zoom (`/report/meetings/{id}/participants`) and replaces local records.

## Zoom Credits Module

Base path: `/api/zoom-credits`

### Adjust Credits
- **POST** `/transactions`
- **Body**:
  ```json
  {
    "userId": "teacher_123",
    "operation": "credit", // or "debit"
    "amount": 100,
    "reason": "Monthly allocation",
    "metadata": { "source": "manual" }
  }
  ```
- **Response**: `ZoomCreditTransactionEntity`
- Audit logs are persisted for every transaction.

### Transfer Credits
- **POST** `/transfer`
- Debits the origin user and credits the destination user atomically.
- **Response**: `{ outbound: ZoomCreditTransactionEntity, inbound: ZoomCreditTransactionEntity }`

### User Summary
- **GET** `/:userId/summary`
- **Response**: `ZoomCreditSummaryEntity`
  ```json
  {
    "userId": "teacher_123",
    "totalCredited": 500,
    "totalDebited": 320,
    "balance": 180,
    "updatedAt": "2025-01-01T10:15:00.000Z"
  }
  ```

### Transaction History
- **GET** `/:userId/transactions`
- **Query**: `page`, `limit`, `type`
- **Response**: `PaginatedZoomCreditTransactionsResponseDto`

## Database & Performance

- Prisma schema introduces `Class`, `ClassParticipant`, `ZoomCreditBalance`, `ZoomCreditTransaction`, and `ZoomCreditAuditLog` models with relevant indexes on `teacherId`, `zoomMeetingId`, and `classId`.
- Participant pagination uses raw SQL (`$queryRaw`) for windowed counts, ensuring scalability for large meetings.
- Zoom access tokens are cached in-memory and auto-refreshed one minute before expiry.

## Frontend Integration Notes

- Replace dummy state in `SaaS/src/components/academy/useDummyData.js` with calls to:
  - `GET /api/classes?status=upcoming` (repeat with other filters) for class lists.
  - `GET /api/classes/:id` for modal details.
  - `GET /api/classes/:id/participants` for attendance views.
  - `GET /api/zoom-credits/:userId/summary` and `.../transactions` for Zoom credit dashboard statistics.
- All endpoints return payloads wrapped by the global response interceptor: `{ "status": "success", "data": ... }`.
- Ensure requests forward the bearer token so the `@Auth` guard can authorise academy owners/teachers.

## Error Handling & Logging

- Input validation relies on `class-validator`; detailed messages bubble up through the global exception filter.
- Zoom API errors surface as `502 Bad Gateway` with generic messaging, while the service logs full details for observability.
- Credit deductions that fail (e.g., insufficient balance) emit structured logs and abort the class update.

## Testing

- Unit tests cover:
  - Credit adjustments and overdraft protection in `ZoomCreditsService`.
  - Credit deductions during class updates in `ClassesService`.
- Execute with `npm test` (see new spec files under `src/modules/classes` and `src/modules/zoom-credits`).
