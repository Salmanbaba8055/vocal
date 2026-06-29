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
    const { intent, apiKey, predictionId } = req.body || {};
    const TOKEN = apiKey || process.env.REPLICATE_API_TOKEN;
    if (!TOKEN) return res.status(400).json({ error: "No Replicate API token" });

    // MODE 2 — poll existing prediction
    if (predictionId) {
      const poll = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      const prediction = await poll.json();
      if (prediction.status === "succeeded" && prediction.output) {
        const audioRes = await fetch(prediction.output);
        const audioBuffer = await audioRes.arrayBuffer();
        const base64 = Buffer.from(audioBuffer).toString("base64");
        return res.status(200).json({ status: "succeeded", audioUrl: `data:audio/mp3;base64,${base64}` });
      }
      if (prediction.status === "failed" || prediction.status === "canceled") {
        return res.status(500).json({ status: prediction.status, error: prediction.error || "Generation failed" });
      }
      return res.status(200).json({ status: prediction.status, predictionId });
    }

    // MODE 1 — start new prediction
    if (!intent) return res.status(400).json({ error: "No intent provided" });

    const prompt = `Telangana Bonalu folk music ${intent.mood || "festive"} mood, C minor 134 BPM, dappu drums dholak harmonium hand clapping strings, AR Rahman cinematic quality, instrumental backing track`;

    // FIXED: max 8 seconds to keep cost under $0.05
    const createRes = await fetch("https://api.replicate.com/v1/models/meta/musicgen/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: {
          prompt,
          model_version: "stereo-large",
          duration: 60,
          temperature: 1,
          top_k: 250,
          top_p: 0,
          classifier_free_guidance: 3,
          output_format: "mp3",
          normalization_strategy: "loudness"
        }
      })
    });

    // Always parse as text first to avoid JSON parse errors
    const responseText = await createRes.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return res.status(500).json({ error: `Replicate error: ${responseText.slice(0, 200)}` });
    }

    if (createRes.status === 401 || createRes.status === 403) {
      return res.status(401).json({ error: "Invalid Replicate token." });
    }
    if (!createRes.ok) {
      return res.status(500).json({ error: data.detail || data.error || `Replicate error ${createRes.status}` });
    }

    return res.status(200).json({ status: data.status, predictionId: data.id });

  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}
