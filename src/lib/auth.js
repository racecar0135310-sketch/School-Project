const SESSION_KEY = "school-lms-session";
const LEGACY_SESSION_KEY = "school-lms-session";

function tokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")));
    return Number(payload.exp) || null;
  } catch {
    return null;
  }
}

export function getSession() {
  try {
    let raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      raw = sessionStorage.getItem(LEGACY_SESSION_KEY);
      if (raw) {
        localStorage.setItem(SESSION_KEY, raw);
        sessionStorage.removeItem(LEGACY_SESSION_KEY);
      }
    }
    if (!raw) return null;
    const session = JSON.parse(raw);
    const expiresAt = session.expiresAt || tokenExpiry(session.token);
    if (!expiresAt || expiresAt <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (!session.expiresAt) {
      session.expiresAt = expiresAt;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return session;
  } catch {
    return null;
  }
}

export function getAuthToken() {
  return getSession()?.token || "";
}

export function saveSession(session) {
  const expiresAt = session.expiresAt || tokenExpiry(session.token);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, expiresAt }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
}

export const ROLE_META = {
  admin: {
    label: "Admin",
    accent: "blue",
    welcome: "School operations at a glance",
  },
  teacher: {
    label: "Teacher",
    accent: "emerald",
    welcome: "Plan, teach and support your class",
  },
  student: {
    label: "Student",
    accent: "orange",
    welcome: "Everything you need for today",
  },
};