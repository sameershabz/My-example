"use client";

import { useAuth } from "react-oidc-context";
import React from "react";

export default function SignIn() {
  const auth = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-gradient-x">
      {auth.isLoading ? (
        <div className="text-white text-xl">Loading...</div>
      ) : auth.error ? (
        <div className="text-red-300 text-xl">Error: {auth.error.message}</div>
      ) : !auth.isAuthenticated ? (
        <button
          onClick={() => auth.signinRedirect()}
          className="px-8 py-4 bg-white text-blue-600 font-bold rounded-lg shadow-md hover:bg-gray-200 transition"
        >
          Sign in
        </button>
      ) : (
        <div className="text-white text-xl">You are signed in</div>
      )}
    </div>
  );
}
