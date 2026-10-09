const SESSION_KEY = "school-lms-session";

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getAuthToken() {
  return getSession()?.token || "";
}

export function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
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
