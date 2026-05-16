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

export interface AppwriteSession {
  userId: string;
  jwt: string;
  workspaceId: string;
}

export function useAppwrite() {
  const [session, setSession] = useState<AppwriteSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    await account.createEmailPasswordSession(email, password);
    const s = await account.getSession("current");
    const jwt = await account.createJWT();
    const prefs = await account.getPrefs();
    setSession({ userId: s.userId, jwt: jwt.jwt, workspaceId: prefs.workspace_id ?? "" });
  };

  const logout = async () => {
    await account.deleteSession("current");
    setSession(null);
  };

  return { session, loading, login, logout };
}
