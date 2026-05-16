import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  deviceNameCandidate,
  isUniqueConstraintError,
  MAX_DEVICE_NAME_ATTEMPTS,
  normalizeDeviceName,
} from "../_shared/device_names.ts";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Missing or invalid Authorization header" },
        401,
      );
    }
    const deviceToken = authHeader.slice(7);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("id, name, is_banned")
      .eq("token", deviceToken)
      .single();

    if (deviceError || !device) {
      return jsonResponse({ error: "Invalid device token" }, 401);
    }

    if (device.is_banned) {
      return jsonResponse({ error: "Device is banned" }, 403);
    }

    const { preferred_name } = await req.json();
    const normalized = normalizeDeviceName(preferred_name);
    if (!normalized.ok) {
      return jsonResponse({ error: normalized.error }, 400);
    }

    for (let attempt = 1; attempt <= MAX_DEVICE_NAME_ATTEMPTS; attempt++) {
      const newName = deviceNameCandidate(normalized.name, attempt);
      if (newName === device.name) {
        return jsonResponse({
          old_name: device.name,
          new_name: newName,
          status: "unchanged",
        });
      }

      const { error: updateError } = await supabase
        .from("devices")
        .update({ name: newName })
        .eq("id", device.id);

      if (!updateError) {
        return jsonResponse({
          old_name: device.name,
          new_name: newName,
          status: "renamed",
        });
      }

      if (isUniqueConstraintError(updateError, "devices_name_lower_unique")) {
        continue;
      }

      console.error("Device rename error:", updateError);
      return jsonResponse({ error: "Failed to rename device" }, 500);
    }

    return jsonResponse({ error: "Could not assign a unique device name" }, 500);
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
