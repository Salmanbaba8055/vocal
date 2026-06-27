export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { intent, apiKey } = req.body || {};
  if (!intent || !intent.music_prompt) return res.status(400).json({ error: "No intent provided" });

  const TOKEN = apiKey || process.env.REPLICATE_API_TOKEN;
  if (!TOKEN) return res.status(400).json({ error: "No API token provided" });

  try {
    const createRes = await fetch("https://api.replicate.com/v1/models/meta/musicgen/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        "Prefer": "wait=60"
      },
      body: JSON.stringify({
        input: {
          prompt: intent.music_prompt,
          model_version: "stereo-large",
          duration: 8,
          temperature: 1,
          top_k: 250,
          top_p: 0,
          classifier_free_guidance: 3,
          output_format: "mp3",
          normalization_strategy: "loudness"
        }
      })
    });

    if (createRes.status === 401) return res.status(401).json({ error: "Invalid Replicate API token." });
    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      return res.status(500).json({ error: err.detail || `Replicate error ${createRes.status}` });
    }

    let prediction = await createRes.json();
    let attempts = 0;

    while (prediction.status !== "succeeded" && prediction.status !== "failed" && attempts < 30) {
      await new Promise(r => setTimeout(r, 3000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      prediction = await pollRes.json();
      attempts++;
    }

    if (prediction.status === "failed") return res.status(500).json({ error: "Generation failed: " + (prediction.error || "unknown") });
    if (!prediction.output) return res.status(500).json({ error: "No audio output returned" });

    const audioRes = await fetch(prediction.output);
    const audioBuffer = await audioRes.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString("base64");
    return res.status(200).json({ audioUrl: `data:audio/mp3;base64,${base64}` });

  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}
