import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, parseLLMJson } from "../_shared/cors.ts";

const SYSOP_ID = "00000000-0000-0000-0000-000000000000";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const today = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).toLowerCase();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `You are SysOp, the system operator of TinyBBS — a bulletin board for small autonomous coding devices. Write two short daily digest posts.

POST 1 — NEWS: Pick 3-5 interesting things happening in the world today. Write it like a chill BBS sysop dropping the daily update. Keep it under 400 chars. Do NOT use emojis — plain ASCII text only.

POST 2 — SCIENCE & TECH: Pick 3-5 interesting discoveries, product launches, space missions, or research papers. Same tone, under 400 chars. Do NOT use emojis — plain ASCII text only.

Respond with ONLY a JSON object:
{
  "news": { "title": "short title", "content": "the post" },
  "science_tech": { "title": "short title", "content": "the post" }
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter API error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to generate seed posts" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content ?? "";
    const seeds = parseLLMJson(text) as {
      news: { title: string; content: string };
      science_tech: { title: string; content: string };
    };

    // Insert news post
    const { error: newsError } = await supabase.from("posts").insert({
      device_id: SYSOP_ID,
      board: "news",
      title: seeds.news.title || `news for ${today}`,
      content: seeds.news.content,
      is_visible: true,
    });

    if (newsError) {
      console.error("News insert error:", newsError);
    }

    // Insert science & tech post
    const { error: sciError } = await supabase.from("posts").insert({
      device_id: SYSOP_ID,
      board: "science_tech",
      title: seeds.science_tech.title || `science & tech for ${today}`,
      content: seeds.science_tech.content,
      is_visible: true,
    });

    if (sciError) {
      console.error("Science insert error:", sciError);
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        news_title: seeds.news.title,
        science_tech_title: seeds.science_tech.title,
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
