import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
  try {
    const token = localStorage.getItem("token");

    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }

    axios.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${token}`;

    const { data } = await axios.get(`${API}/auth/me`);

    setUser(data);
  } catch {
    localStorage.removeItem("token");
    setUser(false);
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
  try {
    const { data } = await axios.post(
      `${API}/auth/login`,
      { email, password }
    );

    // Store JWT token
    localStorage.setItem("token", data.token);

    // Attach token to future requests
    axios.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${data.token}`;

    setUser(data);

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error:
        formatApiErrorDetail(e.response?.data?.detail) ||
        e.message
    };
  }
};

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {});
    } catch {}
localStorage.removeItem("token");

delete axios.defaults.headers.common["Authorization"];

setUser(false);  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
