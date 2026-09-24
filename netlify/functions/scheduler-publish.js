const { getPosts } = require("./_lib/store");
const { publishPost } = require("./_lib/publish");

// Netlify Scheduled Function: netlify.toml me "* * * * *" (har minute) set hai.
// Yeh un sab posts ko check karta hai jinka status "scheduled" hai aur jinka
// scheduled_time guzar chuka hai, phir unhe LinkedIn par publish kar deta hai.
exports.handler = async () => {
  const nowUtc = new Date();
  try {
    const posts = await getPosts();
    const due = posts.filter((p) => {
      if (p.status !== "scheduled" || !p.scheduled_time) return false;
      const dt = new Date(p.scheduled_time);
      return dt.getTime() <= nowUtc.getTime();
    });
    for (const p of due) {
      try {
        await publishPost(p.id);
      } catch (e) {
        console.error("[scheduler] row error:", e);
      }
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, published: due.length }) };
  } catch (e) {
    console.error("[scheduler] loop error:", e);
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: String(e.message || e) }) };
  }
};
