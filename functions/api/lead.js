
import { capture, json, identifySite, readJson } from "../_shared.js";

export async function onRequestPost({ request, env, waitUntil }) {
  if (!identifySite(request)) return json({ ok: false, error: "site_not_allowed" }, 403);
  const requestCopy = request.clone();
  const { body, error } = await readJson(request);
  if (error) return json({ ok: false, error }, error === "payload_too_large" ? 413 : 400);
  const eventType = body.type === "email_capture" ? "email_capture" : "lead";
  return capture(requestCopy, env, eventType, { waitUntil });
}


