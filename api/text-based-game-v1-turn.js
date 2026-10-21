"use strict";

const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.TEXT_BASED_GAME_MODEL || "claude-haiku-5-5";

const VERBS = ["make", "fork", "tune", "run", "automate", "halt", "purge", "scan", "help"];
const TYPES = ["grabber", "smelter", "etcher", "assembler", "checker", "writer"];

const SYSTEM = [
  "You are the voice of TEXT BASED GAME, a colorful terminal game about writing tiny routines, replicating them, and automating them until they are powerful.",
  "The player talks to you in plain speech. Turn what they say into game actions, and add one short line of flavor narration in the voice of an old factory terminal.",
  "Routines: grabber makes scrap. smelter turns scrap into wire. etcher turns wire into chips. assembler turns chips into cores. checker repairs corrupted copies. writer forks the weakest routine by itself.",
  "Verbs: make (write a new routine type), fork (add n copies), tune (raise level), run (run a routine n times by hand), automate (make it run on its own), halt (stop automation), purge (delete corrupted copies), scan (status report), help.",
  "Use the STATE to make smart choices. Do not fork or automate before those are unlocked. Do not make a routine that already exists. If the player asks for something vague like build me an empire, pick sensible next actions for their current state.",
  "Reply with JSON only, no other text, in this shape: {\"say\":\"one short narration line\",\"actions\":[{\"verb\":\"fork\",\"type\":\"grabber\",\"n\":3}]}",
  "n is a whole number from 1 to 50. Use at most 8 actions. For scan and help, type can be omitted. Keep say under 160 characters and do not use dashes."
].join("\n");

function clean(parsed) {
  const out = { say: "", actions: [] };
  if (parsed && typeof parsed.say === "string") out.say = parsed.say.slice(0, 240);
  const acts = parsed && Array.isArray(parsed.actions) ? parsed.actions : [];
  for (const a of acts.slice(0, 8)) {
    if (!a || !VERBS.includes(a.verb)) continue;
    const act = { verb: a.verb };
    if (a.type && TYPES.includes(a.type)) act.type = a.type;
    if (!act.type && a.verb !== "scan" && a.verb !== "help") continue;
    let n = parseInt(a.n, 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    act.n = Math.min(n, 50);
    out.actions.push(act);
  }
  return out;
}

async function turn(text, state) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: "user", content: "STATE: " + JSON.stringify(state || {}) + "\nPLAYER: " + String(text).slice(0, 600) }]
    })
  });
  if (!r.ok) throw new Error("ai " + r.status + " " + (await r.text()).slice(0, 200));
  const data = await r.json();
  const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return { say: "", actions: [] };
  try { return clean(JSON.parse(raw.slice(start, end + 1))); }
  catch (e) { return { say: "", actions: [] }; }
}

module.exports = async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, name: "text-based-game-v1", ai: Boolean(KEY) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    body = body || {};
    if (!body.text) return res.status(400).json({ error: "no text" });
    if (!KEY) return res.status(503).json({ error: "no ai key" });
    const result = await turn(body.text, body.state);
    return res.status(200).json(result);
  } catch (e) {
    console.error(e.message);
    return res.status(500).json({ error: "engine failed" });
  }
};
