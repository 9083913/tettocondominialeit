
import { json, identifySite } from "../../_shared.js";
import { safeEqual, sameOrigin, processPending, connectionStatus } from "../../_zoho.js";
export async function onRequestGet({ request, env }) { return handle(request, env, false); }
export async function onRequestPost({ request, env }) { return handle(request, env, true); }
async function handle(request, env, retry) {
  if (identifySite(request) !== "tettochiaro") return json({ ok: false, error: "site_not_allowed" }, 403);
  if (retry && !sameOrigin(request)) return json({ ok: false, error: "origin_rejected" }, 403);
  const h = request.headers.get("Authorization") || "", m = h.match(/^Basic\s+(.+)$/i);
  let pair = ""; try { pair = m ? atob(m[1]) : ""; } catch {}
  const i = pair.indexOf(":");
  if (i < 0 || pair.slice(0, i) !== "alex" || !env.ADMIN_PASSWORD || !safeEqual(pair.slice(i + 1), env.ADMIN_PASSWORD)) {
    return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Basic realm=\"TettoCondominiale admin\"", "Cache-Control": "no-store" } });
  }
  try {
    if (retry) return json({ ok: true, processed: await processPending(env, 3) });
    const row = await env.LEADS_DB.prepare("SELECT state,COUNT(*) AS count FROM zoho_outbox GROUP BY state").all();
    return json({ ok: true, connected: await connectionStatus(env), counts: row.results || [] });
  } catch { return json({ ok: false, error: "status_unavailable" }, 503); }
}


