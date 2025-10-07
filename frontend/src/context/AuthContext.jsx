import React, { createContext, useState, useContext, useEffect } from "react";
import { login as apiLogin } from "../api";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("accessToken"));
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await apiLogin({ email, password });
      setToken(response.data.accessToken);
      navigate("/dashboard");
    } catch (error) {
      console.error("Login failed:", error);
      // You can add state here to show an error message to the user
    }
  };

  const logout = () => {
    setToken(null);
    navigate("/login");
  };

  const value = {
    token,
    isAuthenticated: !!token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
