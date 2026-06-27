import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2, Pause, Play, RefreshCw, Send, Settings, Sliders, Upload, X, Zap } from 'lucide-react';

function audioBufferToWav(buffer) {
  const channels = buffer.numberOfChannels, sampleRate = buffer.sampleRate, length = buffer.length;
  const dataSize = length * channels * 2;
  const ab = new ArrayBuffer(44 + dataSize), view = new DataView(ab);
  const write = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < length; i++)
    for (let ch = 0; ch < channels; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true); offset += 2;
    }
  return new Blob([ab], { type: 'audio/wav' });
}

async function analyzeAudio(file) {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const duration = Math.round(buffer.duration);
    const data = buffer.getChannelData(0);
    let crossings = 0;
    for (let i = 1; i < data.length; i += 200)
      if ((data[i-1] < 0 && data[i] >= 0) || (data[i-1] > 0 && data[i] <= 0)) crossings++;
    const roughHz = (crossings / 2) / (duration || 1) * 200;
    const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const midi = Math.round(69 + 12 * Math.log2(Math.max(roughHz, 80) / 440));
    const key = `${notes[((midi % 12) + 12) % 12]} major`;
    const bpm = duration > 100 ? 80 : duration > 55 ? 96 : 120;
    return { key, bpm, duration: Math.min(duration, 180), time_signature: '4/4' };
  } finally { ctx.close(); }
}

