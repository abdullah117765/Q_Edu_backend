# Classes Module Guide

## Purpose
Schedule, update, and delete classes; integrate with Zoom for meeting provisioning; manage participants.

## Core Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/classes` | Create a class (owner or approved teacher). |
| `GET` | `/classes` | List classes with filters (status, date range, academy). |
| `GET` | `/classes/:id` | Retrieve class detail (includes teacher summary & participant count). |
| `PATCH` | `/classes/:id` | Update class metadata; syncs Zoom meeting if enabled. |
| `DELETE` | `/classes/:id` | Cancel a class; removes Zoom meeting if possible. |
| `GET` | `/classes/:id/participants` | Paginated participant listing (reporting). |
| `POST` | `/classes/:id/sync-participants` | Pull attendees from Zoom report. |

## Create Flow Details

1. Validate `scheduledStart`/`scheduledEnd` and teacher/academy relationship.
2. For teachers, enforce that the selected academy membership is approved.
3. Call `ZoomService.createMeeting` to provision meeting (or fallback) and capture:
   * `zoomMeetingId`, `zoomJoinUrl`, `zoomStartUrl`, `zoomHostId`, `zoomPassword`, `zoomUuid`.
4. Persist class via Prisma transaction.  
   * After widening columns, `zoomJoinUrl` & `zoomStartUrl` allow up to 512 characters.
5. Optionally add participants (`classParticipant.createMany`).
6. Deduct Zoom credits via `ZoomCreditsService` (if configured).

## Frontend Touchpoints

* Teacher dashboard `TeacherClassesTab` orchestrates creation & updating.
* Student dashboard reads `zoomJoinUrl` to expose “Join class” button.
* Academy owner overview aggregates stats derived from class status counts.

## Zoom Integration Notes

* OAuth token fetched automatically; logs include redacted account ID.
* Fallback placeholder meeting is logged with WARN level for visibility.
* Zoom deletion failures are logged (WARN) but do not block backend operations.

## Troubleshooting

| Symptom | Resolution |
| ------- | ---------- |
| 403 when teacher schedules | Membership not approved or teacher scheduling for another user; check `ensureAcademyAccess`. |
| Placeholder join URL | Zoom credentials invalid; inspect `ZoomService` logs for OAuth failure. |
| Prisma error “value too long” | Run latest migration (`20251103100000_expand_zoom_urls`). |
| Participants not syncing | Ensure Zoom reports enabled; meeting must have concluded for `/report/meetings` to return attendees. |
