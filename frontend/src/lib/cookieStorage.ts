/**
 * The Appwrite Web SDK (v16) stores session data in localStorage under
 * the key "cookieFallback" whenever it cannot set a direct cookie
 * (cross-origin — frontend and Appwrite Cloud on different domains).
 *
 * This shim intercepts exactly that one key and redirects it to
 * document.cookie so nothing ever lands in localStorage.
 *
 * Call installCookieStorage() once, before any Appwrite API call fires.
 */

const LS_KEY = "cookieFallback";
const COOKIE_NAME = "aw_fallback";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(value: string) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; SameSite=Strict; max-age=${MAX_AGE}${secure}`;
}

function deleteCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}

export function installCookieStorage() {
  if (typeof window === "undefined") return;

  // One-time migration: move any existing localStorage value into a cookie
  const existing = window.localStorage.getItem(LS_KEY);
  if (existing) {
    writeCookie(existing);
    window.localStorage.removeItem(LS_KEY);
  }

  const _get = Storage.prototype.getItem;
  const _set = Storage.prototype.setItem;
  const _del = Storage.prototype.removeItem;
  const _clear = Storage.prototype.clear;

  Storage.prototype.getItem = function (key: string): string | null {
    if (this === window.localStorage && key === LS_KEY) return readCookie();
    return _get.call(this, key);
  };

  Storage.prototype.setItem = function (key: string, value: string): void {
    if (this === window.localStorage && key === LS_KEY) {
      writeCookie(value);
      return;
    }
    _set.call(this, key, value);
  };

  Storage.prototype.removeItem = function (key: string): void {
    if (this === window.localStorage && key === LS_KEY) {
      deleteCookie();
      return;
    }
    _del.call(this, key);
  };

  // Clearing localStorage should also wipe the auth cookie
  Storage.prototype.clear = function (): void {
    if (this === window.localStorage) deleteCookie();
    _clear.call(this);
  };
}
