async function createPrediction(input, version) {
  const r = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ version, input })
  });
  if (!r.ok) throw new Error(`Replicate create failed ${r.status}: ${await r.text()}`);
  return r.json();
}

async function getPrediction(url) {
  const r = await fetch(url, { headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` } });
  if (!r.ok) throw new Error(`Replicate poll failed ${r.status}: ${await r.text()}`);
  return r.json();
}

async function waitForPrediction(prediction) {
  let p = prediction;
  const start = Date.now();
  while (!['succeeded', 'failed', 'canceled'].includes(p.status)) {
    if (Date.now() - start > 1000 * 120) throw new Error('Generation timed out after 120 seconds');
    await new Promise(r => setTimeout(r, 2500));
    p = await getPrediction(p.urls.get);
  }
  if (p.status !== 'succeeded') throw new Error(p.error || `Prediction ${p.status}`);
  return p.output;
}

function outputToUrl(output) {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output.find(x => typeof x === 'string') || output[0]?.url;
  if (output && typeof output === 'object') return output.audio || output.url || output.output;
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.REPLICATE_API_TOKEN) return res.status(500).json({ error: 'REPLICATE_API_TOKEN is not set' });

  const { intent = {}, vocalDataUrl, engine = 'chord' } = req.body || {};
  if (!intent.music_prompt) return res.status(400).json({ error: 'Missing intent.music_prompt' });

  const chordVersion = process.env.REPLICATE_MUSICGEN_CHORD_VERSION;
  const melodyVersion = process.env.REPLICATE_MUSICGEN_MELODY_VERSION;

  try {
    let version;
    let input;

    if (engine === 'melody') {
      version = melodyVersion;
      if (!version) throw new Error('REPLICATE_MUSICGEN_MELODY_VERSION is not set');
      input = {
        model_version: 'stereo-melody-large',
        prompt: intent.music_prompt,
        input_audio: vocalDataUrl,
        continuation: false,
        duration: Math.min(Number(intent.duration || 60), 180),
        normalization_strategy: 'loudness',
        temperature: 1,
        top_k: 250,
        top_p: 0,
        classifier_free_guidance: 3,
        output_format: 'wav'
      };
    } else {
      version = chordVersion;
      if (!version) throw new Error('REPLICATE_MUSICGEN_CHORD_VERSION is not set');
      input = {
        prompt: intent.music_prompt,
        audio_chords: vocalDataUrl,
        bpm: Number(intent.bpm || 100),
        time_sig: intent.time_signature || '4/4',
        duration: Math.min(Number(intent.duration || 60), 180),
        temperature: 1,
        top_k: 250,
        top_p: 0,
        classifier_free_guidance: 3,
        output_format: 'wav'
      };
    }

    const prediction = await createPrediction(input, version);
    const output = await waitForPrediction(prediction);
    const audioUrl = outputToUrl(output);
    if (!audioUrl) throw new Error('Replicate succeeded but did not return an audio URL');
    return res.status(200).json({ audioUrl, predictionId: prediction.id, engine });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
