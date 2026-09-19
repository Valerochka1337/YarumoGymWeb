import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { TrialApp } from "./app/TrialApp";
import { ErrorBoundary } from "./ErrorBoundary";
import "./theme.css";
import "./styles.css";

const isTrialRoute = location.pathname === "/r" || location.pathname.startsWith("/r/");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isTrialRoute ? (
      <TrialApp />
    ) : (
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    )}
  </React.StrictMode>,
);

document.documentElement.dataset.theme =
  localStorage.getItem("theme") ?? "system";

