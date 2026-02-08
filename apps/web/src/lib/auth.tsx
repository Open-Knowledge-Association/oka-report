import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "viewer" | "editor" | "admin";
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isInitialized, setIsInitialized] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ user: User | null }>({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      const response = await apiFetch("/auth/session");
      if (!response.ok) {
        throw new Error("Failed to fetch session");
      }
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isLoading) {
      setIsInitialized(true);
    }
  }, [isLoading]);

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/auth/logout", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to sign out");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["auth", "session"], { user: null });
      queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    },
  });

  const signOut = useCallback(async () => {
    await signOutMutation.mutateAsync();
  }, [signOutMutation]);

  const refetchUser = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const value: AuthContextType = {
    user: data?.user ?? null,
    isLoading: isLoading || !isInitialized,
    isAuthenticated: !!data?.user,
    signOut,
    refetchUser,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useRequireAuth() {
  const { user, isLoading, isAuthenticated } = useAuth();
  return { user, isLoading, isAuthenticated };
}
