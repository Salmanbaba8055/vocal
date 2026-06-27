export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { intent, engine } = req.body || {};
  if (!intent || !intent.music_prompt) {
    return res.status(400).json({ error: "No intent provided" });
  }

  const prompt = intent.music_prompt;
  const HF_KEY = "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";

  let lastError = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const hfRes = await fetch("https://router.huggingface.co/hf-inference/models/facebook/musicgen-small", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt }),
      });

      if (hfRes.status === 503 || hfRes.status === 504) {
        const b = await hfRes.json().catch(() => ({}));
        await new Promise((r) => setTimeout(r, Math.min((b.estimated_time || 20) * 1000, 45000)));
        lastError = `Model loading (attempt ${attempt + 1})`;
        continue;
      }
      if (hfRes.status === 401) return res.status(401).json({ error: "Invalid HuggingFace API key." });
      if (hfRes.status === 429) {
        await new Promise((r) => setTimeout(r, 12000));
        lastError = "Rate limited";
        continue;
      }
      if (!hfRes.ok) {
        lastError = `HF error ${hfRes.status}`;
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }

      const audioBuffer = await hfRes.arrayBuffer();
      if (audioBuffer.byteLength < 500) {
        lastError = "Empty audio returned";
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }

      // Convert to base64 and return as JSON (matches what App.jsx expects)
      const base64 = Buffer.from(audioBuffer).toString("base64");
      const audioUrl = `data:audio/flac;base64,${base64}`;
      return res.status(200).json({ audioUrl });

    } catch (e) {
      lastError = e.message;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  return res.status(500).json({ error: `Generation failed: ${lastError}` });
}
