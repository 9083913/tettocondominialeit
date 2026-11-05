
const REDIRECT_URI = "https://<built-in function dir>.pages.dev/api/zoho/callback";
const SCOPES = ["ZohoCRM.modules.leads.READ", "ZohoCRM.modules.leads.CREATE", "ZohoCRM.modules.leads.UPDATE", "ZohoCRM.modules.notes.READ", "ZohoCRM.modules.notes.CREATE"];
const nowIso = () => new Date().toISOString();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const hash = async s => b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
function db(env) { if (!env.LEADS_DB) throw new Error("db_unavailable"); return env.LEADS_DB; }
async function key(env) {
  if (!env.ZOHO_CONFIG_KEY) throw new Error("key_unavailable");
  const raw = unb64(env.ZOHO_CONFIG_KEY);
  if (raw.length !== 32) throw new Error("key_invalid");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encrypt(env, value) {
  const k = await key(env), iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(value));
  return `${b64(iv)}.${b64(data)}`;
}
async function decrypt(env, value) {
  const [iv, data] = value.split(".");
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(env), unb64(data));
  return new TextDecoder().decode(clear);
}
export function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !!origin && new URL(origin).origin === new URL(request.url).origin;
}
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let diff = a.length ^ b.length; const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export async function setupConfig(env, input) {
  if (!input || !["clientId", "clientSecret"].every(k => typeof input[k] === "string" && input[k].trim())) throw new Error("invalid_input");
  const d = db(env), existing = await d.prepare("SELECT refresh_token_enc,setup_disabled FROM zoho_config WHERE id=1").first();
  if (existing?.refresh_token_enc || existing?.setup_disabled) throw new Error("setup_closed");
  const clientId = input.clientId.trim(), clientSecret = input.clientSecret.trim();
  await d.prepare(`INSERT INTO zoho_config(id,client_id_enc,client_secret_enc,api_domain,accounts_domain,created_at,updated_at) VALUES(1,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET client_id_enc=excluded.client_id_enc,client_secret_enc=excluded.client_secret_enc,updated_at=excluded.updated_at`).bind(await encrypt(env, clientId), await encrypt(env, clientSecret), "https://www.zohoapis.eu", "https://accounts.zoho.eu", nowIso(), nowIso()).run();
}
export async function oauthUrl(env) {
  const row = await db(env).prepare("SELECT client_id_enc,refresh_token_enc FROM zoho_config WHERE id=1").first();
  if (!row || row.refresh_token_enc) throw new Error("config_unavailable");
  const state = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  await db(env).prepare("DELETE FROM zoho_oauth_state WHERE expires_at < ?").bind(nowIso()).run();
  await db(env).prepare("INSERT INTO zoho_oauth_state(state_hash,expires_at,created_at) VALUES(?,?,?)").bind(await hash(state), new Date(Date.now()+10*60*1000).toISOString(), nowIso()).run();
  const url = new URL("/oauth/v2/auth", "https://accounts.zoho.eu");
  url.search = new URLSearchParams({scope:SCOPES.join(","),client_id:await decrypt(env,row.client_id_enc),response_type:"code",access_type:"offline",prompt:"consent",redirect_uri:REDIRECT_URI,state}).toString();
  return { url:url.toString(), state };
}
export async function oauthCallback(env, requestUrl, cookieState) {
  const u = new URL(requestUrl), code = u.searchParams.get("code"), state = u.searchParams.get("state");
  if (!code || !state || !cookieState || !safeEqual(state,cookieState)) throw new Error("oauth_state_invalid");
  const d = db(env), stateHash = await hash(state), stored = await d.prepare("SELECT expires_at FROM zoho_oauth_state WHERE state_hash=?").bind(stateHash).first();
  await d.prepare("DELETE FROM zoho_oauth_state WHERE state_hash=?").bind(stateHash).run();
  if (!stored || Date.parse(stored.expires_at)<Date.now()) throw new Error("oauth_state_invalid");
  const config = await d.prepare("SELECT client_id_enc,client_secret_enc FROM zoho_config WHERE id=1").first();
  if (!config) throw new Error("config_unavailable");
  const params = new URLSearchParams({grant_type:"authorization_code",client_id:await decrypt(env,config.client_id_enc),client_secret:await decrypt(env,config.client_secret_enc),redirect_uri:REDIRECT_URI,code});
  const r = await fetch("https://accounts.zoho.eu/oauth/v2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:params,signal:AbortSignal.timeout(15000)});
  const j=await r.json(); if(!r.ok || !j.refresh_token || !j.access_token || j.api_domain!=="https://www.zohoapis.eu") throw new Error("oauth_exchange_failed");
  const expires=new Date(Date.now()+Math.min(3600,Number(j.expires_in)||3600)*1000).toISOString();
  await d.prepare("UPDATE zoho_config SET refresh_token_enc=?,access_token_enc=?,access_expires_at=?,token_lease_until=NULL,api_domain=?,accounts_domain=?,setup_disabled=1,updated_at=? WHERE id=1").bind(await encrypt(env,j.refresh_token),await encrypt(env,j.access_token),expires,j.api_domain,"https://accounts.zoho.eu",nowIso()).run();
}
async function config(env) {
  const r=await db(env).prepare("SELECT client_id_enc,client_secret_enc,refresh_token_enc,api_domain,accounts_domain FROM zoho_config WHERE id=1").first();
  if(!r?.refresh_token_enc) throw new Error("not_configured");
  return {...r,client_id:await decrypt(env,r.client_id_enc),client_secret:await decrypt(env,r.client_secret_enc),refresh_token:await decrypt(env,r.refresh_token_enc)};
}
async function accessToken(env,c) {
  const d=db(env), read=()=>d.prepare("SELECT access_token_enc,access_expires_at FROM zoho_config WHERE id=1").first();
  const valid=r=>r?.access_token_enc && Date.parse(r.access_expires_at)>Date.now()+60000;
  let cached=await read(); if(valid(cached))return decrypt(env,cached.access_token_enc);
  const lease=new Date(Date.now()+30000).toISOString();
  const claimed=await d.prepare("UPDATE zoho_config SET token_lease_until=? WHERE id=1 AND (token_lease_until IS NULL OR token_lease_until<?) RETURNING id").bind(lease,nowIso()).first();
  if(!claimed)throw new Error("token_refresh_busy");
  try {
    cached=await read();if(valid(cached))return decrypt(env,cached.access_token_enc);
    const body=new URLSearchParams({grant_type:"refresh_token",client_id:c.client_id,client_secret:c.client_secret,refresh_token:c.refresh_token});
    const r=await fetch(`${c.accounts_domain}/oauth/v2/token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body,signal:AbortSignal.timeout(15000)});
    const j=await r.json();if(!r.ok||!j.access_token)throw new Error("token_refresh_failed");
    const expires=new Date(Date.now()+Math.min(3600,Number(j.expires_in)||3600)*1000).toISOString();
    await d.prepare("UPDATE zoho_config SET access_token_enc=?,access_expires_at=? WHERE id=1 AND token_lease_until=?").bind(await encrypt(env,j.access_token),expires,lease).run();
    return j.access_token;
  } finally {await d.prepare("UPDATE zoho_config SET token_lease_until=NULL WHERE id=1 AND token_lease_until=?").bind(lease).run();}
}
async function api(env,c,token,path,options={}) {
  const r=await fetch(`${c.api_domain}/crm/v8${path}`,{...options,signal:AbortSignal.timeout(15000),headers:{Authorization:`Zoho-oauthtoken ${token}`,"Content-Type":"application/json",...(options.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(`zoho_http_${r.status}`);
  return data;
}
function field(s,n) { return typeof s==="string"?s.trim().slice(0,n):""; }
export async function syncLead(env, leadId) {
  const d=db(env), row=await d.prepare("SELECT id,event_type,created_at,payload_json FROM lead_records WHERE id=? AND site='tettochiaro' AND event_type='lead'").bind(leadId).first();
  if(!row) throw new Error("lead_missing"); const p=JSON.parse(row.payload_json), contact=p.contact||{};
  const email=field(contact.email,254).toLowerCase();
  const data={Last_Name:field(contact.lastName,80),Email:email};
  const first=field(contact.firstName,40), phone=field(contact.phone,30), city=field(p.answers?.city,100), zip=field(p.cap,30);
  if(first)data.First_Name=first;if(phone)data.Phone=phone;if(city)data.City=city;if(zip)data.Zip_Code=zip;
  if(!email||!data.Last_Name) throw new Error("lead_invalid");
  const c=await config(env), token=await accessToken(env,c);
  const up=await api(env,c,token,"/Leads/upsert",{method:"POST",body:JSON.stringify({data:[data],duplicate_check_fields:["Email"],trigger:[]})});
  const result=up.data?.[0]; if(result?.status!=="success" || !result.details?.id) throw new Error("zoho_upsert_rejected");
  const crmId=result.details.id, title=`TettoCondominiale richiesta ${row.id}`;
  let found=false, more=false;
  for(let page=1;page<=10;page++) {
    const notes=await api(env,c,token,`/Leads/${encodeURIComponent(crmId)}/Notes?fields=id,Note_Title&per_page=200&page=${page}`,{method:"GET"});
    found=(notes.data||[]).some(n=>n.Note_Title===title);more=notes.info?.more_records===true;
    if(found||!more)break;
  }
  if(!found) {
    if(more)throw new Error("notes_pagination_required");
    const content="Richiesta dal sito TettoCondominiale\n"+JSON.stringify({request_id:row.id,created_at:row.created_at,...p},null,2);
    const note=await api(env,c,token,`/Leads/${encodeURIComponent(crmId)}/Notes`,{method:"POST",body:JSON.stringify({data:[{Note_Title:title,Note_Content:content,Parent_Id:{module:{api_name:"Leads"},id:crmId}}]})});
    if(note.data?.[0]?.status!=="success") throw new Error("zoho_note_rejected");
  }
  return crmId;
}
export async function processPending(env, limit=10) {
  const d=db(env); let processed=0;
  if(!(await connectionStatus(env)))return 0;
  for(let n=0;n<Math.min(10,limit);n++) {
    const lease=new Date(Date.now()+120000).toISOString(), now=nowIso();
    const claim=await d.prepare(`UPDATE zoho_outbox SET state='processing',lease_until=?,updated_at=? WHERE lead_id=(SELECT lead_id FROM zoho_outbox WHERE (state='pending' AND next_attempt_at<=?) OR (state='processing' AND lease_until<?) ORDER BY next_attempt_at,created_at LIMIT 1) AND ((state='pending' AND next_attempt_at<=?) OR (state='processing' AND lease_until<?)) RETURNING lead_id,attempts`).bind(lease,now,now,now,now,now).first();
    if(!claim) break;
    try { const crmId=await syncLead(env,claim.lead_id); await d.prepare("UPDATE zoho_outbox SET state='done',crm_lead_id=?,lease_until=NULL,last_error=NULL,updated_at=? WHERE lead_id=? AND state='processing' AND lease_until=?").bind(crmId,nowIso(),claim.lead_id,lease).run(); }
    catch(e) { const attempts=claim.attempts+1, delay=Math.min(86400,30*2**Math.min(attempts,11)), next=new Date(Date.now()+delay*1000).toISOString(); const code=/^zoho_http_\d+$/.test(e.message)?e.message:/^(token_refresh_failed|zoho_upsert_rejected|zoho_note_rejected|lead_invalid|not_configured|lead_missing)$/.test(e.message)?e.message:"sync_failed"; await d.prepare("UPDATE zoho_outbox SET state='pending',attempts=?,next_attempt_at=?,lease_until=NULL,last_error=?,updated_at=? WHERE lead_id=? AND state='processing' AND lease_until=?").bind(attempts,next,code,nowIso(),claim.lead_id,lease).run(); }
    processed++;
  }
  return processed;
}
export async function connectionStatus(env) { const r=await db(env).prepare("SELECT refresh_token_enc FROM zoho_config WHERE id=1").first(); return !!r?.refresh_token_enc; }


