import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AppPiket from "./AppPiket";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
      <AppPiket />
  </StrictMode>
);