const S = {
  page: { minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'Inter, sans-serif' },
  card: { background: 'rgba(20,20,31,.9)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 18, padding: 18 },
  btn: (bg) => ({ background: bg, border: 0, borderRadius: 13, color: '#fff', padding: '13px 16px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }),
  pill: { fontSize: 12, color: '#c4b5fd', background: 'rgba(124,58,237,.18)', border: '1px solid rgba(124,58,237,.25)', padding: '4px 9px', borderRadius: 999 },
  input: { width: '100%', background: '#181827', color: '#fff', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '12px 14px', outline: 0, boxSizing: 'border-box', fontSize: 14 },
};

function KeyModal({ hfKey, onSave, onClose }) {
  const [val, setVal] = useState(hfKey || '');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ ...S.card, width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>HuggingFace API Key</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>Get free key at <strong style={{ color: '#a78bfa' }}>huggingface.co</strong> → Settings → Access Tokens</p>
        <p style={{ fontSize: 13, color: '#fbbf24', marginBottom: 14 }}>⚠️ Enable "Make calls to the Inference API" when creating token</p>
        <input type="password" value={val} onChange={e => setVal(e.target.value)} placeholder="hf_xxxxxxxxxxxxxxxxxxxx" style={{ ...S.input, marginBottom: 12 }} onKeyDown={e => e.key === 'Enter' && val.trim() && onSave(val.trim())} autoFocus />
        <button onClick={() => val.trim() && onSave(val.trim())} style={{ ...S.btn('linear-gradient(135deg,#7c3aed,#6d28d9)') }}>Save & Continue</button>
      </div>
    </div>
  );
}

const INSTR_MAP = {
  'frame drum': ['dappu','frame drum','hand drum','drum','dholak','dhol','tabla','percussion','beat','rhythm'],
  'harmonium': ['harmonium','keyboard','keys','organ','shruti','melodic'],
  'hand clapping': ['clap','clapping','hand','hands'],
  'flute': ['flute','bansuri','wind'],
  'electric guitar': ['electric guitar','electric','lead guitar'],
  'acoustic guitar': ['acoustic guitar','acoustic','guitar'],
  'bass': ['bass guitar','bass'],
  'synthesizer': ['synth','synthesizer','electronic','edm','dj','808'],
  'strings': ['strings','violin','cello','orchestral'],
};

function parseInstruments(text) {
  const l = text.toLowerCase();
  const found = Object.entries(INSTR_MAP).filter(([,kws]) => kws.some(k => l.includes(k))).map(([i]) => i);
  return found.length ? found : ['frame drum','harmonium'];
}
function parseMood(text) {
  const l = text.toLowerCase();
  if (l.match(/sad|emotional|love fail/)) return 'sad emotional';
  if (l.match(/romantic|love|romance/)) return 'romantic love';
  if (l.match(/devotional|bonalu|goddess|temple|mahankali/)) return 'festive devotional';
  if (l.match(/party|dance|hype|energy/)) return 'high energy party';
  if (l.match(/chill|relax|calm|soft/)) return 'chill relaxed';
  if (l.match(/happy|celebration|joy/)) return 'joyful celebratory';
  return 'festive folk';
}
function parseIntensity(text) {
  const l = text.toLowerCase();
  if (l.match(/full|loud|heavy|max|band/)) return 'full';
  if (l.match(/subtle|soft|light|background|quiet/)) return 'subtle';
  return 'balanced';
}
function buildPrompt(mood, instruments, intensity, extras, isDJ, analysis) {
  const bpm = analysis?.bpm || (mood.includes('sad') ? 75 : mood.includes('chill') ? 90 : 130);
  const style = isDJ ? 'modern DJ folk electronic fusion' : 'traditional acoustic South Indian folk';
  const energy = intensity === 'full' ? 'powerful high-energy festival sound' : intensity === 'subtle' ? 'gentle subtle background' : 'balanced warm mix';
  let p = `Telangana folk music, ${mood} mood, ${style}, instruments: ${instruments.join(', ')}, ${energy}, ${bpm} BPM, professional quality, leaves space for vocals`;
  if (extras && !extras.toLowerCase().match(/^(no|nothing|ok|okay|nope|generate|that.?s all)$/)) p += `, ${extras}`;
  return p;
}

function ProducerChat({ analysis, onIntent }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isDJ, setIsDJ] = useState(false);
  const [msgs, setMsgs] = useState([{ role: 'bot', text: `🎤 Got your vocals! Hearing around ${analysis?.key} at ${analysis?.bpm} BPM.\n\nWhat vibe are you going for? Like "high energy Bonalu", "sad romantic folk", or "full teenmaar party".` }]);
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const bot = (text) => setTimeout(() => setMsgs(p => [...p, { role: 'bot', text }]), 500);

  const send = () => {
    const val = input.trim(); if (!val) return;
    setInput('');
    setMsgs(p => [...p, { role: 'user', text: val }]);
    if (step === 0) {
      const mood = parseMood(val); setAnswers(p => ({ ...p, mood })); setStep(1);
      bot(`Love that — ${mood} energy! 🎵\n\nWhat instruments?\n• "dappu, dholak and harmonium" — classic Bonalu\n• "electric guitar and bass" — modern\n• Say "default" for classic Bonalu set`);
    } else if (step === 1) {
      const dj = /dj|electronic|edm|modern/i.test(val); setIsDJ(dj);
      const instr = /default|classic|bonalu|traditional/i.test(val) ? ['frame drum','dholak','harmonium','hand clapping'] : parseInstruments(val);
      setAnswers(p => ({ ...p, instruments: instr })); setStep(2);
      bot(`Adding: ${instr.join(', ')} ${dj ? '🎧 DJ style' : '🥁 acoustic folk'}\n\nHow loud should music be?\n• "subtle" — soft background\n• "balanced" — equal mix\n• "full" — full festival energy`);
    } else if (step === 2) {
      const intensity = parseIntensity(val); setAnswers(p => ({ ...p, intensity })); setStep(3);
      bot(`${intensity === 'full' ? 'Full energy! 🔥' : intensity === 'subtle' ? 'Nice and subtle 🌙' : 'Balanced mix 🎶'}\n\nAny final requests? Like "add echo", "slow build"\nOr say "generate" to create now!`);
    } else if (step === 3) {
      setStep(4);
      const a = { ...answers };
      const prompt = buildPrompt(a.mood || 'festive folk', a.instruments || ['frame drum','harmonium'], a.intensity || 'balanced', val, isDJ, analysis);
      const intent = { mood: a.mood || 'festive folk', genre: isDJ ? 'Telangana DJ Folk' : 'Telangana Bonalu Folk', key: analysis?.key || 'C major', bpm: analysis?.bpm || 130, instruments: a.instruments || ['frame drum','harmonium'], intensity: a.intensity || 'balanced', duration: analysis?.duration || 60, music_prompt: prompt };
      bot(`All set! 🎵\n\n🎼 ${intent.mood}\n🎸 ${intent.instruments.join(', ')}\n⚡ ${intent.intensity}\n\nHit Generate Song! 🚀`);
      onIntent(intent);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '86%', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14, padding: '12px 15px', borderRadius: 16, background: m.role === 'user' ? '#7c3aed' : '#181827', border: m.role === 'bot' ? '1px solid rgba(255,255,255,.08)' : 0, borderBottomRightRadius: m.role === 'user' ? 4 : 16, borderBottomLeftRadius: m.role === 'bot' ? 4 : 16 }}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {step < 4 && (
        <div style={{ display: 'flex', gap: 8, padding: 14, borderTop: '1px solid rgba(255,255,255,.08)', flexShrink: 0 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type your answer…" autoFocus style={S.input} />
          <button onClick={send} disabled={!input.trim()} style={{ ...S.btn('#7c3aed'), width: 'auto', padding: '12px 16px', opacity: input.trim() ? 1 : 0.4 }}><Send size={16} /></button>
        </div>
      )}
    </div>
  );
}

function Field({ k, v }) {
  return <div><small style={{ color: 'rgba(255,255,255,.4)' }}>{k}</small><div style={{ color: '#fff', fontSize: 14 }}>{v || '—'}</div></div>;
}
function Slider({ label, value, setValue }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>
        <span>{label}</span><span>{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min="0" max="100" value={value * 100} onChange={e => setValue(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: '#7c3aed' }} />
    </div>
  );
}
function Toast({ text, clear }) {
  return (
    <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#dc2626', borderRadius: 12, padding: '11px 18px', zIndex: 99, display: 'flex', gap: 10, alignItems: 'center', maxWidth: '92vw' }}>
      <span style={{ fontSize: 13 }}>{text}</span>
      <button onClick={clear} style={{ background: 'transparent', border: 0, color: '#fff', cursor: 'pointer' }}><X size={14} /></button>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState('landing');
  const [hfKey, setHfKey] = useState(() => { try { return localStorage.getItem('hf_key') || ''; } catch { return ''; } });
  const [showKey, setShowKey] = useState(false);
  const [vocalFile, setVocalFile] = useState(null);
  const [vocalUrl, setVocalUrl] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [intent, setIntent] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [musicUrl, setMusicUrl] = useState(null);
  const [mixUrl, setMixUrl] = useState(null);
  const [vVol, setVVol] = useState(0.85);
  const [mVol, setMVol] = useState(0.55);
  const [remixing, setRemixing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const fileRef = useRef(null);
  const audioRef = useRef(null);

  const saveKey = (key) => { setHfKey(key); setShowKey(false); try { localStorage.setItem('hf_key', key); } catch {} };

  const handleUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) return setError('Please upload an audio file.');
    if (file.size > 50 * 1024 * 1024) return setError('Max 50 MB.');
    setError(''); setIntent(null); setMixUrl(null); setMusicUrl(null);
    setVocalFile(file); setVocalUrl(URL.createObjectURL(file)); setScreen('studio');
    try { setAnalysis(await analyzeAudio(file)); }
    catch { setAnalysis({ key: 'C major', bpm: 100, duration: 60, time_signature: '4/4' }); }
  };

  const doMix = useCallback(async (vocUrl, musUrl, vv, mv) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const [vBuf, mBuf] = await Promise.all([
        fetch(vocUrl).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)),
        fetch(musUrl).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))
      ]);
      const dur = Math.max(vBuf.duration, mBuf.duration);
      const offline = new OfflineAudioContext(2, Math.ceil(dur * 44100), 44100);
      const comp = offline.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = 0.003; comp.release.value = 0.25;
      comp.connect(offline.destination);
      [[vBuf, vv], [mBuf, mv]].forEach(([buf, gain]) => {
        const src = offline.createBufferSource(); const g = offline.createGain();
        src.buffer = buf; g.gain.value = gain; src.connect(g).connect(comp); src.start(0);
      });
      const rendered = await offline.startRendering();
      return URL.createObjectURL(audioBufferToWav(rendered));
    } finally { ctx.close(); }
  }, []);

  const generate = async () => {
    if (!intent) return;
    if (!hfKey) { setShowKey(true); return; }
    setScreen('generating'); setError(''); setStatus('Sending to music AI… 🎸');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, hfKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setMusicUrl(data.audioUrl);
      setStatus('Mixing and mastering… 🎧');
      const final = vocalUrl ? await doMix(vocalUrl, data.audioUrl, vVol, mVol) : data.audioUrl;
      setMixUrl(final); setScreen('result');
    } catch (e) { setError(e.message); setScreen('studio'); }
  };

  const remix = async () => {
    if (!vocalUrl || !musicUrl) return;
    setRemixing(true);
    try { setMixUrl(await doMix(vocalUrl, musicUrl, vVol, mVol)); }
    catch (e) { setError(e.message); }
    setRemixing(false);
  };

  const download = () => {
    if (!mixUrl) return;
    const a = document.createElement('a');
    a.href = mixUrl; a.download = `vocalai-${(intent?.mood || 'song').replace(/\W+/g, '-')}.wav`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  if (screen === 'landing') return (
    <div style={{ ...S.page, display: 'grid', placeItems: 'center', padding: 24, background: 'radial-gradient(circle at top left,rgba(124,58,237,.4),transparent 40%),radial-gradient(circle at bottom right,rgba(37,99,235,.28),transparent 35%),#0a0a0f' }}>
      {error && <Toast text={error} clear={() => setError('')} />}
      {showKey && <KeyModal hfKey={hfKey} onSave={saveKey} onClose={() => setShowKey(false)} />}
      <button onClick={() => setShowKey(true)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, color: '#fff', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        <Settings size={14} /> API Key
      </button>
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <div style={{ fontSize: 66, marginBottom: 10 }}>🎵</div>
        <h1 style={{ fontSize: 46, margin: 0, background: 'linear-gradient(90deg,#a78bfa,#fbbf24)', WebkitBackgroundClip: 'text', color: 'transparent' }}>VocalAI Studio</h1>
        <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 16, marginBottom: 4 }}>Your voice. Any instrument. One song.</p>
        <p style={{ color: '#fbbf24', fontSize: 13, opacity: 0.8, marginBottom: 28 }}>Telangana Bonalu Folk • Madeen SK Style</p>
        {!hfKey
          ? <div style={{ ...S.card, marginBottom: 20, background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)' }}>
              <p style={{ margin: 0, fontSize: 14, color: '#fbbf24' }}>⚠️ Add your HuggingFace API key to generate music</p>
              <button onClick={() => setShowKey(true)} style={{ ...S.btn('rgba(251,191,36,.2)'), marginTop: 10, color: '#fbbf24', border: '1px solid rgba(251,191,36,.3)' }}>Add API Key →</button>
            </div>
          : <p style={{ fontSize: 12, color: '#10b981', marginBottom: 12 }}>✅ API key saved</p>
        }
        <button onClick={() => setScreen('studio')} style={{ ...S.btn('linear-gradient(135deg,#7c3aed,#2563eb)'), margin: '0 auto', padding: '16px 28px', fontSize: 17, maxWidth: 260 }}>
          Start Creating <Zap size={19} />
        </button>
      </div>
    </div>
  );

  if (screen === 'generating') return (
    <div style={{ ...S.page, display: 'grid', placeItems: 'center', padding: 24 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <Loader2 size={58} style={{ animation: 'spin 1s linear infinite', color: '#a78bfa' }} />
        <h2>Creating your song</h2>
        <p style={{ color: 'rgba(255,255,255,.55)' }}>{status}</p>
        <button onClick={() => setScreen('studio')} style={{ background: 'transparent', color: 'rgba(255,255,255,.35)', border: 0, marginTop: 20, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );

  if (screen === 'result') return (
    <div style={{ ...S.page, padding: 18 }}>
      {error && <Toast text={error} clear={() => setError('')} />}
      {showKey && <KeyModal hfKey={hfKey} onSave={saveKey} onClose={() => setShowKey(false)} />}
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <button onClick={() => setScreen('studio')} style={{ background: 'transparent', color: 'rgba(255,255,255,.55)', border: 0, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}><ArrowLeft size={16} /> Back</button>
          <button onClick={() => setShowKey(true)} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Settings size={12} /> API Key</button>
        </div>
        <div style={{ textAlign: 'center', margin: '12px 0 22px' }}>
          <div style={{ fontSize: 52 }}>🎉</div>
          <h2>Your song is ready!</h2>
          <p style={{ color: 'rgba(255,255,255,.45)' }}>{intent?.genre} • {intent?.mood}</p>
        </div>
        <div style={{ ...S.card, marginBottom: 14 }}>
          {mixUrl && <>
            <audio ref={audioRef} src={mixUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
            <button style={{ ...S.btn('rgba(124,58,237,.18)'), border: '1px solid rgba(124,58,237,.28)', marginBottom: 16 }} onClick={() => playing ? audioRef.current.pause() : audioRef.current.play()}>
              {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? 'Pause' : 'Play final mix'}
            </button>
          </>}
          <Slider label="🎤 Vocal volume" value={vVol} setValue={setVVol} />
          <Slider label="🎸 Music volume" value={mVol} setValue={setMVol} />
          <button onClick={remix} disabled={remixing} style={{ ...S.btn('rgba(255,255,255,.06)'), marginTop: 12, opacity: remixing ? 0.5 : 1 }}>
            <Sliders size={16} /> {remixing ? 'Remixing…' : 'Apply new balance'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <button onClick={download} style={S.btn('#10b981')}><Download size={17} /> Download WAV</button>
          <button onClick={generate} style={S.btn('rgba(124,58,237,.3)')}><RefreshCw size={17} /> Regenerate</button>
        </div>
        <button onClick={() => { setVocalFile(null); setVocalUrl(null); setIntent(null); setMixUrl(null); setMusicUrl(null); setAnalysis(null); setScreen('studio'); }}
          style={{ ...S.btn('rgba(255,255,255,.04)'), border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)' }}>
          Start New Song
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ ...S.page, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {error && <Toast text={error} clear={() => setError('')} />}
      {showKey && <KeyModal hfKey={hfKey} onSave={saveKey} onClose={() => setShowKey(false)} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={() => setScreen('landing')} style={{ background: 'transparent', color: '#fff', border: 0, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
          <ArrowLeft size={17} /> VocalAI Studio
        </button>
        <button onClick={() => setShowKey(true)} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: hfKey ? '#10b981' : '#fbbf24', padding: '7px 13px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Settings size={13} /> {hfKey ? '✅ Key saved' : '⚠️ Add API Key'}
        </button>
      </header>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <main style={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!vocalFile && (
            <div style={{ padding: 18 }}>
              <div onClick={() => fileRef.current?.click()} onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files[0]); }} onDragOver={e => e.preventDefault()} style={{ ...S.card, textAlign: 'center', cursor: 'pointer', borderStyle: 'dashed', padding: 36 }}>
                <Upload size={34} style={{ color: '#a78bfa', marginBottom: 10 }} />
                <h3 style={{ margin: '0 0 6px' }}>Upload your vocals</h3>
                <p style={{ color: 'rgba(255,255,255,.45)', margin: 0 }}>MP3, WAV, M4A, or OGG up to 50 MB</p>
              </div>
              <input ref={fileRef} type="file" accept="audio/*" onChange={e => handleUpload(e.target.files?.[0])} style={{ display: 'none' }} />
            </div>
          )}
          {vocalFile && (
            <div style={{ padding: '12px 16px', flexShrink: 0 }}>
              <div style={{ ...S.card, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 13 }}>{vocalFile.name}</strong>
                  <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 12 }}>{analysis ? `${analysis.key} • ${analysis.bpm} BPM • ${analysis.duration}s` : 'Analyzing…'}</div>
                </div>
                <button onClick={() => { setVocalFile(null); setVocalUrl(null); setIntent(null); setAnalysis(null); }} style={{ background: 'transparent', color: 'rgba(255,255,255,.5)', border: 0, cursor: 'pointer' }}><X size={17} /></button>
              </div>
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {vocalFile && analysis
              ? <ProducerChat analysis={analysis} onIntent={setIntent} />
              : <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.28)', textAlign: 'center', padding: 24 }}>Upload vocals to start the AI producer chat 🎤</div>}
          </div>
        </main>
        <aside style={{ borderLeft: '1px solid rgba(255,255,255,.08)', padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={S.card}>
            <h3 style={{ marginTop: 0, fontSize: 14 }}>Song Plan</h3>
            {intent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field k="Mood" v={intent.mood} />
                <Field k="Genre" v={intent.genre} />
                <Field k="Key / BPM" v={`${intent.key} • ${intent.bpm} BPM`} />
                <div>
                  <small style={{ color: 'rgba(255,255,255,.4)' }}>Instruments</small>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                    {intent.instruments?.map(i => <span key={i} style={S.pill}>{i}</span>)}
                  </div>
                </div>
                <Field k="Intensity" v={intent.intensity} />
              </div>
            ) : <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Answer the chat to fill this in.</p>}
          </div>
          {intent && <>
            <button onClick={generate} style={{ ...S.btn('linear-gradient(135deg,#7c3aed,#b45309)'), padding: 16, fontSize: 16 }}>
              <Zap size={18} /> Generate Song 🚀
            </button>
            <div style={S.card}>
              <small style={{ color: 'rgba(255,255,255,.4)' }}>AI Prompt</small>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, margin: '6px 0 0' }}>{intent.music_prompt}</p>
            </div>
          </>}
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textAlign: 'center', marginTop: 'auto' }}>Powered by HuggingFace MusicGen</p>
        </aside>
      </div>
    </div>
  );
}
