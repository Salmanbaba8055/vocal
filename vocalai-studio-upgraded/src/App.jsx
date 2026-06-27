import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2, Pause, Play, RefreshCw, Send, Sliders, Upload, X, Zap } from 'lucide-react';

function audioBufferToWav(buffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const dataSize = length * channels * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const write = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function analyzeAudio(file) {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const duration = Math.round(buffer.duration);
    const data = buffer.getChannelData(0);
    let crossings = 0;
    for (let i = 1; i < data.length; i += 200) if ((data[i - 1] < 0 && data[i] >= 0) || (data[i - 1] > 0 && data[i] <= 0)) crossings++;
    const roughHz = (crossings / 2) / (duration || 1) * 200;
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const midi = Math.round(69 + 12 * Math.log2(Math.max(roughHz, 80) / 440));
    const key = `${notes[((midi % 12) + 12) % 12]} major`;
    const bpm = duration > 100 ? 80 : duration > 55 ? 96 : 120;
    return { key, bpm, duration: Math.min(duration, 180), time_signature: '4/4' };
  } finally {
    ctx.close();
  }
}

const page = { minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'Inter, sans-serif' };
const card = { background: 'rgba(20,20,31,.86)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 18, padding: 18, backdropFilter: 'blur(12px)' };
const button = (bg) => ({ background: bg, border: 0, borderRadius: 13, color: '#fff', padding: '13px 16px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 });
const pill = { fontSize: 12, color: '#c4b5fd', background: 'rgba(124,58,237,.18)', border: '1px solid rgba(124,58,237,.25)', padding: '4px 9px', borderRadius: 999 };

function ProducerChat({ analysis, onIntent }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: `🎤 Upload received. I’m hearing about ${analysis.key} around ${analysis.bpm} BPM. What mood are you going for?` }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next); setInput(''); setBusy(true);
    try {
      const res = await fetch('/api/producer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next, analysis }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Producer failed');
      setMessages([...next, { role: 'assistant', content: data.message }]);
      if (data.intent) onIntent(data.intent);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `I hit a producer error: ${e.message}` }]);
    } finally { setBusy(false); }
  };

  return <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {messages.map((m, i) => <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
        <div style={{ maxWidth: '86%', whiteSpace: 'pre-wrap', lineHeight: 1.55, fontSize: 14, padding: '12px 15px', borderRadius: 16, background: m.role === 'user' ? '#7c3aed' : '#181827', border: m.role === 'assistant' ? '1px solid rgba(255,255,255,.08)' : 0 }}>{m.content}</div>
      </div>)}
      {busy && <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 13 }}>Producer is thinking…</div>}
      <div ref={endRef} />
    </div>
    <div style={{ display: 'flex', gap: 8, padding: 14, borderTop: '1px solid rgba(255,255,255,.08)' }}>
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type your answer…" style={{ flex: 1, background: '#181827', color: '#fff', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '12px 14px', outline: 0 }} />
      <button onClick={send} disabled={busy || !input.trim()} style={{ ...button('#7c3aed'), opacity: busy || !input.trim() ? .45 : 1 }}><Send size={16} /></button>
    </div>
  </div>;
}

