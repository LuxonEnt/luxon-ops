"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loadingManager, setLoadingManager] = useState(false);
  const [loadingContractor, setLoadingContractor] = useState(false);

  async function signInManager() {
    try {
      setLoadingManager(true);
      setMessage("");

      const { error } = await supabase.auth.signInWithPassword({
        email: managerEmail,
        password: managerPassword,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      window.location.href = "/manager";
    } finally {
      setLoadingManager(false);
    }
  }

  async function sendContractorMagicLink() {
    try {
      setLoadingContractor(true);
      setMessage("");

      const { error } = await supabase.auth.signInWithOtp({
        email: contractorEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/contractor`,
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Magic link sent. Check your email.");
    } finally {
      setLoadingContractor(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="mb-2 inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
            Luxon Entertainment
          </p>
          <h1 className="text-4xl font-bold">Luxon Ops Login</h1>
          <p className="mt-2 text-zinc-400">
            Managers sign in with email and password. Contractors sign in with a magic link.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            {message}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <h2 className="text-2xl font-semibold">Manager Sign In</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Private admin access for events, contractors, payroll, and invoices.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                  Email
                </span>
                <input
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  type="email"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-amber-400/60"
                  placeholder="manager@email.com"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                  Password
                </span>
                <input
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  type="password"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-amber-400/60"
                  placeholder="Password"
                />
              </label>

              <button
                onClick={signInManager}
                disabled={loadingManager}
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 font-semibold text-black"
              >
                {loadingManager ? "Signing in..." : "Sign In as Manager"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <h2 className="text-2xl font-semibold">Contractor Sign In</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Enter your email and we will send you a magic link.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">
                  Contractor Email
                </span>
                <input
                  value={contractorEmail}
                  onChange={(e) => setContractorEmail(e.target.value)}
                  type="email"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-amber-400/60"
                  placeholder="contractor@email.com"
                />
              </label>

              <button
                onClick={sendContractorMagicLink}
                disabled={loadingContractor}
                className="h-12 w-full rounded-2xl border border-amber-400/30 bg-amber-400/10 font-semibold text-amber-200"
              >
                {loadingContractor ? "Sending..." : "Send Magic Link"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
