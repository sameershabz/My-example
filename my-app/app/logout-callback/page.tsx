// app/logout-callback/page.tsx
"use client";

import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/navigation";

export default function LogoutCallback() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 1. Clean up URL (remove any query params)
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. Clear OIDC state
    auth.removeUser();

    // 3. Prevent BACK navigating into protected pages
    //    Push the sign-in route onto history, then intercept popstate
    window.history.pushState(null, "", "/signin");
    const onPop = () => router.replace("/signin");
    window.addEventListener("popstate", onPop);

    // 4. Redirect to sign-in
    router.replace("/signin");

    // Cleanup listener
    return () => window.removeEventListener("popstate", onPop);
  }, [auth, router]);

  return <div>Logging out…</div>;
}
