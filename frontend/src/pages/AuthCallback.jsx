import { useEffect } from "react";

export default function AuthCallback() {
  useEffect(() => {
    // MSAL handles this automatically via handleRedirectPromise
    // This page just needs to exist and let MSAL process the URL
    // The popup will close itself once MSAL processes the response
  }, []);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      fontFamily: "Segoe UI, sans-serif",
      color: "#666",
      flexDirection: "column",
      gap: "12px"
    }}>
      <div style={{
        width: 32, height: 32,
        border: "3px solid #0078d4",
        borderTop: "3px solid transparent",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}></div>
      <p style={{ fontSize: 14 }}>Completing sign in...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}