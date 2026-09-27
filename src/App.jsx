import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SchoolSelectPage from "./pages/SchoolSelectPage.jsx";
import SchoolHomePage from "./pages/SchoolHomePage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import DevPortalPage from "./pages/DevPortalPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SchoolSelectPage />} />
        <Route path="/school/:schoolId" element={<SchoolHomePage />} />
        <Route path="/school/:schoolId/admin" element={<AdminPage />} />
        <Route path="/dev" element={<DevPortalPage />} />
      </Routes>
    </BrowserRouter>
  );
}