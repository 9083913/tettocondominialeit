
import { capture } from "../_shared.js";

export async function onRequestPost({ request, env }) {
  return capture(request, env, "calculation");
}


