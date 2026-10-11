import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell, { useDashboardNavigation } from "../components/AppShell.jsx";
import { getMe } from "../lib/storage.js";
import { getSession, saveSession } from "../lib/auth.js";
import AdminDashboard from "./AdminDashboard.jsx";
import TeacherDashboard from "./TeacherDashboard.jsx";
import StudentDashboard from "./StudentDashboard.jsx";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getSession());
  const role = session?.user?.role;
  const { activeView, goTo } = useDashboardNavigation(role);

  useEffect(() => {
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }
    // Refresh school/profile information after a full reload without making
    // navigation dependent on a second login. If the API is offline, the
    // cached session still lets the legacy generators remain usable.
    getMe().then((fresh) => {
      const next = { ...session, user: { ...session.user, ...fresh.user }, school: fresh.school };
      saveSession(next);
      setSession(next);
    }).catch(() => {});
  }, []);

  if (!session || !role) return null;
  return <AppShell session={session} activeView={activeView} onNavigate={goTo}>
    {role === "admin" && <AdminDashboard view={activeView} />}
    {role === "teacher" && <TeacherDashboard view={activeView} session={session} />}
    {role === "student" && <StudentDashboard view={activeView} session={session} />}
  </AppShell>;
}
