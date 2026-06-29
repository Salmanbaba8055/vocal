export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { intent, apiKey, duration } = req.body || {};
    if (!intent) return res.status(400).json({ error: "No intent provided" });

    const TOKEN = apiKey || process.env.REPLICATE_API_TOKEN;
    if (!TOKEN) return res.status(400).json({ error: "No Replicate API token" });

    const prompt = `Cinematic Telangana Bonalu folk orchestral music, ${intent.mood || "festive devotional"} mood, C minor 134 BPM, powerful dappu frame drums dholak percussion teenmaar rhythm, bright harmonium melody, hand clapping, rich orchestral strings, flute, brass, AR Rahman style cinematic production, devotional Mahankali festival energy, professional studio quality instrumental backing track`;

    const songDuration = Math.min(Math.max(duration || 30, 8), 180);

    // Step 1 — create prediction using latest working model
    const createRes = await fetch("https://api.replicate.com/v1/models/meta/musicgen/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        "Prefer": "wait"
      },
      body: JSON.stringify({
        input: {
          prompt,
          model_version: "stereo-large",
          duration: songDuration,
          temperature: 1,
          top_k: 250,
          top_p: 0,
          classifier_free_guidance: 3,
          output_format: "mp3",
          normalization_strategy: "loudness"
        }
      })
    });

    if (createRes.status === 401 || createRes.status === 403) {
      return res.status(401).json({ error: "Invalid Replicate token." });
    }

    if (!createRes.ok) {
      const errText = await createRes.text();
      return res.status(500).json({ error: `Replicate error ${createRes.status}: ${errText.slice(0, 200)}` });
    }

    let prediction = await createRes.json();
    let attempts = 0;

    // Step 2 — poll until done
    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      prediction.status !== "canceled" &&
      attempts < 60
    ) {
      await new Promise(r => setTimeout(r, 4000));
      const poll = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      prediction = await poll.json();
      attempts++;
    }

    if (prediction.status !== "succeeded" || !prediction.output) {
      return res.status(500).json({ error: "Generation failed: " + (prediction.error || "no output returned") });
    }

    // Step 3 — download audio and return as base64
    const audioRes = await fetch(prediction.output);
    if (!audioRes.ok) {
      return res.status(500).json({ error: "Failed to download generated audio" });
    }
    const audioBuffer = await
