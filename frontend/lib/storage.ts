const DB_URL_KEY = "currentDatabase";
const AUTH_TOKEN_KEY = "authToken";
const USER_EMAIL_KEY = "userEmail";
const CREDITS_KEY = "creditsRemaining";

export function getStoredDatabaseUrl(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(DB_URL_KEY) || "";
}

export function setStoredDatabaseUrl(url: string): void {
  if (typeof window === "undefined") return;
  if (!url.trim()) {
    localStorage.removeItem(DB_URL_KEY);
    return;
  }
  localStorage.setItem(DB_URL_KEY, url.trim());
}

export function getAuthToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export function setAuthSession(token: string, email: string, creditsRemaining: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(USER_EMAIL_KEY, email);
  localStorage.setItem(CREDITS_KEY, String(creditsRemaining));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_EMAIL_KEY);
  localStorage.removeItem(CREDITS_KEY);
}

export function getStoredUserEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(USER_EMAIL_KEY) || "";
}

export function getStoredCredits(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(CREDITS_KEY) || 0);
}

export function setStoredCredits(value: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CREDITS_KEY, String(value));
}
