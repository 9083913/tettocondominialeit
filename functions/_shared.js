
const SITE_BY_HOST = {
  "tettocondominialeit.pages.dev": "tettocondominiale",
  "tettocondominiale.pages.dev": "tettocondominiale",
  "tettocondominiale.it": "tettocondominiale",
  "www.tettocondominiale.it": "tettocondominiale",
};

// Sites whose leads are queued for CRM sync (zoho_outbox; cron adds pipedrive_outbox).
export const CRM_SITES = new Set(["tettochiaro", "preventivotetto", "tettocondominiale", "puliziecondominialiverona"]);

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function identifySite(request) {
  const host = new URL(request.url).hostname.toLowerCase();
  if (SITE_BY_HOST[host]) return SITE_BY_HOST[host];
  if (host.endsWith(".tettocondominialeit.pages.dev") || host.endsWith(".tettocondominiale.pages.dev")) return "tettocondominiale";
  return null;
}

export async function readJson(request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > 16_000) return { error: "payload_too_large" };
  const raw = await request.text();
  if (raw.length > 16_000) return { error: "payload_too_large" };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { error: "invalid_payload" };
    return { body: parsed };
  } catch {
    return { error: "invalid_json" };
  }
}

export function cleanText(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeSameSitePath(value, baseUrl) {
  const raw = cleanText(value, 2048);
  if (!raw) return null;
  try {
    const base = new URL(baseUrl);
    const url = new URL(raw, base);
    return url.origin === base.origin ? url.pathname.slice(0, 300) : null;
  } catch {
    return null;
  }
}

function safeReferrerOrigin(value) {
  const raw = cleanText(value, 2048);
  if (!raw) return null;
  try {
    return new URL(raw).origin.slice(0, 300);
  } catch {
    return null;
  }
}

export function retentionCutoff() {
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
  return cutoff.toISOString();
}

export async function purgeExpiredLeads(database, site) {
  if (!database || !site) return;
  await database.prepare(
    "DELETE FROM lead_records WHERE site = ? AND event_type IN ('lead', 'email_capture') AND created_at < ?"
  ).bind(site, retentionCutoff()).run();
}

export function safeId(value) {
  const id = cleanText(value, 80);
  return /^[A-Za-z0-9_-]{16,80}$/.test(id) ? id : crypto.randomUUID();
}

export async function capture(request, env, eventType, ctx) {
  const site = identifySite(request);
  if (!site) return json({ ok: false, error: "site_not_allowed" }, 403);
  if (!env.LEADS_DB) return json({ ok: false, error: "database_unavailable" }, 503);

  if (eventType !== "calculation" && env.LEADS_ENABLED !== "true") {
    return json({ ok: false, error: "privacy_notice_required" }, 503);
  }

  const { body, error } = await readJson(request);
  if (error) return json({ ok: false, error }, error === "payload_too_large" ? 413 : 400);

  const answersInput = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers) ? body.answers : {};
  const answers = Object.assign({}, answersInput, { city: cleanText(answersInput.city || body.comune || answersInput.comune, 120) || null });
  const estimateInput = body.estimate && typeof body.estimate === "object" && !Array.isArray(body.estimate) ? body.estimate : {};
  const estimate = Object.assign({}, estimateInput, {
    low: estimateInput.low != null ? estimateInput.low : estimateInput.min,
    high: estimateInput.high != null ? estimateInput.high : estimateInput.max,
    intervention: estimateInput.intervention || answers.intervento || null,
  });
  const contact = body.contact && typeof body.contact === "object" && !Array.isArray(body.contact) ? body.contact : {};
  const utm = body.utm && typeof body.utm === "object" && !Array.isArray(body.utm) ? body.utm : {};
  const consents = body.consents && typeof body.consents === "object" && !Array.isArray(body.consents) ? body.consents : {};
  const email = cleanText(body.email || contact.email, 254).toLowerCase();
  const firstName = cleanText(contact.firstName || contact.nome || body.firstName || body.nome, 60);
  const lastName = cleanText(contact.lastName || contact.cognome || body.lastName || body.cognome, 60);
  const fullName = cleanText([firstName, lastName].filter(Boolean).join(" ") || contact.fullName || body.fullName, 120);
  const phone = cleanText(contact.phone || contact.telefono || body.phone || body.telefono, 40);
  const phoneDigits = phone.replace(/\D/g, "");
  const privacyAccepted = contact.privacyAccepted === true || body.privacyAccepted === true || consents.privacy === true;
  const partnerAccepted = contact.partnerAccepted === true || body.partnerAccepted === true || consents.trasmissionePartner === true;

  if ((eventType === "lead" || eventType === "email_capture") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "valid_email_required" }, 400);
  }
  if (eventType === "email_capture" && !privacyAccepted) {
    return json({ ok: false, error: "privacy_consent_required" }, 400);
  }
  if (eventType === "lead") {
    const full = cleanText(contact.fullName || body.fullName || [firstName, lastName].filter(Boolean).join(" "), 120);
    if ((!full && !lastName && !firstName) || phoneDigits.length < 8 || phoneDigits.length > 15 || !privacyAccepted) {
      return json({ ok: false, error: "required_contact_or_consent_missing" }, 400);
    }
  }

  const leadScore = body.lead_score !== undefined ? body.lead_score : body.leadScore;
  const score = Number.isFinite(Number(leadScore)) ? Math.max(0, Math.min(100, Math.round(Number(leadScore)))) : null;
  const id = safeId(body.id);
  const now = new Date().toISOString();
  const consentTimestamp = cleanText(consents.timestamp || body.timestamp, 64);
  const payload = {
    answers,
    estimate,
    contact: eventType === "calculation" ? undefined : {
      fullName: eventType === "lead" ? (fullName || [firstName, lastName].filter(Boolean).join(" ")) : "",
      firstName: eventType === "lead" ? firstName : "",
      lastName: eventType === "lead" ? (lastName || firstName || cleanText(contact.fullName || body.fullName, 60)) : "",
      phone: eventType === "lead" ? phone : "",
      email,
      managesMultiple: contact.managesMultiple === true || contact.amministratoreMultiStabili === true,
      privacyAccepted,
      partnerAccepted,
    },
    consents: eventType === "calculation" ? undefined : {
      privacy: privacyAccepted,
      trasmissionePartner: partnerAccepted,
      timestamp: consentTimestamp || null,
    },
    lead_score: score,
    cap: cleanText(body.cap, 10),
    utm,
    client_timestamp: cleanText(body.timestamp, 64),
    variant: cleanText(body.variant, 32) || null,
    page: safeSameSitePath(body.page, request.url),
    referrer: safeReferrerOrigin(body.referrer),
  };
  const payloadJson = JSON.stringify(payload);
  if (payloadJson.length > 16_000) return json({ ok: false, error: "payload_too_large" }, 413);

  try {
    if (eventType !== "calculation") await purgeExpiredLeads(env.LEADS_DB, site);
    if (eventType === "calculation") {
      await env.LEADS_DB.prepare(
        "INSERT OR IGNORE INTO lead_records (id, site, event_type, created_at, updated_at, payload_json) VALUES (?, ?, 'calculation', ?, ?, ?)"
      ).bind(id, site, now, now, payloadJson).run();
    } else {
      const leadWrite = env.LEADS_DB.prepare(
        "INSERT INTO lead_records (id, site, event_type, created_at, updated_at, full_name, phone, email, lead_score, privacy_accepted, partner_accepted, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET event_type = excluded.event_type, updated_at = excluded.updated_at, full_name = excluded.full_name, phone = excluded.phone, email = excluded.email, lead_score = excluded.lead_score, privacy_accepted = excluded.privacy_accepted, partner_accepted = excluded.partner_accepted, payload_json = excluded.payload_json"
      ).bind(id, site, eventType, now, now, eventType === "lead" ? fullName : null, eventType === "lead" ? phone : null, email, score, privacyAccepted ? 1 : 0, partnerAccepted ? 1 : 0, payloadJson);
      if (eventType === "lead" && CRM_SITES.has(site)) {
        const outboxWrite = env.LEADS_DB.prepare("INSERT OR IGNORE INTO zoho_outbox(lead_id,state,attempts,next_attempt_at,created_at,updated_at) VALUES(?,'pending',0,?,?,?)").bind(id, now, now, now);
        await env.LEADS_DB.batch([leadWrite, outboxWrite]);
      } else {
        await leadWrite.run();
      }
    }
    if (eventType === "lead" && CRM_SITES.has(site)) {
      if (ctx?.waitUntil) {
        const sync = import("./_zoho.js").then(({ processPending }) => processPending(env, 1)).catch(() => {});
        ctx.waitUntil(sync);
      }
    }
    return json({ ok: true, id, type: eventType });
  } catch (err) {
    console.error("lead_save_failed", site, eventType, String(err && err.message || err));
    return json({ ok: false, error: "save_failed" }, 500);
  }
}


