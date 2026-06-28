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

  const { intent, apiKey, vocalBase64, duration } = req.body || {};
  if (!intent) return res.status(400).json({ error: "No intent provided" });

  const TOKEN = apiKey || process.env.REPLICATE_API_TOKEN;
  if (!TOKEN) return res.status(400).json({ error: "No Replicate API token" });

  const prompt = `Cinematic South Indian Telangana Bonalu folk orchestral music, ${intent.mood || "festive devotional"} mood, C minor, 134 BPM teenmaar rhythm, powerful dappu frame drums and dholak percussion, melodic harmonium lead, rhythmic hand clapping, rich orchestral strings section swelling emotionally, flute melody, brass section, layered cinematic production like AR Rahman, devotional Mahankali goddess festival energy, authentic Telangana folk meets grand orchestral arrangement, full band sound, emotional powerful dramatic, perfectly timed instrumental backing track`;

  const songDuration = Math.min(Math.max(duration || 30, 10), 180);

  try {
    // Step 1 — Generate BGM via Replicate
    const input = {
      prompt,
      model_version: "stereo-melody-large",
      duration: songDuration,
      temperature: 1,
      top_k: 250,
      top_p: 0,
      classifier_free_guidance: 3,
      output_format: "wav",
      normalization_strategy: "loudness"
    };

    if (vocalBase64) {
      input.input_audio = vocalBase64;
      input.continuation = false;
    }

    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38",
        input
      })
    });

    if (createRes.status === 401 || createRes.status === 403) return res.status(401).json({ error: "Invalid Replicate token." });
    if (!createRes.ok) {
      const e = await createRes.json().catch(() => ({}));
      return res.status(500).json({ error: e.detail || `Replicate error ${createRes.status}` });
    }

    let prediction = await createRes.json();
    let attempts = 0;
    while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled" && attempts < 60) {
      await new Promise(r => setTimeout(r, 4000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
      prediction = await poll.json();
      attempts++;
    }

    if (prediction.status !== "succeeded" || !prediction.output) {
      return res.status(500).json({ error: "Generation failed: " + (prediction.error || "no output") });
    }

    // Step 2 — Download generated BGM
    const bgmRes = await fetch(prediction.output);
    const bgmBuffer = Buffer.from(await bgmRes.arrayBuffer());

    // Step 3 — If vocal provided, mix on server using ffmpeg via Replicate
    if (vocalBase64) {
      // Upload vocal and bgm to mix via Replicate ffmpeg
      const mixRes = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "57771a48-3737-4776-8d91-2a1db18d5e49",
          input: {
            audio1: vocalBase64,
            audio2: `data:audio/wav;base64,${bgmBuffer.toString("base64")}`,
            audio1_volume: 1.0,
            audio2_volume: 0.65
          }
        })
      });

      if (mixRes.ok) {
        let mixPrediction = await mixRes.json();
        let mixAttempts = 0;
        while (mixPrediction.status !== "succeeded" && mixPrediction.status !== "failed" && mixAttempts < 20) {
          await new Promise(r => setTimeout(r, 3000));
          const pollMix = await fetch(`https://api.replicate.com/v1/predictions/${mixPrediction.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
          mixPrediction = await pollMix.json();
          mixAttempts++;
        }
        if (mixPrediction.status === "succeeded" && mixPrediction.output) {
          const mixedRes = await fetch(mixPrediction.output);
          const mixedBuffer = Buffer.from(await mixedRes.arrayBuffer());
          return res.status(200).json({ audioUrl: `data:audio/mp3;base64,${mixedBuffer.toString("base64")}`, mixed: true });
        }
      }
    }

    // Fallback — return BGM only if mix failed
    return res.status(200).json({ audioUrl: `data:audio/wav;base64,${bgmBuffer.toString("base64")}`, mixed: false });

  } catch (e) {
    return res.status(500).json({ error: "Server error: " + e.message });
  }
}
