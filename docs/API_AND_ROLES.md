# API and role reference

This document describes routes that exist in the current code. It is not a specification for unimplemented modules. JSON API errors use `{ "error": "..." }` and successful protected calls require `Authorization: Bearer <token>` unless indicated otherwise.

## Sign-in and identity

### `POST /api/auth/login`

Body: `{ "userId": "...", "password": "..." }`.

- Admins use the school admin ID/password configured in the Dev Portal.
- Teachers/students use a role's shared password, configured in School settings.
- A specific teacher/student ID signs into that profile directly.
- A general teacher/student ID returns `requiresProfileSelection`, `role`, and a list of profiles after the password is verified. Send the selected `profileId` with the same user ID/password to complete sign-in and receive the signed session.
- IDs are normalized to lowercase. Ambiguous IDs are rejected.

### `GET /api/me`

Requires a signed session; returns the current user identity and school profile. Central sessions expire after seven days.

## Current role matrix

| Capability | Admin | Teacher | Student | Dev Portal |
| --- | --- | --- | --- | --- |
| Read school profile | Own school | Own school in dashboard | Own school in dashboard | All provisioned schools |
| Manage teacher/student directory | Own school | No | No | No |
| Change school profile, diary theme, general IDs, role passwords | Own school | No | No | Manage school provisioning fields |
| Read assigned class/student workspace | No | Assigned profile's class | Own profile's class records | No |
| Record student attendance/grades | No | Own assigned class | No | No |
| Publish homework/resources | No | Own assigned class | No | No |
| View homework/tests/grades/attendance | No | Own class overview | Own class/individual records | No |
| Provision/delete schools and manage diary codes/admin credentials | No | No | No | Yes |

The role-wide general ID is an authentication alias, not an anonymous shared profile: the login flow requires choosing a teacher/student profile before issuing a session. Specific IDs remain available for direct sign-in.

## Central admin routes

All require an admin session and are scoped to its school.

- `GET /api/admin/summary`
- `GET|POST /api/admin/teachers`
- `PUT|DELETE /api/admin/teachers/:id`
- `GET|POST /api/admin/students`
- `PUT|DELETE /api/admin/students/:id`
- `PUT /api/admin/settings` — school name/address/phone/theme, general teacher/student IDs, and optional shared passwords. Existing password hashes are retained when password fields are blank.

Teacher/student deletes also clean related records in the currently implemented modules. Dev Portal school deletion removes that school's current teacher, student, attendance, grade, homework, and material documents.

## Teacher routes

All require a teacher session with a selected teacher profile; records are constrained to that teacher's school/class/section.

- `GET /api/teacher/overview`
- `GET /api/teacher/attendance?date=YYYY-MM-DD`
- `POST /api/teacher/attendance` — `{ date, records: [{ studentId, status }] }`; statuses currently supported are `present`, `absent`, and `late`.
- `POST /api/teacher/grades` — student, subject, assessment, marks/maxMarks, optional term/feedback.
- `POST /api/teacher/homework` — subject/title plus optional description, due date, link, or attached data.
- `POST /api/teacher/materials` — subject/title plus optional description, link/file and `kind` (`material` or `test`).

## Student routes

- `GET /api/student/overview` — requires a student session with a selected student profile; returns matching class homework/resources, the student's grades, and attendance history.

## Legacy diary and Admin Portal compatibility

- `GET /api/schools`, `GET /api/schools/:id`, and `POST /api/schools/:id/verify-code` support the school picker and diary gate.
- `GET /api/teachers?schoolId=...` remains available for diary teacher-name autocomplete.
- Legacy teacher create/update/delete and school color writes now require a signed school-admin session. `POST /api/schools/:id/verify-admin` issues that short-lived token on successful verification.
- Dev endpoints `/api/dev/*` require the `x-dev-password` header. These operate across provisioned schools and must remain restricted to trusted operators.

## Explicitly not exposed yet

There are no current APIs for timetables, calendars/holidays, academic sessions/terms, exams/exam schedules/report cards, assignment submissions, fees/invoices/payments, file manager metadata, audit logs, bulk import/export, user suspension, password reset/OTP/2FA, reports, or backup/restore. Those require dedicated schemas, API authorization rules, UI, migrations, and tests before they can be considered implemented.