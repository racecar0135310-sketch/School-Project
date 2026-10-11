# SchoolFlow

SchoolFlow is a React/Vite school portal backed by an Express API and MongoDB. It keeps the original school diary generator and its school-specific access pages while adding a central Admin, Teacher, and Student login.

## Current implementation status

The current release is a working foundation, not yet the complete school-management platform described in the project brief. It currently includes:

- Dev Portal school setup, diary access codes, admin login credentials, and school logos.
- Central admin sign-in, school profile/theme settings, teacher/student directories, and shared role passwords.
- Specific teacher/student IDs and general role IDs. General ID sign-in asks the user to select their profile, so personal records stay tied to an individual.
- Teacher dashboard overview, daily attendance (present/absent/late), grade entry, homework, and learning/test resources.
- Student dashboard overview, homework, test resources, grades, and attendance history.
- Original diary and test-paper generators at the existing school routes and inside the teacher workspace.
- Server-side role checks for the central APIs and signed access for legacy Admin Portal write operations.

Fees/payments, timetables, academic years/terms, exam scheduling/report cards, submissions, bulk imports, audit logs, OTP/2FA/password reset, exports, PWA, localization/RTL, and backup/restore are not implemented yet. The API is single-school oriented today; school IDs are retained in the data model for later multi-school support. See [docs/API_AND_ROLES.md](docs/API_AND_ROLES.md) for current API routes and the role boundary.

## Requirements

- Node.js 18 or newer
- A MongoDB database (local or Atlas)

## Local development

1. Install frontend dependencies from the repository root with `npm install`.
2. Copy `server/env.example` to `server/.env` and set `MONGODB_URI` and a strong, private `DEV_PASSWORD`. Keep `.env` out of source control.
3. In one terminal, start the API with `npm run dev:server`.
4. In another terminal, start Vite with `npm run dev` and open the local URL it prints.

Vite proxies `/api` to `http://localhost:4000` by default. Set `VITE_API_PROXY` if the API runs on a different local host/port.

## First-time setup

1. Open `/dev`, authenticate with the `DEV_PASSWORD`, and create the school plus its admin login ID/password.
2. Sign in at `/login` as that admin.
3. Open **School settings** to set the general teacher/student login IDs and shared passwords.
4. Add teacher and student profiles from their respective admin sections. Their specific IDs work with the shared password for that role. General role IDs ask the person to choose their individual profile after authentication.

There are no demo accounts or automatic seed records. Do not use a shared general role account where individual attribution is required; select a profile at login or use the specific ID.

## Build and deployment

- Frontend production build: `npm run build` (output: `dist/`).
- API syntax check: `npm --prefix server test`.
- API start: `npm --prefix server start`.

Deploy the Express API with `server/` dependencies and set `MONGODB_URI`, `DEV_PASSWORD`, and optionally `PORT`/`SESSION_SECRET`. Deploy the Vite `dist/` output on a static host. For a separate API origin, set `VITE_API_URL` at frontend build time; otherwise route `/api` to the Express service through the same origin/reverse proxy. Use HTTPS in production. The client build currently emits a large-chunk advisory; it does not prevent a successful build.

## Original diary tools

The legacy routes `/schools`, `/school/:schoolId`, and `/school/:schoolId/admin` remain available. The original diary generator still creates its printable diary image, and the test-paper generator remains available to teachers. Legacy diary data and LMS data share school records but use separate routes and their distinct access controls.

## Verification

Run `npm run build` and `npm --prefix server test`. The server test script currently performs a JavaScript syntax check only; automated API/database integration tests have not been added yet.