"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState<"manager" | "contractor">("manager");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [contractorEmail, setContractorEmail] = useState("");
  const [contractorPassword, setContractorPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInManager() {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  }

  async function signUpContractor() {
    try {
      setLoading(true);
      setMessage("");

      const { error } = await supabase.auth.signUp({
        email: contractorEmail,
        password: contractorPassword,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      window.location.href = "/contractor";
    } finally {
      setLoading(false);
    }
  }

  async function signInContractor() {
    try {
      setLoading(true);
      setMessage("");

      const { error } = await supabase.auth.signInWithPassword({
        email: contractorEmail,
        password: contractorPassword,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      window.location.href = "/contractor";
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-4xl font-bold">Luxon Ops Login</h1>
        <p className="mb-8 text-zinc-400">
          Managers use email/password. Contractors can create an account or sign in with email/password.
        </p>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            {message}
          </div>
        )}

        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setMode("manager")}
            className={`rounded-2xl px-4 py-2 ${
              mode === "manager"
                ? "bg-amber-400 text-black"
                : "border border-white/10 bg-white/5 text-white"
            }`}
          >
            Manager
          </button>
          <button
            onClick={() => setMode("contractor")}
            className={`rounded-2xl px-4 py-2 ${
              mode === "contractor"
                ? "bg-amber-400 text-black"
                : "border border-white/10 bg-white/5 text-white"
            }`}
          >
            Contractor
          </button>
        </div>

        {mode === "manager" ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-semibold">Manager Sign In</h2>
            <div className="mt-5 space-y-4">
              <input
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                type="email"
                placeholder="Manager email"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white"
              />
              <input
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                type="password"
                placeholder="Password"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white"
              />
              <button
                onClick={signInManager}
                disabled={loading}
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 font-semibold text-black"
              >
                {loading ? "Signing in..." : "Sign In as Manager"}
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-semibold">Contractor Account</h2>
            <div className="mt-5 space-y-4">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                type="text"
                placeholder="First name"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                type="text"
                placeholder="Last name"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white"
              />
              <input
                value={contractorEmail}
                onChange={(e) => setContractorEmail(e.target.value)}
                type="email"
                placeholder="Contractor email"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white"
              />
              <input
                value={contractorPassword}
                onChange={(e) => setContractorPassword(e.target.value)}
                type="password"
                placeholder="Create or enter password"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-white"
              />

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  onClick={signUpContractor}
                  disabled={loading}
                  className="h-12 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 font-semibold text-black"
                >
                  {loading ? "Working..." : "Create Contractor Account"}
                </button>
                <button
                  onClick={signInContractor}
                  disabled={loading}
                  className="h-12 rounded-2xl border border-amber-400/30 bg-amber-400/10 font-semibold text-amber-200"
                >
                  {loading ? "Working..." : "Sign In as Contractor"}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
