"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ManagerPage() {
  const [status, setStatus] = useState("Checking access...");
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function checkManagerAccess() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        window.location.href = "/login";
        return;
      }

      const userEmail = session.user.email;
      setEmail(userEmail);

      const { data } = await supabase
        .from("admins")
        .select("email")
        .eq("email", userEmail)
        .maybeSingle();

      if (!data) {
        await supabase.auth.signOut();
        window.location.href = "/login";
        return;
      }

      setStatus("allowed");
    }

    checkManagerAccess();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (status !== "allowed") {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <h1 className="text-3xl font-bold">Manager Portal</h1>
        <p className="mt-4 text-zinc-400">{status}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Manager Portal</h1>
          <p className="mt-2 text-zinc-400">Signed in as {email}</p>
        </div>
        <button
          onClick={signOut}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
        >
          Sign Out
        </button>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-zinc-300">Manager access verified.</p>
      </div>
    </main>
  );
}
