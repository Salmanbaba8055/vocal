export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let body = {};
  try {
    if (typeof req.body === "object" && req.body !== null) {
      body = req.body;
    } else {
      const raw = await new Promise((resolve) => {
        let data = "";
        req.on("data", chunk => { data += chunk; });
        req.on("end", () => resolve(data));
      });
      body = JSON.parse(raw || "{}");
    }
  } catch (e) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { intent, apiKey } = body;

  if (!intent) return res.status(400).json({ error: "No intent provided" });

  const TOKEN = apiKey || process.env.REPLICATE_API_TOKEN;
  if (!TOKEN) return res.status(400).json({ error: "No Replicate API token provided" });

  const prompt = `Authentic South Indian Telangana folk music, ${intent.mood || "festive"} mood, featuring powerful dappu frame drum rhythm and dholak beats, bright harmonium melody, rhythmic hand clapping, ${intent.intensity === "full" ? "very loud powerful festival percussion, high energy full band sound" : intent.intensity === "subtle" ? "soft gentle melodic background" : "warm balanced folk accompaniment"}, ${intent.bpm || 130} BPM, Bonalu festival celebration style, Telangana devotional folk song, cinematic professional recording quality, ${intent.instruments?.join(", ") || "frame drum, dholak, harmonium"}`;

  try {
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: "b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38",
        input: {
          prompt: prompt,
          model_version: "stereo-melody-large",
          duration: 15,
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
      const e = await createRes.json().catch(() => ({}));
      return res.status(500).json({ error: e.detail || `Replicate error ${createRes.status}` });
    }

    let prediction = await createRes.json();
    let attempts = 0;

    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      prediction.status !== "canceled" &&
      attempts < 40
    ) {
      await new Promise(r => setTimeout(r, 3000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      prediction = await poll.json();
      attempts++;
    }

    if (prediction.status !== "succeeded" || !prediction.output) {
      return res.status(500).json({ error: "Generation failed: " + (prediction.error || "no output") });
    }

    const audioRes = await fetch(prediction.output);
    const audioBuffer = await audioRes.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString("base64");
    return res.status(200).json({ audioUrl: `data:audio/mp3;base64,${base64}` });

  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}
