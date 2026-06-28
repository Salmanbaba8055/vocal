import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2, RefreshCw, Send, Settings, Upload, X, Zap } from 'lucide-react';

const S = {
  page: { minHeight:'100vh', background:'#0a0a0f', color:'#fff', fontFamily:'Inter,sans-serif' },
  card: { background:'rgba(20,20,31,.92)', border:'1px solid rgba(255,255,255,.09)', borderRadius:18, padding:18 },
  btn: bg => ({ background:bg, border:0, borderRadius:13, color:'#fff', padding:'13px 16px', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', fontSize:14 }),
  pill: { fontSize:12, color:'#c4b5fd', background:'rgba(124,58,237,.18)', border:'1px solid rgba(124,58,237,.25)', padding:'4px 9px', borderRadius:999 },
  inp: { width:'100%', background:'#181827', color:'#fff', border:'1px solid rgba(255,255,255,.12)', borderRadius:12, padding:'12px 14px', outline:0, boxSizing:'border-box', fontSize:14 },
};

function KeyModal({ apiKey, onSave, onClose }) {
  const [val, setVal] = useState(apiKey || '');
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ ...S.card, width:'100%', maxWidth:420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ margin:0 }}>🔑 Replicate API Token</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <p style={{ fontSize:13, color:'rgba(255,255,255,.5)', marginBottom:6 }}>Get token at <strong style={{ color:'#a78bfa' }}>replicate.com</strong> → Account → API Tokens</p>
        <p style={{ fontSize:13, color:'#fbbf24', marginBottom:14 }}>💳 ~$0.01 per song at replicate.com → Billing</p>
        <input type="password" value={val} onChange={e => setVal(e.target.value)} placeholder="r8_xxxxxxxxxxxxxxxxxxxx" style={{ ...S.inp, marginBottom:12 }} onKeyDown={e => e.key==='Enter' && val.trim() && onSave(val.trim())} autoFocus />
        <button onClick={() => val.trim() && onSave(val.trim())} style={{ ...S.btn('linear-gradient(135deg,#7c3aed,#6d28d9)') }}>Save & Continue</button>
      </div>
    </div>
  );
}

const INSTR = {
  'frame drum': ['dappu','frame drum','hand drum','drum','dholak','dhol','tabla','percussion','beat','rhythm'],
  'harmonium': ['harmonium','keyboard','keys','organ','shruti'],
  'hand clapping': ['clap','clapping','hands'],
  'flute': ['flute','bansuri','wind'],
  'electric guitar': ['electric guitar','electric','lead guitar'],
  'acoustic guitar': ['acoustic guitar','acoustic','guitar'],
  'bass': ['bass guitar','bass'],
  'synthesizer': ['synth','synthesizer','electronic','edm','dj','808'],
  'strings': ['strings','violin','cello','orchestral'],
};
const parseInstr = t => { const l=t.toLowerCase(); const f=Object.entries(INSTR).filter(([,ks])=>ks.some(k=>l.includes(k))).map(([i])=>i); return f.length?f:['frame drum','dholak','harmonium','hand clapping','strings']; };
const parseMood = t => { const l=t.toLowerCase(); if(l.match(/sad|emotional|love fail/))return'sad emotional'; if(l.match(/romantic|love|romance/))return'romantic love'; if(l.match(/devotional|bonalu|goddess|temple|mahankali/))return'festive devotional'; if(l.match(/party|dance|hype|energy/))return'high energy party'; if(l.match(/chill|relax|calm|soft/))return'chill relaxed'; if(l.match(/happy|celebration|joy/))return'joyful celebratory'; return'festive folk'; };
const parseIntensity = t => { const l=t.toLowerCase(); if(l.match(/full|loud|heavy|max|band/))return'full'; if(l.match(/subtle|soft|light|background|quiet/))return'subtle'; return'balanced'; };

