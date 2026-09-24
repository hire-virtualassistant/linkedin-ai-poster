const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_FALLBACKS = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash"];
const RETIRED_GEMINI_MODELS = new Set([
  "gemini-1.5-flash", "gemini-1.5-pro",
  "gemini-2.0-flash", "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite", "gemini-2.0-flash-lite-001",
]);

function buildPrompt(keywords, description, country) {
  const descPart = description ? `\nContext / existing description:\n"""${description}"""\n` : "";
  return `You are an expert LinkedIn content strategist and SEO specialist.

Primary keywords: ${keywords}
Target audience country: ${country || "Global"}${descPart}

Task: Create the BEST possible LinkedIn post optimised for reach, SEO and engagement.
Analyse the keywords (and description if provided) and return ONLY valid minified JSON
(no markdown, no code fences) with EXACTLY these fields:

{
  "title": "a strong hook / headline for the post (max 100 chars)",
  "semantic_keywords": ["8-12 semantically related keywords"],
  "cluster_keywords": ["6-10 topic-cluster keywords grouping subtopics"],
  "hashtags": ["6-10 relevant hashtags without spaces, include the # symbol"],
  "content": "the full ready-to-publish LinkedIn post body. Use short lines, a strong hook first line, value in the middle, a clear CTA at the end, and put the hashtags on the last line. Use tasteful emojis."
}

Return JSON only.`;
}

function parseGeminiJson(text) {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/, "").trim();
  t = t.replace(/```$/, "").trim();
  const m = t.match(/\{[\s\S]*\}/);
  if (m) t = m[0];
  return JSON.parse(t);
}

async function callGeminiModel(model, apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`HTTP ${res.status} (${model}): ${detail.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
  const payload = await res.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini se valid response nahi mila: " + JSON.stringify(payload).slice(0, 500));
  return text;
}

async function discoverModels(apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.models || [];
    const names = [];
    for (const it of items) {
      if (!(it.supportedGenerationMethods || []).includes("generateContent")) continue;
      const n = (it.name || "").replace("models/", "");
      if (n.startsWith("gemini-") && n.includes("flash") &&
          !["image", "live", "audio", "tts", "thinking", "robotics", "computer"].some((x) => n.includes(x))) {
        names.push(n);
      }
    }
    names.sort((a, b) => {
      const aLite = a.includes("lite") ? 0 : 1;
      const bLite = b.includes("lite") ? 0 : 1;
      if (aLite !== bLite) return aLite - bLite;
      return a.localeCompare(b);
    });
    return names;
  } catch {
    return [];
  }
}

async function geminiGenerate(prompt, apiKey, model) {
  let first = (model || DEFAULT_GEMINI_MODEL).trim();
  if (RETIRED_GEMINI_MODELS.has(first)) first = DEFAULT_GEMINI_MODEL;
  const candidates = [first, ...GEMINI_FALLBACKS.filter((m) => m !== first)];

  let lastErr = null;
  for (const m of candidates) {
    try {
      const text = await callGeminiModel(m, apiKey, prompt);
      return { text, modelUsed: m };
    } catch (e) {
      lastErr = e;
      if (e.status === 404) continue;
      throw e;
    }
  }

  const tried = new Set(candidates);
  const discovered = await discoverModels(apiKey);
  for (const m of discovered) {
    if (tried.has(m)) continue;
    try {
      const text = await callGeminiModel(m, apiKey, prompt);
      return { text, modelUsed: m };
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr || new Error("Gemini model available nahi hai.");
}

module.exports = { DEFAULT_GEMINI_MODEL, RETIRED_GEMINI_MODELS, buildPrompt, parseGeminiJson, geminiGenerate };
