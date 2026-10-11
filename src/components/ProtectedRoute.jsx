import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getSession } from "../lib/auth.js";

export default function ProtectedRoute({ children, allow }) {
  const location = useLocation();
  const session = getSession();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (allow && !allow.includes(session.user?.role)) return <Navigate to="/app" replace />;
  return children;
}

