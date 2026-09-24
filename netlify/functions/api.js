const { getSettings, saveSettings, getPosts, savePosts, nextId } = require("./_lib/store");
const { COUNTRY_DATA, bestTimeForCountry, weekSlots } = require("./_lib/besttime");
const { DEFAULT_GEMINI_MODEL, RETIRED_GEMINI_MODELS, buildPrompt, parseGeminiJson, geminiGenerate } = require("./_lib/gemini");
const { linkedinGetAuthorUrn, linkedinPost } = require("./_lib/linkedin");
const { publishPost } = require("./_lib/publish");

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  // event.path = /.netlify/functions/api/<sub-path>  (redirect se ':splat' yahan aata hai)
  const full = event.path.replace(/^\/.netlify\/functions\/api/, "");
  const subPath = full.split("?")[0] || "/";
  const method = event.httpMethod;
  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.body); } catch { body = {}; }
  }

  try {
    if (method === "GET" && subPath === "/countries") {
      return json({ countries: Object.keys(COUNTRY_DATA).sort() });
    }

    if (method === "GET" && subPath === "/settings") {
      const s = await getSettings();
      const gkey = s.gemini_api_key || "";
      const token = s.linkedin_token || "";
      return json({
        gemini_api_key_set: !!gkey,
        gemini_api_key_masked: gkey.length > 8 ? gkey.slice(0, 4) + "..." + gkey.slice(-4) : (gkey ? "set" : ""),
        gemini_model: !RETIRED_GEMINI_MODELS.has(s.gemini_model) ? (s.gemini_model || DEFAULT_GEMINI_MODEL) : DEFAULT_GEMINI_MODEL,
        linkedin_token_set: !!token,
        linkedin_token_masked: token.length > 12 ? token.slice(0, 6) + "..." + token.slice(-4) : (token ? "set" : ""),
        linkedin_author_urn: s.linkedin_author_urn || "",
        default_country: s.default_country || "Pakistan",
      });
    }

    if (method === "GET" && subPath === "/posts") {
      const posts = await getPosts();
      return json({ posts: [...posts].sort((a, b) => b.id - a.id).slice(0, 100) });
    }

    if (method === "POST" && subPath === "/settings") {
      const patch = {};
      if (body.gemini_api_key) patch.gemini_api_key = String(body.gemini_api_key).trim();
      if (body.gemini_model) patch.gemini_model = String(body.gemini_model).trim();
      if (body.linkedin_token) {
        patch.linkedin_token = String(body.linkedin_token).trim();
        patch.linkedin_author_urn = ""; // reset so it re-fetches
      }
      if (body.linkedin_author_urn) patch.linkedin_author_urn = String(body.linkedin_author_urn).trim();
      if (body.default_country) patch.default_country = String(body.default_country).trim();
      await saveSettings(patch);
      return json({ ok: true, message: "Settings save ho gayi aur auto-connect ho gayi." });
    }

    if (method === "POST" && subPath === "/best-time") {
      const s = await getSettings();
      const country = body.country || s.default_country || "Pakistan";
      return json({ ok: true, ...bestTimeForCountry(country, body.client_now_iso) });
    }

    if (method === "POST" && subPath === "/best-times-week") {
      const s = await getSettings();
      const country = body.country || s.default_country || "Pakistan";
      return json({ ok: true, ...weekSlots(country, body.client_now_iso) });
    }

    if (method === "POST" && subPath === "/generate") {
      const keywords = (body.keywords || "").trim();
      const description = (body.description || "").trim();
      const s = await getSettings();
      const country = body.country || s.default_country || "Pakistan";
      if (!keywords) return json({ ok: false, error: "Keywords zaroori hain." }, 400);
      const apiKey = s.gemini_api_key || "";
      if (!apiKey) return json({ ok: false, error: "Gemini API key settings me save karein." }, 400);

      const prompt = buildPrompt(keywords, description, country);
      const { text, modelUsed } = await geminiGenerate(prompt, apiKey, s.gemini_model);
      if (modelUsed && modelUsed !== s.gemini_model) await saveSettings({ gemini_model: modelUsed });

      let parsed;
      try {
        parsed = parseGeminiJson(text);
      } catch {
        parsed = { title: keywords.slice(0, 80), semantic_keywords: [], cluster_keywords: [], hashtags: [], content: text };
      }
      return json({ ok: true, post: parsed });
    }

    if (method === "POST" && subPath === "/schedule") {
      const s = await getSettings();
      const country = body.country || s.default_country || "Pakistan";
      let scheduledIso = body.scheduled_iso;
      if (!scheduledIso) {
        scheduledIso = bestTimeForCountry(country, body.client_now_iso).recommended_iso;
      }
      const posts = await getPosts();
      const id = await nextId();
      const post = {
        id,
        title: body.title || "",
        content: body.content || "",
        keywords: body.keywords || "",
        semantic_keywords: body.semantic_keywords || [],
        cluster_keywords: body.cluster_keywords || [],
        hashtags: body.hashtags || [],
        country,
        scheduled_time: scheduledIso,
        status: "scheduled",
        created_at: new Date().toISOString(),
        result: null,
        error: null,
      };
      posts.push(post);
      await savePosts(posts);
      return json({ ok: true, id, scheduled_time: scheduledIso, message: "Post schedule ho gaya. Timer par LinkedIn par auto publish ho jayega." });
    }

    if (method === "POST" && subPath === "/post-now") {
      if (body.id) {
        const res = await publishPost(Number(body.id));
        return json(res, res.ok ? 200 : 400);
      }
      const posts = await getPosts();
      const id = await nextId();
      const post = {
        id,
        title: body.title || "",
        content: body.content || "",
        keywords: body.keywords || "",
        semantic_keywords: body.semantic_keywords || [],
        cluster_keywords: body.cluster_keywords || [],
        hashtags: body.hashtags || [],
        country: body.country || "",
        scheduled_time: null,
        status: "draft",
        created_at: new Date().toISOString(),
        result: null,
        error: null,
      };
      posts.push(post);
      await savePosts(posts);
      const res = await publishPost(id);
      res.id = id;
      return json(res, res.ok ? 200 : 400);
    }

    if (method === "POST" && subPath === "/test-linkedin") {
      const s = await getSettings();
      const token = s.linkedin_token || "";
      if (!token) return json({ ok: false, error: "Pehle LinkedIn token save karein." }, 400);
      const urn = await linkedinGetAuthorUrn(token);
      await saveSettings({ linkedin_author_urn: urn });
      return json({ ok: true, author_urn: urn, message: "LinkedIn connected!" });
    }

    if (method === "POST" && subPath === "/delete-post") {
      const posts = await getPosts();
      const filtered = posts.filter((p) => p.id !== Number(body.id));
      await savePosts(filtered);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Not found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: String(e.message || e) }, 400);
  }
};
