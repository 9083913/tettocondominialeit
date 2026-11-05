
import { json, identifySite } from "../_shared.js";

export async function onRequestGet({ request, env }) {
  if (!identifySite(request)) return json({ ok: false, error: "site_not_allowed" }, 403);
  if (!env.LEADS_DB) return json({ ok: false, database: false }, 503);
  try {
    const row = await env.LEADS_DB.prepare("SELECT 1 AS ok").first();
    return json({ ok: row?.ok === 1, database: row?.ok === 1 });
  } catch {
    return json({ ok: false, database: false }, 503);
  }
}


