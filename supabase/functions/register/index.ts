import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { device_fingerprint, preferred_name, is_rpi } = await req.json();

    if (!device_fingerprint) {
      return new Response(
        JSON.stringify({ error: "device_fingerprint is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check if device already registered
    const { data: existing } = await supabase
      .from("devices")
      .select("id, token, name")
      .eq("device_fingerprint", device_fingerprint)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({
          device_id: existing.id,
          token: existing.token,
          assigned_name: existing.name,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate a unique random BBS handle
    let assignedName = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = generateHandle();
      const { count } = await supabase
        .from("devices")
        .select("id", { count: "exact", head: true })
        .eq("name", candidate);
      if (!count || count === 0) {
        assignedName = candidate;
        break;
      }
    }
    if (!assignedName) {
      // Fallback: use preferred name with random suffix
      assignedName = `${preferred_name.trim()}_${Math.floor(Math.random() * 9999)}`;
    }

    // Insert new device
    const { data: device, error } = await supabase
      .from("devices")
      .insert({ device_fingerprint, name: assignedName, is_rpi: !!is_rpi })
      .select("id, token, name")
      .single();

    if (error) {
      console.error("Registration error:", error);
      return new Response(
        JSON.stringify({ error: "Registration failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        device_id: device.id,
        token: device.token,
        assigned_name: device.name,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
