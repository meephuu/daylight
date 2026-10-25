import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { getDb } from "@/lib/db/client";
import { initTheme } from "@/lib/theme";
import "./index.css";

initTheme();
// Open the DB at startup so migrations run immediately and failures surface in the console.
getDb().catch((err: unknown) => console.error("Failed to open database", err));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
