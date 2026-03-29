"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api, setAccessToken, getAccessToken } from "@/lib/api/client";

interface AuthUser {
  sub: string;
  full_name: string | null;
  email?: string;
  tenant_id: string | null;
  is_super_admin: boolean;
  roles: string[];
  permissions: string[];
  constituency_code: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setupAdmin: (email: string, password: string, fullName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const parseToken = useCallback((token: string): AuthUser | null => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return {
        sub: payload.sub,
        full_name: payload.full_name || null,
        tenant_id: payload.tenant_id,
        is_super_admin: payload.is_super_admin || false,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
        constituency_code: payload.constituency_code || null,
      };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const parsed = parseToken(token);
      setUser(parsed);
    }
    setIsLoading(false);
  }, [parseToken]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api
      .post("api/auth/login", { json: { email, password } })
      .json<{ access_token: string }>();
    setAccessToken(response.access_token);
    const parsed = parseToken(response.access_token);
    setUser(parsed);
  }, [parseToken]);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  const setupAdmin = useCallback(async (email: string, password: string, fullName: string) => {
    const response = await api
      .post("api/auth/setup", { json: { email, password, full_name: fullName } })
      .json<{ access_token: string }>();
    setAccessToken(response.access_token);
    const parsed = parseToken(response.access_token);
    setUser(parsed);
  }, [parseToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        setupAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
