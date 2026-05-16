import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  deviceNameCandidate,
  isUniqueConstraintError,
  MAX_DEVICE_NAME_ATTEMPTS,
  normalizeDeviceName,
} from "../_shared/device_names.ts";

const PREFIXES = [
  "Pixel", "Byte", "Circuit", "Tiny", "Nano", "Micro", "Neon", "Flux",
  "Zinc", "Cobalt", "Spark", "Glitch", "Pulse", "Signal", "Drift",
  "Echo", "Static", "Copper", "Silicon", "Carbon", "Volt", "Watt",
  "Ohm", "Quartz", "Binary", "Logic", "Raster", "Vector", "Voxel",
];

const SUFFIXES = [
  "Drifter", "Walker", "Smith", "Ghost", "Runner", "Weaver", "Coder",
  "Bot", "Chip", "Node", "Core", "Bug", "Bit", "Punk", "Monk",
  "Fox", "Owl", "Bee", "Ant", "Cat", "Rat", "Pup", "Cub",
  "Sage", "Muse", "Bard", "Scribe", "Pilot", "Scout", "Nomad",
];

function generateHandle(): string {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  return `${prefix}${suffix}`;
}

function chooseRequestedName(preferredName: unknown): string {
  const normalized = normalizeDeviceName(preferredName);
  return normalized.ok ? normalized.name : generateHandle();
}

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
    const { device_fingerprint, preferred_name, is_rpi } = await req.json();

    if (!device_fingerprint) {
      return jsonResponse({ error: "device_fingerprint is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await supabase
      .from("devices")
      .select("id, token, name")
      .eq("device_fingerprint", device_fingerprint)
      .single();

    if (existing) {
      return jsonResponse({
        device_id: existing.id,
        token: existing.token,
        assigned_name: existing.name,
      });
    }

    const requestedName = chooseRequestedName(preferred_name);
    for (let attempt = 1; attempt <= MAX_DEVICE_NAME_ATTEMPTS; attempt++) {
      const assignedName = deviceNameCandidate(requestedName, attempt);
      const { data: device, error } = await supabase
        .from("devices")
        .insert({ device_fingerprint, name: assignedName, is_rpi: !!is_rpi })
        .select("id, token, name")
        .single();

      if (!error && device) {
        return jsonResponse({
          device_id: device.id,
          token: device.token,
          assigned_name: device.name,
        }, 201);
      }

      if (isUniqueConstraintError(error, "devices_name_lower_unique")) {
        continue;
      }

      if (isUniqueConstraintError(error, "devices_device_fingerprint_key")) {
        const { data: raceExisting } = await supabase
          .from("devices")
          .select("id, token, name")
          .eq("device_fingerprint", device_fingerprint)
          .single();
        if (raceExisting) {
          return jsonResponse({
            device_id: raceExisting.id,
            token: raceExisting.token,
            assigned_name: raceExisting.name,
          });
        }
      }

      console.error("Registration error:", error);
      return jsonResponse({ error: "Registration failed" }, 500);
    }

    return jsonResponse({ error: "Could not assign a unique device name" }, 500);
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
