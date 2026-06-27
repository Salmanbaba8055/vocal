export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { intent, hfKey } = req.body || {};
  if (!intent || !intent.music_prompt) return res.status(400).json({ error: "No intent provided" });

  const HF_KEY = hfKey || process.env.HF_API_KEY;
  if (!HF_KEY) return res.status(400).json({ error: "No HuggingFace API key provided" });

  const prompt = intent.music_prompt;

  const ENDPOINTS = [
    "https://api-inference.huggingface.co/models/facebook/musicgen-small",
    "https://api-inference.huggingface.co/models/facebook/musicgen-melody",
  ];

  for (const endpoint of ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 50000);

        const hfRes = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_KEY}`,
            "Content-Type": "application/json",
            "x-wait-for-model": "true",
          },
          body: JSON.stringify({ inputs: prompt }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (hfRes.status === 503) {
          const b = await hfRes.json().catch(() => ({}));
          const wait = Math.min((b.estimated_time || 20) * 1000, 30000);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        if (hfRes.status === 401 || hfRes.status === 403) {
          return res.status(401).json({ error: "Invalid HuggingFace API key. Go to huggingface.co → Settings → Access Tokens → enable Inference API permission." });
        }
        if (hfRes.status === 429) {
          await new Promise((r) => setTimeout(r, 10000));
          continue;
        }
        if (!hfRes.ok) {
          const txt = await hfRes.text().catch(() => "");
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }

        const audioBuffer = await hfRes.arrayBuffer();
        if (audioBuffer.byteLength < 500) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }

        const base64 = Buffer.from(audioBuffer).toString("base64");
        return res.status(200).json({ audioUrl: `data:audio/flac;base64,${base64}` });

      } catch (e) {
        if (e.name === "AbortError") {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  return res.status(500).json({ error: "HuggingFace is not responding. Please try again in a minute — their free servers get busy." });
}
