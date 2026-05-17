/**
 * P3/P4 — Appwrite auth session hook.
 * Returns the current session JWT for use in all API calls.
 */
import { useState, useEffect } from "react";
import { Client, Account, ID } from "appwrite";

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

    try {
      await account.createEmailPasswordSession(email, password);
    } catch (err: unknown) {
      // If a session is already active, skip creation and just read it
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("session") || msg.toLowerCase().includes("invalid")) throw err;
    }

    const s = await account.getSession("current");
    const jwt = await account.createJWT();
    const prefs = await account.getPrefs();
    setSession({ userId: s.userId, jwt: jwt.jwt, workspaceId: prefs.workspace_id ?? "" });
  };

  const signup = async (email: string, password: string, name?: string) => {
    if (DEV_BYPASS_AUTH) {
      setSession(DEV_SESSION);
      return;
    }

    const user = await account.create(ID.unique(), email, password, name);
    await account.createEmailPasswordSession(email, password);
    // Set workspace_id = user's own $id for data isolation
    await account.updatePrefs({ workspace_id: user.$id });
    const s = await account.getSession("current");
    const jwt = await account.createJWT();
    setSession({ userId: s.userId, jwt: jwt.jwt, workspaceId: user.$id });
  };

  const logout = async () => {
    if (DEV_BYPASS_AUTH) {
      setSession(null);
      return;
    }

    await account.deleteSession("current");
    setSession(null);
  };

  return { session, loading, login, signup, logout };
}
