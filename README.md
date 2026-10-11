# SchoolFlow

SchoolFlow is a React/Vite school portal backed by Express and MongoDB. The existing diary and test-paper generators remain available alongside the LMS.

## Current implemented modules

- Role-based Admin, Teacher, and Student sign-in; general teacher/student IDs require choosing a profile, and specific IDs/email/phone can identify a personal account.
- Admin: teacher/student records, suspend/reactivate, CSV student import, classes/sections/subjects/teacher assignments, timetable periods, academic calendar, exams, student fee invoices and manual payment ledger, daily attendance review/edit, teacher attendance review, summary reports/CSV export, audit history, school profile, grading/rule JSON settings.
- Teacher: class dashboard, student attendance with configurable statuses, linked/ad-hoc grades, homework, resources, scheduled exams, assignment submissions/feedback, timetable/calendar, and staff check-in/out.
- Student: homework and assignment submission, resources/tests, results, attendance history, class timetable/calendar/exams, and fee invoice/payment history.
- Dev Portal: provision/delete schools, diary codes, admin and general role IDs, shared passwords, and school logos.
- Server role checks, school scoping, salted password hashes, protected legacy Admin Portal mutations, rate limiting for login/Dev Portal, Helmet headers, and audit entries for several key changes.

**Important limitations:** this is still not a full SIS/ERP. There is no OTP/2FA or password reset, parent portal, multi-campus, bulk teacher import, online payment gateway, fee structures/installment engine/fines/refunds/receipts, admissions/promotions/transfers, teacher leave approval/regularization, seating/admit cards/report cards/transcripts/GPA, file-manager storage service, automated backups, restore, PWA, localization/RTL, or broad end-to-end test suite. Uploads continue to use bounded inline data URIs (not a production object store). Some report/export options are summary-only. Read [docs/API_AND_ROLES.md](docs/API_AND_ROLES.md) for actual endpoints and authorization boundaries.

## Requirements and local development

- Node.js 18+ and MongoDB.
- At repository root run `npm install`.
- Copy `server/env.example` to `server/.env`, set `MONGODB_URI`, and choose strong, private `DEV_PASSWORD` and `SESSION_SECRET` values. Do not commit `.env`.
- Run `npm run dev:server` and `npm run dev` in separate terminals. Vite proxies `/api` to `http://localhost:4000`; configure `VITE_API_PROXY` for another local API address.

## Initial setup and optional demo seed

Use `/dev` to create a school and administrator, then sign in at `/login`. Configure school-wide teacher/student passwords and general IDs under School settings, then create teacher/student profiles and classes.

An optional **explicitly configured** sample-school seed is available. Set `SEED_SCHOOL_NAME`, `SEED_DIARY_CODE`, `SEED_ADMIN_ID`, `SEED_ADMIN_PASSWORD`, `SEED_TEACHER_ID`, `SEED_TEACHER_PASSWORD`, `SEED_STUDENT_ID`, and `SEED_STUDENT_PASSWORD` in the server environment; optional values include `SEED_SCHOOL_ADDRESS`, `SEED_SCHOOL_PHONE`, `SEED_GENERAL_TEACHER_ID`, `SEED_GENERAL_STUDENT_ID`, `SEED_ACADEMIC_YEAR`, `SEED_TEACHER_NAME`, `SEED_STUDENT_NAME`, `SEED_CLASS`, and `SEED_SECTION`. Run `npm --prefix server run seed` once. The script refuses to overwrite when its admin ID already exists. It creates the school, admin, role password hashes, one teacher, one student, and one class. Never use real production credentials for a demo seed.

## Build, test, deploy

- Frontend: `npm run build` produces `dist/`.
- Backend tests: `npm --prefix server test` runs built-in Node tests. `npm --prefix server run check` runs the server syntax check.
- API: `npm --prefix server start`.

Deploy the API with MongoDB connectivity and environment secrets. Deploy the Vite `dist/` directory; either proxy `/api` to Express on the same origin or set `VITE_API_URL` at frontend build time. Use HTTPS, restrict `CLIENT_ORIGIN` to trusted browser origins, configure backups/monitoring at the hosting/database provider, and never expose `DEV_PASSWORD` to the client build. The build may show a large bundle-size warning; it still completes successfully.

## Preserved legacy features

The existing `/schools`, `/school/:schoolId`, and `/school/:schoolId/admin` routes, diary image generator, test-paper document generator, school codes, logos, and colors are retained. Legacy mutating admin requests now require a signed school-admin session; diary teacher-name lookups remain readable for the generator.