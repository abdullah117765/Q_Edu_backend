# Changelog

All notable changes to the Q Edu backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `@nestjs/throttler` global guard (60 req/min per IP) plus stricter limits on auth endpoints (login/register 5/min, OTP & password endpoints 3-5/min).
- `@NoEmoji()` class-validator decorator backed by Unicode property escapes; applied to identity fields (name, email, phone, gender).
- `UsersDirectoryQueryDto` so the Super Admin Directory can filter `/users` by `status` and `search`.
- `academy` field on `UserEntity` exposing the owner's academy `id`, `name`, `status` for accurate dashboard display.
- Docs: `architecture.md`, `security.md`, `api-reference.md`, `production-readiness.md`.

### Changed
- `UsersService.findAll` and `findByRole` now include the owner's academy and the user's approved academy memberships, fixing missing/incorrect academy names in the User Management list.
- Production input length limits: name ≤ 80, bio ≤ 500, phone ≤ 32, email ≤ 254, password ≤ 128, gender ≤ 64.
- `GET /users/students` now masks student emails as `a***@domain.com` when the caller is a `TEACHER`.

### Fixed
- "property status should not exist" 400 when filtering the Super Admin Directory.
- Super Admin academy preview previously showed user-status (always APPROVED for owners) instead of the academy review status.
