// ------- helpers -------
async function api(path, method = "GET", body = null) {
  const opt = { method, headers: { "Content-Type": "application/json" } };
  if (body) opt.body = JSON.stringify(body);
  const r = await fetch(path, opt);
  const data = await r.json();
  if (!r.ok || data.ok === false) throw new Error(data.error || "Request failed");
  return data;
}
function $(id){ return document.getElementById(id); }
function toast(msg, err = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show" + (err ? " err" : "");
  setTimeout(() => (t.className = "toast"), 4000);
}
function esc(s){ return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// ------- connection badge -------
async function refreshConn() {
  try {
    const s = await api("/api/settings");
    const g = s.gemini_api_key_set, l = s.linkedin_token_set;
    const el = $("conn");
    if (!el) return s;
    if (g && l) { el.className = "pill green"; el.innerHTML = '<span class="status-dot on"></span> Connected'; }
    else if (g || l) { el.className = "pill"; el.innerHTML = '<span class="status-dot on"></span> Partial setup'; }
    else { el.className = "pill grey"; el.innerHTML = '<span class="status-dot"></span> Not configured'; }
    return s;
  } catch(e){ return {}; }
}

// ------- load countries into any select -------
async function loadCountries(defaultC) {
  const { countries } = await api("/api/countries");
  ["country","defCountry"].forEach(id => {
    const sel = $(id);
    if (!sel) return;
    sel.innerHTML = "";
    countries.forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      if (c === defaultC) o.selected = true;
      sel.appendChild(o);
    });
  });
}

let LAST_TIME = null;       // recommended_iso (UTC) — best time jo user ko dikhaya gaya
let LAST_TIME_COUNTRY = null; // ye time kis country ke liye tha (dobara fetch se bachne ke liye)

// Laptop/browser ka asli abhi ka time — ISO UTC string.
// Server apne clock ki bajaye isi ko "now" maan kar best time calculate karta hai.
function clientNowIso() {
  return new Date().toISOString();
}

function selectTime(iso, displayText, country) {
  LAST_TIME = iso;
  LAST_TIME_COUNTRY = country;
  $("timeBig").textContent = "🕒 " + displayText;
  toast("Waqt select ho gaya: " + displayText);
}

