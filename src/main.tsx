import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TrialApp } from "./app/TrialApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<StrictMode><TrialApp /></StrictMode>);

window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
});