async function getAudioDuration(file) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.onloadedmetadata = () => resolve(Math.round(audio.duration));
    audio.onerror = () => resolve(60);
  });
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ProducerChat({ vocalName, duration, onIntent }) {
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState({});
  const [isDJ, setIsDJ] = useState(false);
  const [msgs, setMsgs] = useState([{ r:'bot', t:`🎤 Got your vocals "${vocalName}" — ${duration} seconds!\n\nI'll generate full orchestral BGM and mix it with your vocals.\n\nWhat vibe are you going for?\n• "high energy Bonalu celebration"\n• "sad romantic folk"\n• "devotional Mahankali song"\n• "full teenmaar party"` }]);
  const [inp, setInp] = useState('');
  const endRef = useRef(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior:'smooth' }); },[msgs]);
  const bot = t => setTimeout(()=>setMsgs(p=>[...p,{r:'bot',t}]),500);
  const send = () => {
    const val=inp.trim(); if(!val)return;
    setInp(''); setMsgs(p=>[...p,{r:'user',t:val}]);
    if(step===0){
      const mood=parseMood(val); setAns(p=>({...p,mood})); setStep(1);
      bot(`${mood} — perfect! 🎵\n\nWhat instruments?\n• "default" — classic Bonalu (dappu, dholak, harmonium)\n• "orchestra" — AR Rahman style (strings, flute, brass)\n• "full band" — everything together\n• Or describe freely`);
    } else if(step===1){
      const dj=/dj|electronic|edm|modern/i.test(val); setIsDJ(dj);
      const instr=/default|classic|bonalu/i.test(val)?['frame drum','dholak','harmonium','hand clapping']:/orchestra|rahman|cinematic/i.test(val)?['strings','flute','piano','harmonium','frame drum','brass']:/full.?band|everything/i.test(val)?['frame drum','dholak','harmonium','strings','flute','piano','hand clapping','bass']:parseInstr(val);
      setAns(p=>({...p,instr})); setStep(2);
      bot(`Perfect! Adding: ${instr.join(', ')} 🎵\n\nHow intense?\n• "subtle" — soft background music\n• "balanced" — good mix\n• "full" — AR Rahman full power`);
    } else if(step===2){
      const intensity=parseIntensity(val); setAns(p=>({...p,intensity})); setStep(3);
      bot(`${intensity==='full'?'Full AR Rahman power! 🔥':intensity==='subtle'?'Soft and beautiful 🌙':'Perfect balanced mix 🎶'}\n\nAny special direction?\n• "dramatic strings build up"\n• "flute intro"\n• "heavy bass"\n\nOr say "generate" now!`);
    } else if(step===3){
      setStep(4);
      const a={...ans};
      const instr=a.instr||['frame drum','dholak','harmonium','hand clapping','strings'];
      const mood=a.mood||'festive devotional';
      const intensity=a.intensity||'full';
      const intent={ mood, genre:isDJ?'Telangana DJ Folk':'Telangana Bonalu Folk Orchestral', key:'C minor', bpm:134, instruments:instr, intensity, duration, extras:val };
      bot(`All set! 🎵\n\n🎼 ${mood}\n🎸 ${instr.join(', ')}\n⚡ ${intensity}\n⏱ ${duration} seconds full song\n\nGenerating mixed song now! 🚀`);
      onIntent(intent);
    }
  };
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:10 }}>
        {msgs.map((m,i)=>(
          <div key={i} style={{ display:'flex', justifyContent:m.r==='user'?'flex-end':'flex-start' }}>
            <div style={{ maxWidth:'86%', whiteSpace:'pre-wrap', lineHeight:1.6, fontSize:14, padding:'12px 15px', borderRadius:16, background:m.r==='user'?'#7c3aed':'#181827', border:m.r==='bot'?'1px solid rgba(255,255,255,.08)':0, borderBottomRightRadius:m.r==='user'?4:16, borderBottomLeftRadius:m.r==='bot'?4:16 }}>{m.t}</div>
          </div>
        ))}
        <div ref={endRef}/>
      </div>
      {step<4&&(
        <div style={{ display:'flex', gap:8, padding:14, borderTop:'1px solid rgba(255,255,255,.08)', flexShrink:0 }}>
          <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Type your answer…" autoFocus style={S.inp}/>
          <button onClick={send} disabled={!inp.trim()} style={{ ...S.btn('#7c3aed'), width:'auto', padding:'12px 16px', opacity:inp.trim()?1:0.4 }}><Send size={16}/></button>
        </div>
      )}
    </div>
  );
}

