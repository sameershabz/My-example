"use client";

import React, { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/navigation";

export default function SignIn() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.replace("/");
    }
  }, [auth.isAuthenticated, router]);

  if (auth.isAuthenticated) return null;

  const signInRedirect = () => {
    const redirectUri = "https://telematicshub.vercel.app";
    const clientId = "79ufsa70isosab15kpcmlm628d";
    const cognitoDomain = "https://us-east-1dlb9dc7ko.auth.us-east-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/login?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=email+openid+phone&prompt=login`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-gradient-x">
      {auth.isLoading ? (
        <div className="text-white text-xl">Loading...</div>
      ) : auth.error ? (
        <div className="text-red-300 text-xl">Error: {auth.error.message}</div>
      ) : (
        <button
          onClick={signInRedirect}
          className="px-8 py-4 bg-white text-blue-600 font-bold rounded-lg shadow-md hover:bg-gray-200 transition"
        >
          Sign in
        </button>
      )}
    </div>
  );
}
