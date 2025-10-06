import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import Dashboard from "./routes/Dashboard";
import Drafts from "./routes/Drafts";
import EditDraft from "./routes/EditDraft";
import Users from "./routes/Users";
import "./index.css";

const router = createBrowserRouter([
  { path: "/", element: <Dashboard /> },
  { path: "/drafts", element: <Drafts /> },
  { path: "/drafts/:id", element: <EditDraft /> },
  { path: "/users", element: <Users /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
