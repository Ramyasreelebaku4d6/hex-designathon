import { createContext, useContext, useState, useEffect } from "react";
import { login as loginApi } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("name");
    if (token && role) {
      setUser({ token, role, name });
    }
    setLoading(false);
  }, []);


  const login = async (email, password) => {
    const data = await loginApi(email, password);
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("name", data.name);
    setUser({ token: data.access_token, role: data.role, name: data.name });
    return data;
  };

  // ── New: used after Microsoft SSO callback ──────────────────────
  const loginWithToken = (data) => {
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("name", data.name);
    setUser({
      token: data.access_token,
      role: data.role,
      name: data.name
    });
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithToken, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}