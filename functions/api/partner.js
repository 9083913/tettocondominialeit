import { capture, json, identifySite, readJson, cleanText } from "../_shared.js";
// Candidature imprese partner (stesso schema D1 di puliziecondominialiverona: answers.partner=true)
export async function onRequestPost({ request, env, waitUntil }) {
  if (!identifySite(request)) return json({ ok: false, error: "site_not_allowed" }, 403);
  const { body, error } = await readJson(request.clone());
  if (error) return json({ ok: false, error }, 400);
  if (cleanText(body.website, 200)) return json({ ok: true, id: crypto.randomUUID(), type: "lead" });
  const nome = cleanText(body.nome, 120), ref = cleanText(body.referente, 120);
  const parts = ref.split(/\s+/).filter(Boolean);
  const payload = {
    contact: { firstName: parts.length > 1 ? parts.slice(0, -1).join(" ") : "", lastName: parts.length ? parts[parts.length - 1] : nome, fullName: ref || nome, company: nome, phone: cleanText(body.telefono, 40), email: cleanText(body.email, 254), privacyAccepted: body.privacy === true },
    answers: { partner: true, source: "partner", tipo: cleanText(body.tipo, 40) || "impresa", company: nome, servizi: cleanText(body.servizi, 300), city: cleanText(body.citta, 120), landing_url: cleanText(body.landing_url, 500) },
    estimate: {}, consents: { privacy: body.privacy === true, timestamp: new Date().toISOString() }, variant: "partner", page: "/#lavora",
  };
  return capture(new Request(request.url, { method: "POST", headers: { "Content-Type": "application/json", Origin: new URL(request.url).origin }, body: JSON.stringify(payload) }), env, "lead", { waitUntil });
}
