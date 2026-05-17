import { installCookieStorage } from "./lib/cookieStorage";
installCookieStorage(); // must run before any Appwrite SDK call

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppwriteProvider } from "./hooks/useAppwrite";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppwriteProvider>
      <App />
    </AppwriteProvider>
  </StrictMode>
);
