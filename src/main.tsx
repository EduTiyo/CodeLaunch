import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import App from "./App";
import "./index.css";

window.addEventListener("error", (event) => {
  console.error("[CodeLaunch Uncaught Error]:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[CodeLaunch Unhandled Rejection]:", event.reason);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
