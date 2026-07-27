/**
 * Supabase Edge Function: parse-job-link
 *
 * Deploy when ready:
 *   supabase functions deploy parse-job-link
 *
 * Set secrets: OPENAI_API_KEY (or your LLM provider key)
 *
 * Fetches the job URL (best-effort) and asks an LLM for { company, job_role }.
 * Returns empty fields rather than guessing when the page cannot be read.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url || typeof url !== "string") {
      return Response.json({ success: false, error: "url required" }, { status: 400, headers: cors });
    }

    let pageText = "";
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "JobPilotBot/1.0 (+job-link-parse)" },
        redirect: "follow",
      });
      const html = await res.text();
      pageText = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 12000);
    } catch {
      pageText = "";
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return Response.json(
        {
          success: false,
          error: "OPENAI_API_KEY not configured",
          company: "",
          job_role: "",
        },
        { headers: cors },
      );
    }

    const prompt = `Extract the employer company name and job title from this job posting.
Return ONLY valid JSON: {"company":"...","job_role":"..."}.
If unknown, use empty strings. Never invent. URL: ${url}
Page text (may be empty if blocked): ${pageText || "(unavailable)"}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You extract structured job metadata. Never invent." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return Response.json(
        { success: false, error: errText.slice(0, 300), company: "", job_role: "" },
        { headers: cors },
      );
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { company?: string; job_role?: string; jobRole?: string } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    return Response.json(
      {
        success: true,
        company: (parsed.company || "").trim(),
        job_role: (parsed.job_role || parsed.jobRole || "").trim(),
      },
      { headers: cors },
    );
  } catch (e) {
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "failed", company: "", job_role: "" },
      { status: 500, headers: cors },
    );
  }
});
