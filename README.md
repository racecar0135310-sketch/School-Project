# SchoolFlow LMS

SchoolFlow is a mobile-first school workspace built around the original
Daily Home Work Diary and Test Paper Generator. It now has one central login
for Admin, Teacher and Student accounts while the original school routes and
Dev Portal remain available for existing schools.

## Product flow

1. Open `/` for the public landing page and choose **Sign in**.
2. Enter the account ID and password. The API detects the school and role —
   there is no school picker in the normal login flow.
3. The user is sent to `/app`, where a responsive sidebar/hamburger menu shows
   only the features for that role.
4. The hidden `/dev` route is still used by the site developer to create a
   school and its first Admin account.
5. The original `/school/:schoolId` generator route and
   `/school/:schoolId/admin` compatibility route are intentionally preserved.

## Role features

- **Admin**: school overview, teacher CRUD, student CRUD, profile/theme
  settings, and separate shared passwords for teachers and students.
- **Teacher**: attendance, gradebook, homework/attachment publishing, study
  material/test links or files, plus the existing Diary and Test Paper
  Generators.
- **Student**: today's homework/diary, tests, downloadable resources and
  results/feedback.

## Run locally

Install the client and server dependencies:

```bash
npm install
cd server && npm install
```

Copy `server/.env.example` to `server/.env` and set:

- `MONGODB_URI` — MongoDB connection string
- `DEV_PASSWORD` — password for the hidden `/dev` portal
- `AUTH_SECRET` — long random value used to sign 12-hour login sessions
- `PORT` — optional API port (defaults to `4000`)

Run the API in one terminal:

```bash
cd server
npm start
```

Run the Vite client in another:

```bash
npm run dev
```

Vite proxies `/api` to `http://localhost:4000`. For a separately hosted API,
set `VITE_API_URL` when building the client. Both Vite and the API bind in a
way that works with the Arena live preview.

## Database schema additions

The existing `School` and `Teacher` documents remain compatible. New fields
on `School` include `adminUserId`, `adminPasswordHash`,
`teacherPasswordHash`, and `studentPasswordHash`. The old `adminPassword` and
`diaryCode` fields stay for the original generator/admin URLs.

New collections:

- `User`: globally unique login ID, role (`admin`, `teacher`, `student`),
  school and profile reference. It does not store passwords.
- `Student`: student profile, class/section, roll number and parent details.
- `Attendance`: one class register per teacher/date.
- `Grade`: student assessment marks, maximum marks, term and feedback.
- `Homework`: class-scoped assignment/note with optional link or small file.
- `Material`: class-scoped study material or test resource with optional link
  or small file.

Teacher and student passwords are unified per school and stored as salted
`scrypt` hashes on the school document. The admin UI updates them without
returning the secret to the browser. New admin passwords are hashed as well;
legacy plaintext fields are only used as a compatibility fallback for old
schools until their credentials are rotated.

The server calls `syncIndexes()` for all models at startup. Existing schools
can be migrated without losing diary data: open the Dev Portal, set an Admin
login ID if needed, then sign in and configure the shared passwords from
**School settings**.

## Existing generator downloads

- Diary downloads are still client-side PNG exports.
- Test papers are still client-side `.docx` exports.
- The DOCX header exporter now uses independent fixed-width tables for each
  mixed-width header row, preventing cells from appearing outside the header
  rectangle in Word/other DOCX viewers.
