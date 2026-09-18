import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { ok: false, error: "Supabase server credentials are missing." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const email = cleanEmail(String(body?.email || ""));

    if (!email) {
      return Response.json(
        { ok: false, error: "Email is required." },
        { status: 400 },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const [{ data: contractor }, { data: manager }] = await Promise.all([
      admin
        .from("contractors")
        .select("id,email")
        .ilike("email", email)
        .maybeSingle(),
      admin.from("admins").select("id,email").ilike("email", email).maybeSingle(),
    ]);

    if (!contractor && !manager) {
      // Keep the response intentionally generic so the endpoint does not reveal
      // whether an email exists in Luxon Ops.
      return Response.json({ ok: true });
    }

    let existingUser = null as null | { id: string; email?: string };
    let page = 1;

    while (page <= 10 && !existingUser) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 100,
      });

      if (error) {
        return Response.json(
          { ok: false, error: error.message },
          { status: 500 },
        );
      }

      existingUser =
        data.users.find((user) => cleanEmail(user.email || "") === email) || null;

      if (data.users.length < 100) break;
      page += 1;
    }

    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/reset-password`;

    if (!existingUser) {
      const { data: inviteData, error: inviteError } =
        await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { source: "luxon-ops-contractor-profile" },
        });

      if (inviteError) {
        return Response.json(
          { ok: false, error: inviteError.message },
          { status: 400 },
        );
      }

      if (contractor && inviteData.user?.id) {
        await admin
          .from("contractors")
          .update({ user_id: inviteData.user.id })
          .eq("id", contractor.id)
          .is("user_id", null);
      }

      return Response.json({ ok: true, mode: "invite" });
    }

    const { error: resetError } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      return Response.json(
        { ok: false, error: resetError.message },
        { status: 400 },
      );
    }

    if (contractor && !contractor.id) {
      // no-op; keeps contractor query shape explicit
    }

    return Response.json({ ok: true, mode: "recovery" });
  } catch (error: any) {
    return Response.json(
      { ok: false, error: error?.message || "Could not start password setup." },
      { status: 500 },
    );
  }
}
