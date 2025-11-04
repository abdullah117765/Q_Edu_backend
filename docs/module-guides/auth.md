# Auth Module Guide

## Purpose
Authenticate users, manage registration/OTP flows, and issue JWT access/refresh tokens.  
Houses the login, registration, change-password, and refresh endpoints.

## Core Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/auth/register` | Self-service registration (role provided, validated downstream). |
| `POST` | `/auth/login` | Returns access/refresh tokens + user payload. |
| `POST` | `/auth/refresh` | Rotates access token using refresh token. |
| `POST` | `/auth/change-password` | Requires current + new password. |
| `POST` | `/auth/request-otp` | Optional OTP flow (if enabled). |

## Request / Response Highlights

* Login returns `{ accessToken, refreshToken, user }`.
* Refresh endpoint expects `refreshToken` either in JSON body or cookie, depending on environment.
* Password policy enforced in DTO (`class-validator`).

## Frontend Touchpoints

* `AuthContext` in `SaaS/src/contexts/AuthContext.jsx` uses `/auth/login` and `/auth/refresh`.
* `useProfileManager` calls `/auth/change-password` for modal flow.

## Troubleshooting

| Symptom | Resolution |
| ------- | ---------- |
| 401 on login | Verify user status is `APPROVED`; pending/rejected users cannot authenticate. |
| Refresh loop | Ensure refresh token cookie name matches env (`AUTH_REFRESH_TOKEN_COOKIE_NAME`). |
| Change password fails | Verify password meets length requirements; inspect `AuthService.changePassword`. |
