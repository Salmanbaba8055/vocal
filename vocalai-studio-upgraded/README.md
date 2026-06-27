# VocalAI Studio — Upgraded MVP

This is the upgraded version of the Claude prototype. It keeps the React/Vite UI but changes the core architecture toward the original spec:

- AI producer endpoint: `/api/producer`
  - Uses Anthropic Claude when `ANTHROPIC_API_KEY` is set.
  - Falls back to a local rule-based producer so the UI still works during setup.
- Music generation endpoint: `/api/generate`
  - Uses Replicate predictions instead of calling Hugging Face from the app.
  - Sends the uploaded vocal as a data URL for conditioning.
  - Supports MusicGen-Chord as default and MusicGen melody as fallback.
- Client-side audio analysis
  - Detects approximate duration, rough key, BPM fallback, and time signature.
  - This is intentionally lightweight; use Essentia.js later for production-grade key/BPM.
- Browser mixing
  - Mixes the original vocal and generated backing track with Web Audio API.
  - Adds gentle bus compression and downloadable WAV output.

## Required Vercel environment variables

```bash
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6
REPLICATE_API_TOKEN=r8_...
REPLICATE_MUSICGEN_CHORD_VERSION=<exact Replicate version hash for sakemin/musicgen-chord>
REPLICATE_MUSICGEN_MELODY_VERSION=<exact Replicate version hash for meta/musicgen>
```

The exact Replicate model versions should be pinned from the Replicate model pages before production deploy.

## Run locally

```bash
npm install
npm run dev
```

For local serverless API testing, deploy to Vercel or run an API-compatible local dev setup.

## Important notes

- The original Claude prototype used `facebook/musicgen-small` through Hugging Face, which generated from text only.
- This version routes generation through Replicate and sends the vocal audio for chord/melody conditioning.
- API keys are only used on serverless API routes, not in browser code.
- The producer endpoint hides the JSON intent from the chat UI and passes it internally to generation.
