async function linkedinGetAuthorUrn(token) {
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const r = await fetch("https://api.linkedin.com/v2/userinfo", { headers });
    if (r.ok) {
      const info = await r.json();
      if (info.sub) return `urn:li:person:${info.sub}`;
    }
  } catch {}
  const r2 = await fetch("https://api.linkedin.com/v2/me", { headers });
  if (!r2.ok) throw new Error(`HTTP ${r2.status}: ${(await r2.text()).slice(0, 400)}`);
  const info2 = await r2.json();
  if (info2.id) return `urn:li:person:${info2.id}`;
  throw new Error("LinkedIn author URN nahi mil saka. Token/scopes check karein.");
}

async function linkedinPost(text, token, authorUrn) {
  if (!token) throw new Error("LinkedIn access token settings me save nahi hai.");
  if (!authorUrn) throw new Error("LinkedIn author URN nahi mila.");

  const body = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 400)}`);
  }
  const rid = res.headers.get("x-restli-id") || "";
  const raw = await res.text();
  return { id: rid, raw };
}

module.exports = { linkedinGetAuthorUrn, linkedinPost };
