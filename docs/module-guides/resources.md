# Resources Module Guide

## Purpose
Manage teaching materials and student-accessible resources.  
Supports uploads, metadata updates, and deletion; integrates with local storage or alternate storage drivers.

## Core Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/resources` | List resources (academy-scoped). |
| `POST` | `/resources` | Upload new resource (multipart form). |
| `PATCH` | `/resources/:id` | Update metadata (title, description, visibility). |
| `DELETE` | `/resources/:id` | Remove resource and associated file. |

## Storage Behaviour

* `StorageService` writes to `LOCAL_STORAGE_ROOT` (default `./storage/uploads`).
* Public URL assembled via `FILE_STORAGE_PUBLIC_URL` or `/storage` prefix.
* On delete, storage service attempts to remove file; missing files are logged at WARN level, not fatal.

## Frontend Touchpoints

* Teacher dashboard `Resources` tab handles upload/edit/delete.
* Student dashboard `Resources` tab fetches accessible resources for enrolled classes/academies.

## Troubleshooting

| Symptom | Resolution |
| ------- | ---------- |
| Upload fails | Ensure request is multipart/form-data and file size < configured limit (default 5 MB for profile photos; resources can be larger if configured). |
| Resource not visible to students | Verify `visibility` flag and academy association; refresh data via `useStudentResources`. |
| Broken download link | Confirm `FILE_STORAGE_PUBLIC_URL` points to backend static server or CDN. |
