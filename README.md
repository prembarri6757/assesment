# Secure Assessment Gateway

A high-integrity, multiple-choice examination platform built with Next.js 15, Firebase, and Genkit.

## Features
- **Secure Proctoring**: Full-screen enforcement and tab-focus tracking.
- **Zero-Trust Architecture**: Answer keys are stored in restricted Firestore collections.
- **AI-Powered**: Generate question ideas using Google Gemini 2.5 Flash.
- **Dual Dashboards**: Dedicated experiences for Administrators and Students.
- **Bulk Grading**: Administrator tool to grade all pending student results in one click.

## GitHub Deployment

To push this project to your repository, run these commands in your local terminal:

```bash
git init
git remote add origin https://github.com/prembarri6757/assesment.git
git add .
git commit -m "Initial commit: Secure Assessment Gateway"
git branch -M main
git push -u origin main
```

## Deployment to Vercel

1. **Push your code** to the GitHub repository using the steps above.
2. **Import the project** in the [Vercel Dashboard](https://vercel.com/new).
3. **Configure Environment Variables**:
   - `GOOGLE_GENAI_API_KEY`: Your Google AI SDK key (for AI question generation).
4. **Deploy**.

## Local Development

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:9002`.
