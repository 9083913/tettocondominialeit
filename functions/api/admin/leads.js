import { json, identifySite, purgeExpiredLeads, CRM_SITES } from "../../_shared.js";

const ROOF_SITES = ["tettocondominiale", "preventivotetto"];
const ALL_ADMIN_SITES = [...CRM_SITES];

function authorized(request, configuredPassword) {
  if (!configuredPassword) return false;
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const splitAt = decoded.indexOf(":");
  if (splitAt < 0 || decoded.slice(0, splitAt) !== "alex") return false;
  const candidate = new TextEncoder().encode(decoded.slice(splitAt + 1));
  const expected = new TextEncoder().encode(configuredPassword);
  let difference = candidate.length ^ expected.length;
  const length = Math.max(candidate.length, expected.length);
  for (let i = 0; i < length; i += 1) difference |= (candidate[i] || 0) ^ (expected[i] || 0);
  return difference === 0;
}

function resolveSites(hostSite, filterRaw) {
  const filter = (filterRaw || "all").trim().toLowerCase();
  if (filter === "host" || filter === "this") return [hostSite];
  if (filter === "roof") return ROOF_SITES.slice();
  if (filter === "all" || filter === "") return ALL_ADMIN_SITES.slice();
  const parts = filter.split(",").map((s) => s.trim()).filter(Boolean);
  const allowed = new Set(ALL_ADMIN_SITES);
  const picked = [...new Set(parts.filter((s) => allowed.has(s)))];
  return picked.length ? picked : [hostSite];
}

export async function onRequestGet({ request, env }) {
  const site = identifySite(request);
  if (!site) return json({ ok: false, error: "site_not_allowed" }, 403);
  if (!authorized(request, env.ADMIN_PASSWORD)) return json({ ok: false, error: "unauthorized" }, 401);
  if (!env.LEADS_DB) return json({ ok: false, error: "database_unavailable" }, 503);

  const url = new URL(request.url);
  const offsetValue = Number.parseInt(url.searchParams.get("offset") || "0", 10);
  const limitValue = Number.parseInt(url.searchParams.get("limit") || "100", 10);
  const offset = Number.isFinite(offsetValue) ? Math.max(0, Math.min(1_000_000_000, offsetValue)) : 0;
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(1000, limitValue)) : 100;
  const sites = resolveSites(site, url.searchParams.get("sites") || url.searchParams.get("site") || "all");

  try {
    for (const s of sites) await purgeExpiredLeads(env.LEADS_DB, s);
    const placeholders = sites.map(() => "?").join(",");
    const result = await env.LEADS_DB.prepare(
      `SELECT id, site, event_type, created_at, updated_at, full_name, phone, email, lead_score, privacy_accepted, partner_accepted, payload_json FROM lead_records WHERE site IN (${placeholders}) ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...sites, limit, offset).all();
    const rows = result.results || [];
    return json({
      ok: true,
      rows,
      sites,
      nextOffset: rows.length === limit ? offset + rows.length : null,
    });
  } catch {
    return json({ ok: false, error: "read_failed" }, 500);
  }
}

