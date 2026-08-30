import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("tincture_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("tincture_token"));

  useEffect(() => {
    if (token && user) {
      localStorage.setItem("tincture_token", token);
      localStorage.setItem("tincture_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("tincture_token");
      localStorage.removeItem("tincture_user");
    }
  }, [token, user]);

  const login = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
