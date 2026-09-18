import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DiaryPage from "./pages/DiaryPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DiaryPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
