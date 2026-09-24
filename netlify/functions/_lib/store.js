const { getStore } = require("@netlify/blobs");

// Ek hi "data" store me do blobs rakhte hain: "settings" (object) aur "posts" (array).
// Netlify Blobs khud persistent hai - alag se koi database setup nahi chahiye.

function dataStore() {
  return getStore("linkedin-poster-data");
}

async function getSettings() {
  const store = dataStore();
  const s = await store.get("settings", { type: "json" });
  return s || {};
}

async function saveSettings(patch) {
  const store = dataStore();
  const current = await getSettings();
  const updated = { ...current, ...patch };
  await store.setJSON("settings", updated);
  return updated;
}

async function getPosts() {
  const store = dataStore();
  const posts = await store.get("posts", { type: "json" });
  return posts || [];
}

async function savePosts(posts) {
  const store = dataStore();
  await store.setJSON("posts", posts);
}

async function nextId() {
  const store = dataStore();
  const meta = (await store.get("meta", { type: "json" })) || { lastId: 0 };
  meta.lastId += 1;
  await store.setJSON("meta", meta);
  return meta.lastId;
}

module.exports = { getSettings, saveSettings, getPosts, savePosts, nextId };
