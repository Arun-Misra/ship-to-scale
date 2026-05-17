/**
 * Appwrite auth — single shared session state via React Context.
 *
 * WHY CONTEXT: useAppwrite() is called in many components (App, Sidebar,
 * ProtectedRoute, AuthPage, page components). Without context each call
 * creates its own useState — login/logout in one component wouldn't
 * re-render the others, so route guards never fired.
 *
 * Uses React.createElement instead of JSX so this stays a .ts file.
 */
import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { Client, Account, ID } from "appwrite";

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1")
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID ?? "");

const account = new Account(client);
const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

export interface AppwriteSession {
  userId: string;
  jwt: string;
  workspaceId: string;
}

const DEV_SESSION: AppwriteSession = {
  userId: "local-dev-user",
  jwt: "local-dev-jwt",
  workspaceId: "local-dev-workspace",
};

interface AppwriteContextValue {
  session: AppwriteSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AppwriteContext = createContext<AppwriteContextValue | null>(null);

export function AppwriteProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppwriteSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DEV_BYPASS_AUTH) {
      setSession(DEV_SESSION);
      setLoading(false);
      return;
    }
    account.getSession("current")
      .then(async (s) => {
        const jwt = await account.createJWT();
        const prefs = await account.getPrefs();
        setSession({ userId: s.userId, jwt: jwt.jwt, workspaceId: prefs.workspace_id ?? "" });
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    if (DEV_BYPASS_AUTH) { setSession(DEV_SESSION); return; }
    try {
      await account.createEmailPasswordSession(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("session") || msg.toLowerCase().includes("invalid")) throw err;
    }
    const s = await account.getSession("current");
    const jwt = await account.createJWT();
    const prefs = await account.getPrefs();
    setSession({ userId: s.userId, jwt: jwt.jwt, workspaceId: prefs.workspace_id ?? "" });
  };

  const signup = async (email: string, password: string, name?: string) => {
    if (DEV_BYPASS_AUTH) { setSession(DEV_SESSION); return; }
    const user = await account.create(ID.unique(), email, password, name);
    await account.createEmailPasswordSession(email, password);
    await account.updatePrefs({ workspace_id: user.$id });
    const s = await account.getSession("current");
    const jwt = await account.createJWT();
    setSession({ userId: s.userId, jwt: jwt.jwt, workspaceId: user.$id });
  };

  const logout = async () => {
    if (DEV_BYPASS_AUTH) { setSession(null); return; }
    await account.deleteSession("current");
    setSession(null);
  };

  return React.createElement(
    AppwriteContext.Provider,
    { value: { session, loading, login, signup, logout } },
    children,
  );
}

export function useAppwrite(): AppwriteContextValue {
  const ctx = useContext(AppwriteContext);
  if (!ctx) throw new Error("useAppwrite must be used inside <AppwriteProvider>");
  return ctx;
}
