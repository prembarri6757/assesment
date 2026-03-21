# Secure Assessment Gateway

A high-integrity, multiple-choice examination platform built with Next.js 15, Firebase, and Genkit.

## Features
- **Secure Proctoring**: Full-screen enforcement and tab-focus tracking.
- **Zero-Trust Architecture**: Answer keys are stored in restricted Firestore collections.
- **AI-Powered**: Generate question ideas using Google Gemini 2.5 Flash.
- **Dual Dashboards**: Dedicated experiences for Administrators and Students.

## Deployment to Vercel

1. **Push your code** to a GitHub repository.
2. **Import the project** in the [Vercel Dashboard](https://vercel.com/new).
3. **Configure Environment Variables**:
   - `GOOGLE_GENAI_API_KEY`: Your Google AI SDK key (for Genkit features).
   - *Note*: Firebase Client SDK config is already in `src/firebase/config.ts`, so no extra client-side env vars are strictly required for the public keys.
4. **Deploy**.

## Local Development

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:9002`.