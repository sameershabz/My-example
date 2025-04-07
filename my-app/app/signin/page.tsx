"use client";

import React, { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useRouter } from "next/navigation"; // Use next/navigation instead of next/router

export default function SignIn() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.replace("/"); // Redirect if already signed in
    }
  }, [auth.isAuthenticated, router]);

  if (auth.isAuthenticated) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-gradient-x">
      {auth.isLoading ? (
        <div className="text-white text-xl">Loading...</div>
      ) : auth.error ? (
        <div className="text-red-300 text-xl">Error: {auth.error.message}</div>
      ) : (
        <button
          onClick={() => auth.signinRedirect()}
          className="px-8 py-4 bg-white text-blue-600 font-bold rounded-lg shadow-md hover:bg-gray-200 transition"
        >
          Sign in
        </button>
      )}
    </div>
  );
}
