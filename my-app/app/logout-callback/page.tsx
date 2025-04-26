// app/logout-callback/page.tsx
"use client";

import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/navigation";

export default function LogoutCallback() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 1) Clear OIDC state
    auth.removeUser();

    // 2) Replace current history entry with /signin
    //    so Back won’t land on this page
    window.history.replaceState(null, "", "/signin");

    // 3) Redirect there and force a full reload (no cache)
    router.replace("/signin");
    window.location.reload();
  }, [auth, router]);

  return <div>Logging out…</div>;
}
