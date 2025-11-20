// ----------------------------------------
// src/routes/Layout.tsx
// ----------------------------------------

import React from "react";
import { NavLink, Outlet } from "react-router-dom";

export default function Layout() {
  const navItems = [
    { label: "🏠 Dashboard", path: "/app" },
    { label: "📰 Theme Drafts", path: "/app/drafts/themes" },
    { label: "📖 Story Drafts", path: "/app/drafts/stories" },
    { label: "⚙️ Prompt Lab", path: "/app/promptlab" }, // ✅ New link
  ];

  return (
    <div className="min-h-screen flex bg-gray-100 text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-5 border-b">
          <h1 className="text-2xl font-bold text-blue-700">Wait…What? CMS</h1>
          <p className="text-sm text-gray-500 mt-1">Editorial Console</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `block px-4 py-2 rounded-md transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-gray-100 text-gray-700"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Wait…What?</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Content Manager</h2>
          <a
            href="https://waitwhat.news"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View Live Site →
          </a>
        </header>

        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
