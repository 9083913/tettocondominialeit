
import { json } from "../../_shared.js";
import { sameOrigin, safeEqual, setupConfig, oauthUrl, connectionStatus } from "../../_zoho.js";
export async function onRequestPost({request,env}) {
 if(!sameOrigin(request)) return json({ok:false,error:"origin_rejected"},403);
 if(!env.ZOHO_SETUP_TOKEN || !safeEqual(request.headers.get("X-Zoho-Setup-Token")||"",env.ZOHO_SETUP_TOKEN)) return json({ok:false,error:"unauthorized"},401);
 try {const b=await request.json(); if(b.action==="configure"){await setupConfig(env,b);return json({ok:true});} if(b.action==="authorize"){if(await connectionStatus(env))return json({ok:false,error:"already_connected"},409);const {url,state}=await oauthUrl(env);return new Response(JSON.stringify({ok:true,url}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store","Set-Cookie":`zoho_oauth_state=${state}; Path=/api/zoho/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`}});} return json({ok:false,error:"invalid_action"},400);}catch(e){const status=e.message==="setup_closed"?409:400;return json({ok:false,error:/^(setup_closed|config_unavailable)$/.test(e.message)?e.message:"setup_failed"},status);}
}