async function fetchWeekSlots(country) {
  const d = await api("/api/best-times-week", "POST", { country, client_now_iso: clientNowIso() });
  const box = $("weekSlots");
  if (!box) return;
  box.innerHTML = d.slots.map(s => {
    if (!s.available) {
      return `<div class="muted" style="opacity:.6">${s.day_name} (${s.date}) — aaj ke slots guzar chuke</div>`;
    }
    const peakBadge = s.is_peak_day ? ' <span class="pill green">peak</span>' : "";
    const escDisp = s.recommended_display.replace(/'/g, "\\'");
    return `<div class="row" style="align-items:center;justify-content:space-between">
      <div>${s.day_name} (${s.date}) — ${s.hour_label}${peakBadge}</div>
      <button class="btn ghost" type="button" onclick="selectTime('${s.recommended_iso}','${escDisp}','${country}')">Ye waqt choose karein</button>
    </div>`;
  }).join("");
}

async function fetchBestTime(country) {
  const d = await api("/api/best-time", "POST", { country, client_now_iso: clientNowIso() });
  LAST_TIME = d.recommended_iso;
  LAST_TIME_COUNTRY = country;
  $("timeBox").style.display = "block";
  $("timeBig").textContent = "🕒 " + d.recommended_display;
  $("timePkt").textContent = "🇵🇰 Aapke laptop (PKT) ke hisab se: " + d.recommended_pkt_display +
    (d.is_next_day ? "  — (agle din ka waqt hai, aaj ke slots guzar chuke)" : "");
  $("timeReason").textContent = d.reason;
  $("timeTags").innerHTML =
    d.best_days.map(x => `<span class="pill green">${x}</span>`).join("") +
    d.best_hours.map(x => `<span class="pill">${x}</span>`).join("");
  fetchWeekSlots(country).catch(() => {});
  return d;
}

// ================= HOME PAGE =================
function initHome() {
  $("btnTime").onclick = async () => {
    const b = $("btnTime"); b.disabled = true; b.innerHTML = '<span class="loader"></span> ...';
    try {
      await fetchBestTime($("country").value);
      toast("Best time generate ho gaya!");
    } catch(e){ toast(e.message, true); }
    b.disabled = false; b.textContent = "Generate Best Time";
  };

  $("btnGen").onclick = async () => {
    const kw = $("keywords").value.trim();
    if (!kw) return toast("Keywords likhein.", true);
    const b = $("btnGen"); b.disabled = true; b.innerHTML = '<span class="loader"></span> Generating...';
    try {
      const d = await api("/api/generate", "POST", {
        keywords: kw,
        description: $("description").value.trim(),
        country: $("country").value,
      });
      const p = d.post;
      // Title alag field me nahi dikhaya jata — content khud hook/headline
      // ke sath complete hota hai. Title sirf history list ke label ke
      // liye internally save ho jata hai.
      $("outContent").value = p.content || "";
      renderKeywords(p);
      window._gen = p;
      toast("Post ban gaya! Ab Submit karein.");
    } catch(e){ toast(e.message, true); }
    b.disabled = false; b.textContent = "✨ Generate Best Post";
  };

  $("btnSubmit").onclick = async () => {
    const payload = collectPost();
    if (!payload.content) return toast("Pehle post generate karein.", true);
    const b = $("btnSubmit"); b.disabled = true; b.innerHTML = '<span class="loader"></span> Submit ho raha hai...';
    try {
      // Agar is country ke liye best time abhi generate nahi hua, ya
      // country badal gaya hai, to pehle taaza best time nikalo.
      if (!LAST_TIME || LAST_TIME_COUNTRY !== payload.country) {
        await fetchBestTime(payload.country);
      }
      payload.scheduled_iso = LAST_TIME;
      const d = await api("/api/schedule", "POST", payload);
      toast("Post submit ho gayi — LinkedIn ke schedule me " + $("timeBig").textContent.replace("🕒 ", "") + " par chali gayi.");
      loadPosts();
    } catch(e){ toast(e.message, true); }
    b.disabled = false; b.innerHTML = "✅ Submit Post";
  };

  $("btnRefresh").onclick = loadPosts;

  refreshConn().then(s => loadCountries(s.default_country || "Pakistan"));
  loadPosts();
}

function renderKeywords(p) {
  const box = $("kwBox");
  const sec = (title, arr) => arr && arr.length
    ? `<label>${title}</label><div class="tag-list">${arr.map(k=>`<span class="pill">${esc(k)}</span>`).join("")}</div>` : "";
  box.innerHTML =
    sec("Semantic Keywords", p.semantic_keywords) +
    sec("Cluster Keywords", p.cluster_keywords) +
    sec("Hashtags", p.hashtags);
}

function collectPost() {
  const g = window._gen || {};
  return {
    title: g.title || "",              // sirf internal label ke liye, UI me editable field nahi
    content: $("outContent").value,
    keywords: $("keywords").value,
    semantic_keywords: g.semantic_keywords || [],
    cluster_keywords: g.cluster_keywords || [],
    hashtags: g.hashtags || [],
    country: $("country").value,
  };
}

async function loadPosts() {
  try {
    const { posts } = await api("/api/posts");
    const box = $("posts");
    if (!posts.length) { box.innerHTML = '<div class="hint">Abhi koi post nahi hai.</div>'; return; }
    box.innerHTML = posts.map(p => {
      let when = p.scheduled_time ? new Date(p.scheduled_time).toLocaleString() : "-";
      // Title field UI se hata di gayi hai — list me heading ke liye
      // content ki pehli line ya saved title (agar AI ne banayi thi) use karte hain.
      const heading = p.title || (p.content || "").split("\n")[0].slice(0, 80) || "(no content)";
      return `<div class="post-item">
        <div class="spread">
          <div class="t">${esc(heading)}</div>
          <span class="st ${p.status}">${p.status}</span>
        </div>
        <div class="m">📅 ${when} &nbsp;·&nbsp; 🌍 ${esc(p.country||"-")}</div>
        ${p.error ? `<div class="m" style="color:#ef4444">⚠ ${esc(p.error)}</div>` : ""}
        <div style="margin-top:10px" class="row">
          ${p.status !== "posted" ? `<button class="btn secondary" onclick="postNow(${p.id})">Publish Now</button>`:""}
          <button class="btn ghost" onclick="delPost(${p.id})">Delete</button>
        </div>
      </div>`;
    }).join("");
  } catch(e){ /* silent */ }
}

async function postNow(id) {
  try { await api("/api/post-now","POST",{id}); toast("Publish ho gaya!"); loadPosts(); }
  catch(e){ toast(e.message, true); loadPosts(); }
}
async function delPost(id) {
  try { await api("/api/delete-post","POST",{id}); loadPosts(); } catch(e){ toast(e.message,true); }
}

// ================= SETTINGS PAGE =================
function initSettings() {
  const fill = async () => {
    const s = await refreshConn();
    $("geminiState").textContent = s.gemini_api_key_set ? `✅ Saved (${s.gemini_api_key_masked})` : "Not set yet.";
    $("liState").textContent = s.linkedin_token_set
      ? `✅ Saved (${s.linkedin_token_masked})` + (s.linkedin_author_urn ? ` · URN: ${s.linkedin_author_urn}` : "")
      : "Not set yet.";
    if (s.gemini_model) $("geminiModel").value = s.gemini_model;
    if (s.linkedin_author_urn) $("liUrn").value = s.linkedin_author_urn;
    await loadCountries(s.default_country || "Pakistan");
  };

  $("btnSaveGemini").onclick = async () => {
    try {
      await api("/api/settings","POST",{
        gemini_api_key: $("geminiKey").value.trim(),
        gemini_model: $("geminiModel").value,
      });
      $("geminiKey").value = "";
      toast("Gemini settings saved & connected!");
      fill();
    } catch(e){ toast(e.message, true); }
  };

  $("btnSaveLi").onclick = async () => {
    try {
      await api("/api/settings","POST",{
        linkedin_token: $("liToken").value.trim(),
        linkedin_author_urn: $("liUrn").value.trim(),
        default_country: $("defCountry").value,
      });
      $("liToken").value = "";
      toast("LinkedIn settings saved!");
      fill();
    } catch(e){ toast(e.message, true); }
  };

  $("btnTestLi").onclick = async () => {
    const b = $("btnTestLi"); b.disabled = true; b.innerHTML = '<span class="loader"></span> Testing...';
    try {
      const d = await api("/api/test-linkedin","POST",{});
      toast("Connected! URN: " + d.author_urn);
      fill();
    } catch(e){ toast(e.message, true); }
    b.disabled = false; b.textContent = "Test & Connect";
  };

  fill();
}

// ------- boot -------
document.addEventListener("DOMContentLoaded", () => {
  if ($("btnGen")) initHome();
  else if ($("btnSaveGemini")) initSettings();
});
