import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SchoolSelectPage from "./pages/SchoolSelectPage.jsx";
import DiaryPage from "./pages/DiaryPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import DevPortal from "./pages/DevPortal.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SchoolSelectPage />} />
        <Route path="/dev" element={<DevPortal />} />
        <Route path="/:slug/admin" element={<AdminPage />} />
        <Route path="/:slug" element={<DiaryPage />} />
      </Routes>
    </BrowserRouter>
  );
}