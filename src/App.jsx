import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SchoolSelectPage from "./pages/SchoolSelectPage.jsx";
import SchoolHomePage from "./pages/SchoolHomePage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import DevPortalPage from "./pages/DevPortalPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
       
       {/* New central LMS entry points */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

        {/* Original generator routes remain available for existing schools. */}
        <Route path="/schools" element={<SchoolSelectPage />} />
        <Route path="/school/:schoolId" element={<SchoolHomePage />} />
        <Route path="/school/:schoolId/admin" element={<AdminPage />} />
        <Route path="/dev" element={<DevPortalPage />} />
          {/* Hidden, developer-only setup portal. */}
      </Routes>
      <Route path="*" element={<Navigate to="/" replace />} />
    </BrowserRouter>
  );
}