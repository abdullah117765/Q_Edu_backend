# Users Module Guide

## Purpose
Manage all user entities across roles (super admin, academy owner, teacher, student).  
Supports pagination, searching, status transitions, and profile updates.

## Core Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/users` | Super admin list of all users (paginated). |
| `GET` | `/users/me` | Retrieve authenticated user profile (includes academy membership summary). |
| `PATCH` | `/users/me` | Update own profile (names, bio, gender, address). |
| `GET` | `/users/teachers` | Filtered teacher list (scoped to requesting academy). |
| `GET` | `/users/students` | Filtered student list. |
| `POST` | `/users/teachers` | Create teacher (super admin / owner). |
| `POST` | `/users/students` | Create student (super admin / owner). |
| `PATCH` | `/users/:id/status` | Update approval status (super admin only). |

## Key DTOs

* `UpdateProfileDto` – validated input for `/users/me`.
* `StudentsQueryDto` / `TeachersQueryDto` – status, academy, search filters.
* `UpdateUserStatusDto` – requires reason when rejecting.

## Frontend Touchpoints

* `ProfileTab` & `useProfileManager` call `/users/me` (GET + PATCH).
* Teacher dashboard `useTeacherDashboardData` fetches `/users/students` for class invites.
* Academy owner `UsersTab` consumes `/users/teachers` & `/users/students` to display member rosters.

## Behaviour Notes

* `user.profilePhotoUrl` is normalised through `resolveAssetUrl` so relative paths work.
* JSON `_count` metadata used to calculate class counts per teacher/student.
* Status enforcement: teachers/students must be `APPROVED` to appear in dashboards by default.

## Troubleshooting

| Symptom | Resolution |
| ------- | ---------- |
| Profile photo not loading | Ensure `FILE_STORAGE_PUBLIC_URL` is set or use `/storage` relative path. |
| Teacher missing from dropdown | Confirm membership is approved for the academy via `AcademyMembership`. |
| Profile updates rejected | Check validation errors (first name required, phone cannot be empty). |
