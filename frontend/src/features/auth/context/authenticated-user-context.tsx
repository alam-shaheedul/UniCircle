"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { SessionUser } from "@/features/auth/types/session-user";

type AuthenticatedUserContextValue = Readonly<{
  user: SessionUser;
  replaceUser: (user: SessionUser) => void;
}>;

const AuthenticatedUserContext = createContext<AuthenticatedUserContextValue | null>(
  null,
);

type AuthenticatedUserProviderProps = Readonly<{
  initialUser: SessionUser;
  children: ReactNode;
}>;

export function AuthenticatedUserProvider({
  initialUser,
  children,
}: AuthenticatedUserProviderProps) {
  const [user, setUser] = useState(initialUser);
  const value = useMemo(() => ({ user, replaceUser: setUser }), [user]);

  return (
    <AuthenticatedUserContext.Provider value={value}>
      {children}
    </AuthenticatedUserContext.Provider>
  );
}

export function useAuthenticatedUser() {
  const context = useContext(AuthenticatedUserContext);

  if (!context) {
    throw new Error(
      "useAuthenticatedUser must be used within AuthenticatedUserProvider.",
    );
  }

  return context;
}
