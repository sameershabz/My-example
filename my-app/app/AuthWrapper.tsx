"use client";

import { AuthProvider, useAuth } from "react-oidc-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { cognitoAuthConfig } from "./authConfig";

function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // 1) If user is on /signin, don't protect the page
  if (pathname === "/signin") {
    return <>{children}</>;
  }

  // 2) Otherwise, protect everything else
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.replace("/signin");
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  // if (auth.isLoading || !auth.isAuthenticated) {
  //   // return null; // show nothing while checking
  // }

  return <>{children}</>;
}

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider {...cognitoAuthConfig}>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
