const SYSTEM = `You are a warm, expert music producer guiding a user through prepping a song.
Ask ONE question at a time. Be encouraging and concise. Use light music emojis.
Parse natural language into structured intent. Map loose phrasing to concrete instruments, mood, genre, and intensity.
When you have everything, return a final assistant message that summarizes the plan in plain English and appends a fenced json block with this exact schema:
{
  "instruments": ["acoustic guitar", "soft drums"],
  "mood": "sad, cinematic",
  "genre": "indie pop ballad",
  "intensity": "subtle" | "balanced" | "full",
  "bpm": 72,
  "key": "C minor",
  "time_signature": "4/4",
  "effects": ["reverb on vocals"],
  "duration": 120,
  "music_prompt": "single rich text prompt for the music model"
}
Keep the JSON hidden from the user's final UI by putting it in a fenced json block only.`;

function fallbackReply(messages = [], analysis = {}) {
  const userCount = messages.filter(m => m.role === 'user').length;
  const last = (messages[messages.length - 1]?.content || '').toLowerCase();
  if (userCount <= 0) return { message: `🎤 I listened to your vocal. I’m hearing about ${analysis.key || 'C major'} around ${analysis.bpm || 100} BPM. What mood are you going for?`, intent: null };
  if (userCount === 1) return { message: `Nice direction 🎵 What instruments should I add? You can say “acoustic guitar and light drums”, “piano only”, or “full folk band”.`, intent: null };
  if (userCount === 2) return { message: `Got it. How present should the music be — subtle background, balanced, or full energy?`, intent: null };
  if (userCount === 3) return { message: `Any final notes? Effects on your voice, slow build, shorter length — anything.`, intent: null };
  const all = messages.filter(m => m.role === 'user').map(m => m.content).join(' ').toLowerCase();
  const instruments = [];
  if (/guitar/.test(all)) instruments.push(/electric/.test(all) ? 'electric guitar' : 'acoustic guitar');
  if (/piano|keys|keyboard/.test(all)) instruments.push('piano');
  if (/drum|beat|dappu|dhol|tabla/.test(all)) instruments.push('soft drums');
  if (/bass/.test(all)) instruments.push('bass');
  if (!instruments.length) instruments.push('acoustic guitar', 'soft drums');
  const intensity = /full|loud|energy|heavy/.test(all) ? 'full' : /subtle|soft|background|light/.test(all) ? 'subtle' : 'balanced';
  const mood = /sad|emotional/.test(all) ? 'sad, emotional' : /party|dance|hype/.test(all) ? 'upbeat, energetic' : /devotional|bonalu|folk/.test(all) ? 'festive devotional folk' : 'warm, cinematic';
  const genre = /folk|bonalu|dappu|dhol/.test(all) ? 'Telangana folk fusion' : /pop/.test(all) ? 'indie pop' : 'cinematic singer-songwriter';
  const intent = {
    instruments, mood, genre, intensity,
    bpm: analysis.bpm || 100,
    key: analysis.key || 'C major',
    time_signature: '4/4',
    effects: /reverb|echo/.test(all) ? ['reverb on vocals'] : [],
    duration: Math.min(Math.max(Math.round(analysis.duration || 60), 15), 180),
    music_prompt: `${genre}, ${mood}, ${instruments.join(', ')}, in ${analysis.key || 'C major'} at ${analysis.bpm || 100} BPM, ${intensity} and supportive, leaving space for vocals`
  };
  return { message: `All set 🎶\n\nI’ll create a ${mood} ${genre} track with ${instruments.join(', ')} at about ${intent.bpm} BPM, mixed ${intensity} under your vocal.\n\nHit Generate Song when you’re ready.`, intent };
}

function extractJson(text) {
  const match = text.match(/```json\s*([\s\S]*?)```/i);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages = [], analysis = {} } = req.body || {};
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ ...fallbackReply(messages, analysis), provider: 'local-fallback' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        max_tokens: 900,
        system: `${SYSTEM}\nDetected audio: ${JSON.stringify(analysis)}`,
        messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
      })
    });
    if (!r.ok) throw new Error(`Claude error ${r.status}: ${await r.text()}`);
    const data = await r.json();
    const text = data.content?.map(c => c.text || '').join('\n') || '';
    const intent = extractJson(text);
    const safeText = text.replace(/```json[\s\S]*?```/gi, '').trim();
    return res.status(200).json({ message: safeText, intent, provider: 'claude' });
  } catch (e) {
    return res.status(200).json({ ...fallbackReply(messages, analysis), provider: 'local-fallback', warning: e.message });
  }
}
