const { getSettings, getPosts, savePosts } = require("./store");
const { linkedinPost } = require("./linkedin");

async function publishPost(postId) {
  const posts = await getPosts();
  const idx = posts.findIndex((p) => p.id === postId);
  if (idx === -1) return { ok: false, error: "Post not found" };

  const s = await getSettings();
  const token = s.linkedin_token || "";
  const authorUrn = s.linkedin_author_urn || "";
  const text = posts[idx].content;

  try {
    const result = await linkedinPost(text, token, authorUrn);
    posts[idx].status = "posted";
    posts[idx].result = result;
    posts[idx].error = null;
    await savePosts(posts);
    console.log(`[publish] Post ${postId} LinkedIn par publish ho gaya.`);
    return { ok: true, result };
  } catch (e) {
    posts[idx].status = "failed";
    posts[idx].error = String(e.message || e);
    await savePosts(posts);
    console.log(`[publish] Post ${postId} FAIL: ${posts[idx].error}`);
    return { ok: false, error: posts[idx].error };
  }
}

module.exports = { publishPost };
