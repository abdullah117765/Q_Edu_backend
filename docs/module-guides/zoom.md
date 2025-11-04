# Zoom Module Guide

## Purpose
Provide a server-side abstraction over Zoom's Server-to-Server OAuth API for creating, updating, deleting meetings and syncing participants.

## Key Behaviours

* **OAuth token retrieval** – uses account credentials to request a bearer token.
* **Endpoint normalisation** – any non-standard `ZOOM_OAUTH_URL` is coerced to `https://zoom.us/oauth/token`.
* **Automatic enablement** – if credentials exist, the service enables itself (even without `ZOOM_ENABLED=true`). Explicitly set `ZOOM_ENABLED=false` to force placeholder behaviour.
* **Fallback placeholder meetings** – when Zoom is unreachable or credentials invalid, the service issues a placeholder meeting with `https://meetings.local` URLs and logs a WARN message.
* **Logging** – DEBUG logs when requesting tokens (account ID redacted), ERROR logs for API failures, WARN logs for fallbacks/deletions.

## Public Methods

| Method | Description |
| ------ | ----------- |
| `createMeeting(hostId, payload)` | Returns `ZoomMeetingResponse`. Provisioned meeting is stored on class creation. |
| `updateMeeting(meetingId, payload)` | Applies updates if Zoom enabled; silently no-ops when disabled. |
| `deleteMeeting(meetingId)` | Attempts deletion; logs warning if fails. |
| `getMeeting(meetingId)` | Fetches meeting info, or returns placeholder when disabled. |
| `getMeetingParticipants(meetingId, options)` | Wraps Zoom reports endpoint for attendance sync. |

## Required Scopes

Ensure the Zoom account-level app has:
* `meeting:read:admin`
* `meeting:write:admin`
* `report:read:admin`

License: Host account must be licensed to schedule meetings longer than 40 minutes.

## Environment Variables

```
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_ENABLED=true               # optional; inferred if omitted
ZOOM_API_BASE_URL=https://api.zoom.us/v2
ZOOM_OAUTH_URL=https://zoom.us/oauth/token
```

## Troubleshooting

| Symptom | Cause | Resolution |
| ------- | ----- | ---------- |
| 404 during OAuth | OAuth URL incorrect | Verify it ends with `/oauth/token`; the service now normalises but double-check logs. |
| Placeholder URLs returned | Credentials invalid or Zoom unreachable | Check logs for `Failed to create Zoom meeting` or OAuth errors; update credentials. |
| Prisma failure “column too long” | Migrations not applied | Run `npx prisma migrate deploy` to ensure URL columns are widened. |
