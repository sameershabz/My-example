"use client";

import { AuthProvider } from "react-oidc-context";
import { cognitoAuthConfig } from "./authConfig";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider {...cognitoAuthConfig}>
      {children}
    </AuthProvider>
  );
}
