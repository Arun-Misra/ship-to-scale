/**
 * P3/P4 — Appwrite auth session hook.
 * Returns the current session JWT for use in all API calls.
 */
import { useState, useEffect } from "react";
import { Client, Account } from "appwrite";

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1")
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID ?? "");

const account = new Account(client);
const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

const DEV_SESSION: AppwriteSession = {
  userId: "local-dev-user",
  jwt: "local-dev-jwt",
  workspaceId: "local-dev-workspace",
};

export interface AppwriteSession {
  userId: string;
  jwt: string;
  workspaceId: string;
}

export function useAppwrite() {
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
    if (DEV_BYPASS_AUTH) {
      setSession(DEV_SESSION);
      return;
    }

    await account.createEmailPasswordSession(email, password);
    const s = await account.getSession("current");
    const jwt = await account.createJWT();
    const prefs = await account.getPrefs();
    setSession({ userId: s.userId, jwt: jwt.jwt, workspaceId: prefs.workspace_id ?? "" });
  };

  const logout = async () => {
    if (DEV_BYPASS_AUTH) {
      setSession(null);
      return;
    }

    await account.deleteSession("current");
    setSession(null);
  };

  return { session, loading, login, logout };
}
