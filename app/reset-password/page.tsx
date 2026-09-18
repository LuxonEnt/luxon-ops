"use client";

import { useEffect, useState } from "react";
import { KeyRound, Lock, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const PORTAL_BACKGROUND_STYLE = {
  backgroundImage:
    "linear-gradient(rgba(5, 5, 5, 0.82), rgba(5, 5, 5, 0.92)), url('/luxon-dashboard-bg.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
} as React.CSSProperties;

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Checking secure link...");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (data.session?.user) {
        setReady(true);
        setMessage("Secure link verified. Create your new password below.");
      } else {
        setMessage(
          "This password link is invalid or expired. Go back to Login and request a new Forgot / Set Password email.",
        );
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session?.user)) {
        setReady(true);
        setMessage("Secure link verified. Create your new password below.");
      }
    });

    void checkSession();

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!ready) {
      setMessage("Request a new password link from the Login page first.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    window.location.href = "/login?password=updated";
  }

  return (
    <main
      className="min-h-screen bg-[#050505] text-white"
      style={PORTAL_BACKGROUND_STYLE}
    >
      <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-black/55 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
              <KeyRound className="h-3.5 w-3.5" />
              Luxon Entertainment
            </div>

            <h1 className="text-3xl font-bold tracking-tight">Set Password</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Create the password you will use to log into Luxon Ops.
            </p>
          </div>

          <form onSubmit={savePassword} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-300">
                New Password
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Create new password"
                  disabled={!ready || loading}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 pl-11 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/40 disabled:opacity-50"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-300">
                Confirm Password
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  disabled={!ready || loading}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 pl-11 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/40 disabled:opacity-50"
                />
              </div>
            </label>

            {message ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!ready || loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {loading ? "Saving..." : "Save New Password"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