export default function App() {
  const [screen, setScreen] = useState('landing');
  const [vocalFile, setVocalFile] = useState(null);
  const [vocalUrl, setVocalUrl] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [intent, setIntent] = useState(null);
  const [engine, setEngine] = useState('chord');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [musicUrl, setMusicUrl] = useState(null);
  const [mixUrl, setMixUrl] = useState(null);
  const [vVol, setVVol] = useState(.85);
  const [mVol, setMVol] = useState(.55);
  const [remixing, setRemixing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const fileRef = useRef(null);
  const audioRef = useRef(null);

  const handleUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) return setError('Please upload an audio file.');
    if (file.size > 50 * 1024 * 1024) return setError('Max upload size is 50 MB.');
    setError(''); setIntent(null); setMixUrl(null); setMusicUrl(null);
    const url = URL.createObjectURL(file);
    setVocalFile(file); setVocalUrl(url); setScreen('studio');
    try { setAnalysis(await analyzeAudio(file)); } catch { setAnalysis({ key: 'C major', bpm: 100, duration: 60, time_signature: '4/4' }); }
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
      comp.threshold.value = -18; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = .003; comp.release.value = .25;
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
    setScreen('generating'); setError(''); setStatus('Preparing vocal conditioning…');
    try {
      const vocalDataUrl = vocalFile ? await fileToDataUrl(vocalFile) : null;
      setStatus(engine === 'chord' ? 'Generating chord-matched backing track…' : 'Generating melody-conditioned backing track…');
      const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent, vocalDataUrl, engine }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setMusicUrl(data.audioUrl); setStatus('Mixing and lightly mastering…');
      const final = vocalUrl ? await doMix(vocalUrl, data.audioUrl, vVol, mVol) : data.audioUrl;
      setMixUrl(final); setScreen('result');
    } catch (e) { setError(e.message); setScreen('studio'); }
  };

  const remix = async () => {
    if (!vocalUrl || !musicUrl) return;
    setRemixing(true);
    try { setMixUrl(await doMix(vocalUrl, musicUrl, vVol, mVol)); } catch (e) { setError(e.message); }
    setRemixing(false);
  };

  const download = () => {
    if (!mixUrl) return;
    const a = document.createElement('a');
    a.href = mixUrl; a.download = `vocalai-${(intent?.mood || 'song').replace(/\W+/g, '-')}.wav`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  if (screen === 'landing') return <div style={{ ...page, display: 'grid', placeItems: 'center', padding: 24, background: 'radial-gradient(circle at top left, rgba(124,58,237,.4), transparent 40%), radial-gradient(circle at bottom right, rgba(37,99,235,.28), transparent 35%), #0a0a0f' }}>
    {error && <Toast text={error} clear={() => setError('')} />}
    <div style={{ textAlign: 'center', maxWidth: 560 }}>
      <div style={{ fontSize: 66, marginBottom: 10 }}>🎵</div>
      <h1 style={{ fontSize: 46, margin: 0, background: 'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', color: 'transparent' }}>VocalAI Studio</h1>
      <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 18 }}>Your voice. Any instrument. One song.</p>
      <button onClick={() => setScreen('studio')} style={{ ...button('linear-gradient(135deg,#7c3aed,#2563eb)'), margin: '28px auto 0', padding: '16px 28px', fontSize: 17 }}>Start Creating <Zap size={19} /></button>
    </div>
  </div>;

  if (screen === 'generating') return <div style={{ ...page, display: 'grid', placeItems: 'center', padding: 24 }}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <div style={{ textAlign: 'center', maxWidth: 360 }}><Loader2 size={58} style={{ animation: 'spin 1s linear infinite', color: '#a78bfa' }} /><h2>Creating your song</h2><p style={{ color: 'rgba(255,255,255,.55)' }}>{status}</p><button onClick={() => setScreen('studio')} style={{ background: 'transparent', color: 'rgba(255,255,255,.35)', border: 0, marginTop: 20, cursor: 'pointer' }}>Cancel</button></div>
  </div>;

  if (screen === 'result') return <div style={{ ...page, padding: 18 }}>
    {error && <Toast text={error} clear={() => setError('')} />}
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <button onClick={() => setScreen('studio')} style={{ background: 'transparent', color: 'rgba(255,255,255,.55)', border: 0, marginBottom: 14, cursor: 'pointer' }}><ArrowLeft size={16} /> Back</button>
      <div style={{ textAlign: 'center', margin: '12px 0 22px' }}><div style={{ fontSize: 52 }}>🎉</div><h2>Your song is ready</h2><p style={{ color: 'rgba(255,255,255,.45)' }}>{intent?.genre} • {intent?.mood}</p></div>
      <div style={{ ...card, marginBottom: 14 }}>
        {mixUrl && <><audio ref={audioRef} src={mixUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} /><button style={{ ...button('rgba(124,58,237,.18)'), width: '100%', border: '1px solid rgba(124,58,237,.28)' }} onClick={() => playing ? audioRef.current.pause() : audioRef.current.play()}>{playing ? <Pause size={18} /> : <Play size={18} />} {playing ? 'Pause' : 'Play final mix'}</button></>}
        <Slider label="🎤 Vocal volume" value={vVol} setValue={setVVol} />
        <Slider label="🎸 Music volume" value={mVol} setValue={setMVol} />
        <button onClick={remix} disabled={remixing} style={{ ...button('rgba(255,255,255,.06)'), width: '100%', marginTop: 10, opacity: remixing ? .5 : 1 }}><Sliders size={16} /> {remixing ? 'Remixing…' : 'Apply new balance'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><button onClick={download} style={button('#10b981')}><Download size={17} /> Download WAV</button><button onClick={generate} style={button('rgba(124,58,237,.22)')}><RefreshCw size={17} /> Regenerate</button></div>
    </div>
  </div>;

  return <div style={{ ...page, height: '100vh', display: 'flex', flexDirection: 'column' }}>
    {error && <Toast text={error} clear={() => setError('')} />}
    <header style={{ padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><button onClick={() => setScreen('landing')} style={{ background: 'transparent', color: '#fff', border: 0, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}><ArrowLeft size={17} /> VocalAI Studio</button><span style={{ color: 'rgba(255,255,255,.35)', fontSize: 12 }}>Replicate + Claude-ready</span></header>
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 310px' }}>
      <main style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {!vocalFile && <div style={{ padding: 18 }}><div onClick={() => fileRef.current?.click()} onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files[0]); }} onDragOver={e => e.preventDefault()} style={{ ...card, textAlign: 'center', cursor: 'pointer', borderStyle: 'dashed' }}><Upload size={34} style={{ color: '#a78bfa' }} /><h3>Upload your vocal</h3><p style={{ color: 'rgba(255,255,255,.45)' }}>MP3, WAV, M4A, or OGG up to 50 MB</p></div><input ref={fileRef} type="file" accept="audio/*" onChange={e => handleUpload(e.target.files?.[0])} style={{ display: 'none' }} /></div>}
        {vocalFile && <div style={{ padding: 14 }}><div style={{ ...card, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><div><strong>{vocalFile.name}</strong><div style={{ color: 'rgba(255,255,255,.4)', fontSize: 12 }}>{analysis ? `${analysis.key} • ${analysis.bpm} BPM • ${analysis.duration}s` : 'Analyzing…'}</div></div><button onClick={() => { setVocalFile(null); setVocalUrl(null); setIntent(null); setAnalysis(null); }} style={{ background: 'transparent', color: 'rgba(255,255,255,.5)', border: 0, cursor: 'pointer' }}><X size={17} /></button></div></div>}
        <div style={{ flex: 1, minHeight: 0 }}>{vocalFile && analysis ? <ProducerChat analysis={analysis} onIntent={setIntent} /> : <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.28)' }}>Upload vocals to start the AI producer chat 🎤</div>}</div>
      </main>
      <aside style={{ borderLeft: '1px solid rgba(255,255,255,.08)', padding: 14, overflowY: 'auto' }}>
        <div style={card}><h3 style={{ marginTop: 0 }}>Live Plan</h3>{intent ? <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}><Field k="Mood" v={intent.mood} /><Field k="Genre" v={intent.genre} /><Field k="Key / BPM" v={`${intent.key} • ${intent.bpm} BPM`} /><div><small style={{ color: 'rgba(255,255,255,.4)' }}>Instruments</small><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>{intent.instruments?.map(i => <span key={i} style={pill}>{i}</span>)}</div></div><Field k="Intensity" v={intent.intensity} /></div> : <p style={{ color: 'rgba(255,255,255,.35)' }}>The producer will fill this in.</p>}</div>
        <div style={{ ...card, marginTop: 12 }}><small style={{ color: 'rgba(255,255,255,.4)' }}>Engine</small><select value={engine} onChange={e => setEngine(e.target.value)} style={{ width: '100%', marginTop: 8, background: '#181827', color: '#fff', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: 10 }}><option value="chord">MusicGen-Chord default</option><option value="melody">MusicGen melody fallback</option></select></div>
        {intent && <><button onClick={generate} style={{ ...button('linear-gradient(135deg,#7c3aed,#2563eb)'), width: '100%', marginTop: 12, padding: 16 }}><Zap size={18} /> Generate Song</button><div style={{ ...card, marginTop: 12 }}><small style={{ color: 'rgba(255,255,255,.4)' }}>Generated prompt</small><p style={{ fontSize: 12, color: 'rgba(255,255,255,.58)', lineHeight: 1.55 }}>{intent.music_prompt}</p></div></>}
      </aside>
    </div>
  </div>;
}

function Field({ k, v }) { return <div><small style={{ color: 'rgba(255,255,255,.4)' }}>{k}</small><div style={{ color: '#fff', fontSize: 14 }}>{v || '—'}</div></div>; }
function Slider({ label, value, setValue }) { return <div style={{ marginTop: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,.6)' }}><span>{label}</span><span>{Math.round(value * 100)}%</span></div><input type="range" min="0" max="100" value={value * 100} onChange={e => setValue(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: '#7c3aed' }} /></div>; }
function Toast({ text, clear }) { return <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#dc2626', borderRadius: 12, padding: '11px 15px', zIndex: 9, display: 'flex', gap: 10, alignItems: 'center', maxWidth: '90vw' }}><span style={{ fontSize: 13 }}>{text}</span><button onClick={clear} style={{ background: 'transparent', border: 0, color: '#fff', cursor: 'pointer' }}><X size={14} /></button></div>; }
