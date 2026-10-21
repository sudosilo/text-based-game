"use strict";

// This game has no Claude key of its own. Every turn goes to the shared server.
const SHARED = (process.env.SHARED_SERVER_URL || "").replace(/\/+$/, "");

module.exports = async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  if (req.method === "GET") {
    if (!SHARED) return res.status(200).json({ ok: true, name: "text-based-game-v1", ai: false });
    try {
      const r = await fetch(SHARED + "/api/shared-server-v1-claude");
      const d = await r.json();
      return res.status(200).json({ ok: true, name: "text-based-game-v1", ai: Boolean(d.ai) });
    } catch (e) {
      return res.status(200).json({ ok: true, name: "text-based-game-v1", ai: false });
    }
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!SHARED) return res.status(503).json({ error: "no shared server" });
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    body = body || {};
    const r = await fetch(SHARED + "/api/shared-server-v1-claude", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": String(req.headers["x-forwarded-for"] || "")
      },
      body: JSON.stringify({ app: "text-based-game", text: body.text, state: body.state })
    });
    const d = await r.json();
    return res.status(r.status).json(d);
  } catch (e) {
    console.error(e.message);
    return res.status(500).json({ error: "engine failed" });
  }
};
