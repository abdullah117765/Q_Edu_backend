# Academies Module Guide

## Purpose
Handle academy lifecycle: creation, onboarding, membership management, directory listings, and academy-level metrics.

## Core Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/academies/owner/onboarding` | Academy owner submits initial academy details. |
| `GET` | `/academies` | Directory listing (supports search/pagination). |
| `GET` | `/academies/:id` | Fetch academy detail with membership counts. |
| `POST` | `/academies/memberships` | Request membership (teacher/student). |
| `PATCH` | `/academies/memberships/:id` | Approve/reject membership (owner). |
| `GET` | `/academies/memberships/pending` | List pending requests (owner perspective). |

## Data Relationships

* `Academy` has one owner (`ownerId`).
* `AcademyMembership` links user to academy with role (`TEACHER`/`STUDENT`) and status (`PENDING`/`APPROVED`/`REJECTED`).
* Membership records drive scoping for `/users/teachers` and `/classes`.

## Frontend Touchpoints

* Academy owner dashboard `Overview` tab consumes `/dashboard/overview`.
* `UsersTab` uses pending membership endpoints to approve/reject with inline modals.
* Student dashboard's `Academies` tab reads `/academies` to show joinable academies.

## Process Flow

1. Owner registers → completes onboarding form.
2. System creates academy record + sets owner status.
3. Teachers/students request membership (via UI or invite).
4. Owner approves; membership status drives class access.

## Troubleshooting

| Symptom | Resolution |
| ------- | ---------- |
| Teacher can't schedule classes | Ensure membership is `APPROVED`; check `/academies/memberships`. |
| Student can't see academy | Confirm `academy.status` is `ACTIVE` and search filter matches. |
| Duplicate membership request | Endpoint returns 409; instruct user to wait for approval. |