const Field = ({k,v}) => (<div><small style={{color:'rgba(255,255,255,.4)'}}>{k}</small><div style={{color:'#fff',fontSize:14}}>{v||'—'}</div></div>);
const Toast = ({text,clear}) => (<div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',background:'#dc2626',borderRadius:12,padding:'11px 18px',zIndex:999,display:'flex',gap:10,alignItems:'center',maxWidth:'92vw',boxShadow:'0 4px 24px rgba(0,0,0,.6)'}}><span style={{fontSize:13}}>{text}</span><button onClick={clear} style={{background:'transparent',border:0,color:'#fff',cursor:'pointer'}}><X size={14}/></button></div>);

export default function App() {
  const [screen, setScreen] = useState('landing');
  const [apiKey, setApiKey] = useState(()=>{ try{return localStorage.getItem('replicate_key')||''}catch{return''} });
  const [showKey, setShowKey] = useState(false);
  const [vocalFile, setVocalFile] = useState(null);
  const [vocalUrl, setVocalUrl] = useState(null);
  const [vocalDuration, setVocalDuration] = useState(60);
  const [intent, setIntent] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState(null);
  const [isMixed, setIsMixed] = useState(false);
  const fileRef = useRef(null);
  const audioRef = useRef(null);

  const saveKey = key => { setApiKey(key); setShowKey(false); try{localStorage.setItem('replicate_key',key)}catch{} };

  const handleUpload = async file => {
    if(!file)return;
    if(!file.type.startsWith('audio/'))return setError('Please upload an audio file.');
    if(file.size>50*1024*1024)return setError('Max 50 MB.');
    setError(''); setIntent(null); setResultUrl(null);
    setVocalFile(file); setVocalUrl(URL.createObjectURL(file));
    const dur = await getAudioDuration(file);
    setVocalDuration(dur);
    setScreen('studio');
  };

  const generate = async () => {
    if(!intent)return;
    if(!apiKey){setShowKey(true);return;}
    setScreen('generating'); setError('');
    setStatus('Sending vocals to AI… 🎤');
    try {
      let vocalBase64 = null;
      if(vocalFile) {
        vocalBase64 = await fileToBase64(vocalFile);
        setStatus('Generating orchestral BGM matching your vocals… 🎸');
      }
      const res = await fetch('/api/generate', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ intent, apiKey, vocalBase64, duration: Math.min(vocalDuration, 180) })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||`Server error ${res.status}`);
      if(!data.audioUrl) throw new Error('No audio returned');
      setResultUrl(data.audioUrl);
      setIsMixed(data.mixed || false);
      setScreen('result');
    } catch(e) { setError(e.message); setScreen('studio'); }
  };

  const download = () => {
    if(!resultUrl)return;
    const a=document.createElement('a');
    a.href=resultUrl;
    a.download=`vocalai-${intent?.mood||'song'}-${isMixed?'mixed':'bgm'}.${isMixed?'mp3':'wav'}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  if(screen==='landing') return (
    <div style={{...S.page,display:'grid',placeItems:'center',padding:24,position:'relative',background:'radial-gradient(circle at top left,rgba(124,58,237,.4),transparent 40%),radial-gradient(circle at bottom right,rgba(37,99,235,.28),transparent 35%),#0a0a0f'}}>
      {error&&<Toast text={error} clear={()=>setError('')}/>}
      {showKey&&<KeyModal apiKey={apiKey} onSave={saveKey} onClose={()=>setShowKey(false)}/>}
      <button onClick={()=>setShowKey(true)} style={{position:'absolute',top:16,right:16,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',borderRadius:10,color:'#fff',padding:'8px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:13}}><Settings size={14}/> API Token</button>
      <div style={{textAlign:'center',maxWidth:560}}>
        <div style={{fontSize:66,marginBottom:10}}>🎵</div>
        <h1 style={{fontSize:42,margin:0,background:'linear-gradient(90deg,#a78bfa,#fbbf24)',WebkitBackgroundClip:'text',color:'transparent'}}>VocalAI Studio</h1>
        <p style={{color:'rgba(255,255,255,.65)',fontSize:16,marginBottom:4}}>Your voice. Full orchestral song. AR Rahman quality.</p>
        <p style={{color:'#fbbf24',fontSize:13,opacity:.85,marginBottom:24}}>Telangana Bonalu Folk • Madeen SK Style</p>
        {!apiKey
          ?<div style={{...S.card,marginBottom:20,background:'rgba(251,191,36,.07)',border:'1px solid rgba(251,191,36,.25)'}}>
            <p style={{margin:0,fontSize:14,color:'#fbbf24'}}>⚠️ Add your Replicate API token to generate music</p>
            <button onClick={()=>setShowKey(true)} style={{...S.btn('rgba(251,191,36,.2)'),marginTop:10,color:'#fbbf24',border:'1px solid rgba(251,191,36,.3)'}}>Add API Token →</button>
          </div>
          :<p style={{fontSize:13,color:'#10b981',marginBottom:16}}>✅ API token saved — ready to generate!</p>
        }
        <button onClick={()=>setScreen('studio')} style={{...S.btn('linear-gradient(135deg,#7c3aed,#2563eb)'),margin:'0 auto',padding:'15px 28px',fontSize:16,maxWidth:260}}>Start Creating <Zap size={18}/></button>
      </div>
    </div>
  );

  if(screen==='generating') return (
    <div style={{...S.page,display:'grid',placeItems:'center',padding:24}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{textAlign:'center',maxWidth:420}}>
        <Loader2 size={56} style={{animation:'spin 1s linear infinite',color:'#a78bfa',marginBottom:20}}/>
        <h2 style={{marginBottom:8}}>Creating your full song</h2>
        <p style={{color:'rgba(255,255,255,.55)',marginBottom:6}}>{status}</p>
        <p style={{color:'rgba(255,255,255,.3)',fontSize:13,marginBottom:4}}>Generating {vocalDuration} seconds of orchestral BGM…</p>
        <p style={{color:'rgba(255,255,255,.2)',fontSize:12}}>Longer songs take 2-5 minutes. Please don't close this tab.</p>
        <button onClick={()=>setScreen('studio')} style={{background:'transparent',color:'rgba(255,255,255,.3)',border:0,marginTop:24,cursor:'pointer',fontSize:13}}>Cancel</button>
      </div>
    </div>
  );

  if(screen==='result') return (
    <div style={{...S.page,padding:18}}>
      {error&&<Toast text={error} clear={()=>setError('')}/>}
      {showKey&&<KeyModal apiKey={apiKey} onSave={saveKey} onClose={()=>setShowKey(false)}/>}
      <div style={{maxWidth:600,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <button onClick={()=>setScreen('studio')} style={{background:'transparent',color:'rgba(255,255,255,.55)',border:0,cursor:'pointer',display:'flex',gap:6,alignItems:'center'}}><ArrowLeft size={16}/> Back</button>
          <button onClick={()=>setShowKey(true)} style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,color:'#fff',padding:'6px 12px',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',gap:5}}><Settings size={12}/> API Token</button>
        </div>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:52}}>🎉</div>
          <h2 style={{margin:'8px 0 4px'}}>{isMixed ? 'Full Mixed Song Ready!' : 'BGM Generated!'}</h2>
          <p style={{color:'rgba(255,255,255,.45)',margin:0}}>{intent?.genre} • {intent?.mood} • {vocalDuration}s</p>
          {isMixed && <p style={{color:'#10b981',fontSize:13,marginTop:6}}>✅ Vocals + BGM mixed together</p>}
        </div>

        <div style={{...S.card,marginBottom:16}}>
          <p style={{margin:'0 0 12px',fontSize:13,color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:'.05em'}}>
            {isMixed ? '🎵 Full Mixed Song' : '🎸 Generated BGM'}
          </p>
          <audio ref={audioRef} src={resultUrl} style={{width:'100%',marginBottom:14}} controls/>
          <button onClick={download} style={{...S.btn('#059669')}}>
            <Download size={17}/> Download {isMixed?'Full Song (MP3)':'BGM (WAV)'}
          </button>
        </div>

        {intent&&(
          <div style={{...S.card,marginBottom:16}}>
            <p style={{margin:'0 0 10px',fontSize:13,color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:'.05em'}}>Song Details</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {intent.instruments?.map(i=><span key={i} style={S.pill}>{i}</span>)}
              <span style={{...S.pill,color:'#fbbf24',background:'rgba(251,191,36,.15)',borderColor:'rgba(251,191,36,.3)'}}>{intent.mood}</span>
              <span style={{...S.pill,color:'#34d399',background:'rgba(52,211,153,.12)',borderColor:'rgba(52,211,153,.25)'}}>{intent.intensity}</span>
              <span style={{...S.pill,color:'#60a5fa',background:'rgba(96,165,250,.12)',borderColor:'rgba(96,165,250,.25)'}}>C minor • 134 BPM</span>
              <span style={{...S.pill,color:'#f472b6',background:'rgba(244,114,182,.12)',borderColor:'rgba(244,114,182,.25)'}}>{vocalDuration}s</span>
            </div>
          </div>
        )}

        <button onClick={generate} style={{...S.btn('linear-gradient(135deg,#7c3aed,#b45309)'),marginBottom:10,padding:15,fontSize:15}}>
          <RefreshCw size={17}/> Regenerate
        </button>
        <button onClick={()=>{setVocalFile(null);setVocalUrl(null);setIntent(null);setResultUrl(null);setScreen('studio');}} style={{...S.btn('rgba(255,255,255,.04)'),border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.5)'}}>
          Start New Song
        </button>
      </div>
    </div>
  );

  return (
    <div style={{...S.page,height:'100vh',display:'flex',flexDirection:'column'}}>
      {error&&<Toast text={error} clear={()=>setError('')}/>}
      {showKey&&<KeyModal apiKey={apiKey} onSave={saveKey} onClose={()=>setShowKey(false)}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <header style={{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <button onClick={()=>setScreen('landing')} style={{background:'transparent',color:'#fff',border:0,cursor:'pointer',display:'flex',gap:8,alignItems:'center',fontWeight:600,fontSize:15}}><ArrowLeft size={17}/> VocalAI Studio</button>
        <button onClick={()=>setShowKey(true)} style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,color:apiKey?'#10b981':'#fbbf24',padding:'7px 13px',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',gap:5}}><Settings size={13}/> {apiKey?'✅ Token saved':'⚠️ Add API Token'}</button>
      </header>
      <div style={{flex:1,minHeight:0,display:'grid',gridTemplateColumns:'minmax(0,1fr) 300px'}}>
        <main style={{minHeight:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {!vocalFile&&(
            <div style={{padding:18}}>
              <div onClick={()=>fileRef.current?.click()} onDrop={e=>{e.preventDefault();handleUpload(e.dataTransfer.files[0]);}} onDragOver={e=>e.preventDefault()} style={{...S.card,textAlign:'center',cursor:'pointer',borderStyle:'dashed',padding:40}}>
                <Upload size={36} style={{color:'#a78bfa',marginBottom:12}}/>
                <h3 style={{margin:'0 0 6px'}}>Upload your vocals</h3>
                <p style={{color:'rgba(255,255,255,.4)',margin:0,fontSize:14}}>MP3, WAV, M4A, OGG — full song length</p>
                <p style={{color:'rgba(255,255,255,.25)',margin:'8px 0 0',fontSize:12}}>AI generates matching BGM + mixes it with your vocals</p>
              </div>
              <input ref={fileRef} type="file" accept="audio/*" onChange={e=>handleUpload(e.target.files?.[0])} style={{display:'none'}}/>
            </div>
          )}
          {vocalFile&&(
            <div style={{padding:'12px 16px',flexShrink:0}}>
              <div style={{...S.card,padding:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <strong style={{fontSize:13}}>{vocalFile.name}</strong>
                  <div style={{color:'rgba(255,255,255,.4)',fontSize:12,marginTop:2}}>{vocalDuration} seconds • Ready for AR Rahman treatment 🎵</div>
                </div>
                <button onClick={()=>{setVocalFile(null);setVocalUrl(null);setIntent(null);}} style={{background:'transparent',color:'rgba(255,255,255,.5)',border:0,cursor:'pointer'}}><X size={17}/></button>
              </div>
            </div>
          )}
          <div style={{flex:1,minHeight:0,overflow:'hidden'}}>
            {vocalFile
              ?<ProducerChat vocalName={vocalFile.name} duration={vocalDuration} onIntent={setIntent}/>
              :<div style={{height:'100%',display:'grid',placeItems:'center',color:'rgba(255,255,255,.25)',textAlign:'center',padding:24,fontSize:14}}>
                Upload your vocals above 🎤<br/>
                <span style={{fontSize:12,marginTop:8,display:'block'}}>Full orchestral BGM will be generated and mixed with your voice</span>
              </div>
            }
          </div>
        </main>
        <aside style={{borderLeft:'1px solid rgba(255,255,255,.08)',padding:14,overflowY:'auto',display:'flex',flexDirection:'column',gap:12}}>
          <div style={S.card}>
            <h3 style={{marginTop:0,fontSize:14,marginBottom:12}}>Song Plan</h3>
            {intent
              ?<div style={{display:'flex',flexDirection:'column',gap:10}}>
                <Field k="Mood" v={intent.mood}/>
                <Field k="Genre" v={intent.genre}/>
                <Field k="Key / BPM" v="C minor • 134 BPM"/>
                <Field k="Duration" v={`${vocalDuration} seconds`}/>
                <div><small style={{color:'rgba(255,255,255,.4)'}}>Instruments</small><div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:6}}>{intent.instruments?.map(i=><span key={i} style={S.pill}>{i}</span>)}</div></div>
                <Field k="Intensity" v={intent.intensity}/>
              </div>
              :<p style={{color:'rgba(255,255,255,.3)',fontSize:13,margin:0}}>Answer the chat to build your plan…</p>
            }
          </div>
          {intent&&(
            <button onClick={generate} style={{...S.btn('linear-gradient(135deg,#7c3aed,#b45309)'),padding:16,fontSize:15}}>
              <Zap size={18}/> Generate Full Song 🚀
            </button>
          )}
          <div style={{...S.card,background:'rgba(124,58,237,.08)',border:'1px solid rgba(124,58,237,.2)'}}>
            <p style={{margin:'0 0 6px',fontSize:12,color:'#a78bfa',fontWeight:600}}>🎵 How it works</p>
            <p style={{margin:0,fontSize:11,color:'rgba(255,255,255,.45)',lineHeight:1.6}}>1. Upload vocals<br/>2. AI generates matching orchestral BGM<br/>3. Server mixes vocals + BGM together<br/>4. Download your complete song</p>
          </div>
          <p style={{fontSize:11,color:'rgba(255,255,255,.18)',textAlign:'center',marginTop:'auto'}}>Powered by Replicate MusicGen</p>
        </aside>
      </div>
    </div>
  );
}
