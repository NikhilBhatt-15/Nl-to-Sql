"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { getCurrentUser, loginWithGoogle } from "../lib/api";
import {
  clearAuthSession,
  getAuthToken,
  getStoredCredits,
  getStoredDatabaseUrl,
  getStoredUserEmail,
  setAuthSession,
  setStoredCredits,
} from "../lib/storage";

export default function Navigation() {
  const pathname = usePathname();
  const [currentDatabaseLabel, setCurrentDatabaseLabel] = useState<string>("Default Database");
  const [token, setToken] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [credits, setCredits] = useState(0);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const refreshUiFromStorage = () => {
    const dbUrl = getStoredDatabaseUrl();
    if (!dbUrl) {
      setCurrentDatabaseLabel("Default Database");
    } else {
      try {
        const name = new URL(dbUrl).pathname.replace("/", "") || "Custom Database";
        setCurrentDatabaseLabel(name);
      } catch {
        setCurrentDatabaseLabel("Custom Database");
      }
    }

    setToken(getAuthToken());
    setUserEmail(getStoredUserEmail());
    setCredits(getStoredCredits());
  };

  useEffect(() => {
    refreshUiFromStorage();
    const handleStorageChange = () => refreshUiFromStorage();

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("appSessionChanged", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("appSessionChanged", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (!googleClientId || typeof window === "undefined") return;

    const scriptId = "google-identity-services";
    const existing = document.getElementById(scriptId);

    const initialize = () => {
      const googleApi = (window as any).google;
      if (!googleApi?.accounts?.id) return;
      googleApi.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential?: string }) => {
          if (!response?.credential) return;
          setAuthLoading(true);
          setAuthError(null);
          try {
            const auth = await loginWithGoogle(response.credential);
            setAuthSession(auth.access_token, auth.email, auth.credits_remaining);
            setToken(auth.access_token);
            setUserEmail(auth.email);
            setCredits(auth.credits_remaining);
            setShowAuthForm(false);
            window.dispatchEvent(new Event("appSessionChanged"));
          } catch (err) {
            setAuthError(err instanceof Error ? err.message : "Google login failed.");
          } finally {
            setAuthLoading(false);
          }
        },
      });

      const buttonContainer = document.getElementById("google-signin-button");
      if (buttonContainer) {
        buttonContainer.innerHTML = "";
        googleApi.accounts.id.renderButton(buttonContainer, {
          theme: "outline",
          size: "large",
          width: "290",
          text: "signin_with",
        });
        setGoogleReady(true);
      }
    };

    if (existing) {
      initialize();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    document.head.appendChild(script);
  }, [googleClientId, showAuthForm]);

  useEffect(() => {
    const existingToken = getAuthToken();
    if (!existingToken) return;

    getCurrentUser(existingToken)
      .then((user) => {
        setStoredCredits(user.credits_remaining);
        setCredits(user.credits_remaining);
      })
      .catch(() => {
        clearAuthSession();
        refreshUiFromStorage();
      });
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    setToken("");
    setUserEmail("");
    setCredits(0);
    window.dispatchEvent(new Event("appSessionChanged"));
  };

  return (
    <nav style={{
      background: "#161b22",
      borderBottom: "1px solid #333",
      padding: "0.75rem 2rem",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      height: "60px",
      position: "sticky",
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "bold" }}>
          NL-to-SQL Assistant
        </h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link
            href="/"
            style={{
              padding: "0.5rem 1rem",
              textDecoration: "none",
              color: pathname === "/" ? "#4f8cff" : "#9a9a9a",
              background: pathname === "/" ? "#1a1d24" : "transparent",
              borderRadius: "4px",
              fontSize: "0.9rem",
              fontWeight: pathname === "/" ? 500 : 400,
              transition: "all 0.2s"
            }}
          >
            Questions
          </Link>
          <Link
            href="/schema"
            style={{
              padding: "0.5rem 1rem",
              textDecoration: "none",
              color: pathname === "/schema" ? "#4f8cff" : "#9a9a9a",
              background: pathname === "/schema" ? "#1a1d24" : "transparent",
              borderRadius: "4px",
              fontSize: "0.9rem",
              fontWeight: pathname === "/schema" ? 500 : 400,
              transition: "all 0.2s"
            }}
          >
            Schema
          </Link>
        </div>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {token ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
            background: "#1a1d24",
            borderRadius: "4px",
            border: "1px solid #333"
          }}>
            <span style={{ fontSize: "0.8rem", color: "#9a9a9a" }}>Credits</span>
            <strong style={{ color: credits > 0 ? "#7ee787" : "#ff6b6b" }}>{credits}</strong>
          </div>
        ) : null}

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          background: "#1a1d24",
          borderRadius: "4px",
          border: "1px solid #333"
        }}>
          <span style={{ fontSize: "1rem" }}>🗄️</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.75rem", color: "#9a9a9a" }}>Connected to:</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "#e6e6e6" }}>
              {currentDatabaseLabel}
            </span>
          </div>
        </div>

        {token ? (
          <button
            onClick={handleLogout}
            style={{
              padding: "0.5rem 0.8rem",
              background: "#2a2d35",
              color: "#e6e6e6",
              border: "1px solid #444",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
            title={userEmail}
          >
            Logout
          </button>
        ) : (
          <button
            onClick={() => setShowAuthForm(!showAuthForm)}
            style={{
              padding: "0.5rem 0.8rem",
              background: "#4f8cff",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Login
          </button>
        )}
      </div>

      {showAuthForm && !token && (
        <div style={{
          position: "absolute",
          right: "2rem",
          top: "64px",
          width: "320px",
          background: "#161b22",
          border: "1px solid #333",
          borderRadius: "8px",
          padding: "1rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}>
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ color: "#e6e6e6", fontWeight: 600, marginBottom: "0.3rem" }}>
              Sign in with Google
            </div>
            <div style={{ color: "#9a9a9a", fontSize: "0.8rem" }}>
              Email/password auth is disabled.
            </div>
          </div>

          {authError ? <div style={{ color: "#ff6b6b", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{authError}</div> : null}

          {googleClientId ? (
            <div>
              <div id="google-signin-button" style={{ minHeight: "40px" }} />
              {!googleReady ? (
                <div style={{ color: "#9a9a9a", fontSize: "0.75rem", marginTop: "0.45rem" }}>
                  Loading Google sign-in...
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ marginTop: "0.75rem", color: "#9a9a9a", fontSize: "0.75rem" }}>
              Google login disabled (missing `NEXT_PUBLIC_GOOGLE_CLIENT_ID`).
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
