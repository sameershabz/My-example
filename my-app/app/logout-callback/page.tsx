// "use client";

// import { useEffect } from "react";
// import { useAuth } from "react-oidc-context";
// import { useRouter } from "next/navigation";

// export default function LogoutCallback() {
//   const auth = useAuth();
//   const router = useRouter();

//   useEffect(() => {
//     // Remove any leftover URL parameters to avoid reusing old data.
//     if (window.location.search) {
//       window.history.replaceState({}, document.title, window.location.pathname);
//     }
//     // Clear the local login information.
//     auth.removeUser();
//     // Send the user back to the home page.
//     router.replace("/");
//   }, [auth, router]);

//   return <div>Logging out...</div>;
// }

"use client";

import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/navigation";

export default function LogoutCallback() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Clear the refreshToken cookie inlines
    

    auth.removeUser();
    document.cookie = "refreshToken=; Path=/; Secure; SameSite=Strict; Max-Age=0";
    router.replace("/");
  }, [auth, router]);

  return <div>Logging out...</div>;
}