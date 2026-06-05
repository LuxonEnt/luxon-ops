"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Lock, LogIn, Mail, Sparkles } from "lucide-react";

const PORTAL_BACKGROUND_STYLE = {
  backgroundImage:
    "linear-gradient(rgba(5, 5, 5, 0.82), rgba(5, 5, 5, 0.92)), url('/luxon-dashboard-bg.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
} as React.CSSProperties;

type LoginMode = "login" | "create-account";

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

function nameFromEmail(email: string) {
  const localPart = email.split("@")[0] || "Contractor";
  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function checkExistingSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await routeUser(session.user.id, session.user.email || "");
        return;
      }

      setCheckingSession(false);
    }

    void checkExistingSession();
  }, []);

  async function routeUser(userId: string, userEmail: string) {
    const normalizedEmail = cleanEmail(userEmail);

    const { data: adminRow, error: adminError } = await supabase
      .from("admins")
      .select("id,email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (adminError) {
      setLoading(false);
      setCheckingSession(false);
      setMessage(adminError.message);
      return;
    }

    if (adminRow) {
      window.location.href = "/manager";
      return;
    }

    const { data: contractorByUserId, error: contractorByUserIdError } =
      await supabase
        .from("contractors")
        .select("id,user_id,email")
        .eq("user_id", userId)
        .maybeSingle();

    if (contractorByUserIdError) {
      setLoading(false);
      setCheckingSession(false);
      setMessage(contractorByUserIdError.message);
      return;
    }

    if (contractorByUserId) {
      window.location.href = "/contractor";
      return;
    }

    const { data: contractorByEmail, error: contractorByEmailError } =
      await supabase
        .from("contractors")
        .select("id,user_id,email")
        .ilike("email", normalizedEmail)
        .maybeSingle();

    if (contractorByEmailError) {
      setLoading(false);
      setCheckingSession(false);
      setMessage(contractorByEmailError.message);
      return;
    }

    if (contractorByEmail) {
      if (!contractorByEmail.user_id) {
        const { error: linkError } = await supabase
          .from("contractors")
          .update({ user_id: userId })
          .eq("id", contractorByEmail.id);

        if (linkError) {
          setLoading(false);
          setCheckingSession(false);
          setMessage(
            `Login worked, but contractor profile could not be linked: ${linkError.message}`,
          );
          return;
        }
      }

      window.location.href = "/contractor";
      return;
    }

    const { error: createContractorError } = await supabase
      .from("contractors")
      .insert({
        user_id: userId,
        email: normalizedEmail,
        name: nameFromEmail(normalizedEmail),
        role: "Contractor",
        rate: 0,
        rate_type: "day",
        requested_skills: [],
        approved_skills: [],
      });

    if (createContractorError) {
      setLoading(false);
      setCheckingSession(false);
      setMessage(
        `Account created, but your contractor profile could not be created: ${createContractorError.message}`,
      );
      return;
    }

    window.location.href = "/contractor";
  }

  async function handleLogin() {
    setMessage("");

    const normalizedEmail = cleanEmail(email);

    if (!normalizedEmail || !password) {
      setMessage("Enter your email and password.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    if (!data.user) {
      setLoading(false);
      setMessage("Login failed. Please try again.");
      return;
    }

    await routeUser(data.user.id, data.user.email || normalizedEmail);
  }

  async function handleCreateAccount() {
    setMessage("");

    const normalizedEmail = cleanEmail(email);

    if (!normalizedEmail || !password) {
      setMessage("Enter your email and password.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    if (data.user && data.session) {
      await routeUser(data.user.id, data.user.email || normalizedEmail);
      return;
    }

    setLoading(false);
    setMessage(
      "Account created. Please check your email to confirm your account, then come back and log in.",
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "login") {
      await handleLogin();
      return;
    }

    await handleCreateAccount();
  }

  if (checkingSession) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#050505] p-6 text-white"
        style={PORTAL_BACKGROUND_STYLE}
      >
        <div className="rounded-3xl border border-white/10 bg-black/45 p-6 text-sm text-zinc-300 shadow-2xl backdrop-blur-xl">
          Checking login...
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#050505] text-white"
      style={PORTAL_BACKGROUND_STYLE}
    >
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-0 top-0 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-yellow-300/5 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-black/55 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              Luxon Entertainment
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              Luxon Ops Login
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Login or create an account with email and password only.
            </p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-amber-400 text-black"
                  : "text-zinc-300 hover:bg-white/[0.06]"
              }`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("create-account");
                setMessage("");
              }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === "create-account"
                  ? "bg-amber-400 text-black"
                  : "text-zinc-300 hover:bg-white/[0.06]"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-300">
                Email
              </span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@email.com"
                  autoComplete="email"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 pl-11 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/40"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-300">
                Password
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    mode === "login" ? "Enter password" : "Create password"
                  }
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 pl-11 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/40"
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
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-600 px-5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Login"
                  : "Create Account"}
            </button>
          </form>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs leading-5 text-zinc-400">
            New contractors can create an account using this link. Their profile
            will be created automatically after login.
          </div>
        </div>
      </div>
    </main>
  );
}
