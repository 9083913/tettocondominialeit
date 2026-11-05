
import { oauthCallback } from "../../_zoho.js";
const headers = {
  "Cache-Control": "no-store",
  "Set-Cookie": "zoho_oauth_state=; Path=/api/zoho/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  "Referrer-Policy": "no-referrer"
};
export async function onRequestGet({ request, env }) {
  const cookie = request.headers.get("Cookie") || "", m = cookie.match(/(?:^|;\s*)zoho_oauth_state=([^;]+)/);
  try {
    await oauthCallback(env, request.url, m ? decodeURIComponent(m[1]) : "");
    return new Response(null, { status: 303, headers: { ...headers, Location: "/collega-zoho-completato.html" } });
  } catch {
    return new Response('<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Collegamento non completato</title><body style="font:16px system-ui;max-width:620px;margin:4rem auto;padding:1rem"><h1>Collegamento non completato</h1><p>Riapri la procedura di collegamento e riprova l’autorizzazione.</p></body></html>', { status: 400, headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  }
}


