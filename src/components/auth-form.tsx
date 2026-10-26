"use client";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

type Mode = "sign-in" | "sign-up";

export const AuthForm = () => {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === "sign-up";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: authError } = isSignUp
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
      if (authError) {
        throw new Error(
          authError.message ??
            (isSignUp ? "Could not create account" : "Could not sign in"),
        );
      }
      router.push("/bracket");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setMode(isSignUp ? "sign-in" : "sign-up");
    setError(null);
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-2xl font-bold text-gray-800">
        {isSignUp ? "Create an account" : "Sign in"}
      </h1>
      <p className="mb-6 text-sm text-gray-400">
        {isSignUp
          ? "Sign up to build and save your bracket."
          : "Sign in to view and edit your bracket."}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            Name
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 font-normal text-gray-800 focus:border-gray-500 focus:outline-none"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 font-normal text-gray-800 focus:border-gray-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 font-normal text-gray-800 focus:border-gray-500 focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-gray-800 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-wait disabled:opacity-50"
        >
          {submitting
            ? isSignUp
              ? "Creating account..."
              : "Signing in..."
            : isSignUp
              ? "Sign up"
              : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-500">
        {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          type="button"
          onClick={toggleMode}
          className="font-semibold text-gray-800 underline hover:text-gray-600"
        >
          {isSignUp ? "Sign in" : "Sign up"}
        </button>
      </p>
    </div>
  );
};
