// ----------------------------------------
// src/main.tsx
// ----------------------------------------

import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";

import Layout from "./layout/Layout";
import DraftsThemes from "./routes/DraftsThemes";
import DraftsStories from "./routes/DraftsStories";
import EditDraft from "./routes/EditDraft";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        path: "/",
        element: (
          <div className="p-6">
            <h1 className="text-3xl font-bold">Welcome to Wait…What? CMS</h1>
            <p className="text-gray-600 mt-2">
              Use the sidebar to manage Theme and Story drafts.
            </p>
          </div>
        ),
      },
      { path: "/drafts/themes", element: <DraftsThemes /> },
      { path: "/drafts/stories", element: <DraftsStories /> },
      { path: "/drafts/:id", element: <EditDraft /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
