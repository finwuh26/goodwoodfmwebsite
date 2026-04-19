<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8344bcaa-0bfd-4b39-8a01-5d144cf14510

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. (Optional) Set `LASTFM_API_KEY` in `.env.local` and in Vercel environment variables for album-art fallback
4. (Optional) Set `VITE_OWNER_EMAIL` to enable automatic owner-role assignment for that email
5. Set `VITE_FIRESTORE_DATABASE_ID` (and `FIRESTORE_DATABASE_ID` for server APIs) to your persistent Firestore DB, e.g. `radio`; AI Studio `ai-studio-*` database IDs are ignored and forced to `radio`
6. Realtime Database support is configured via `databaseURL` in `firebase-applet-config.json`; deploy Realtime rules from `database.rules.json` to keep write access aligned with app roles
7. Set `DISCORD_ARTICLE_WEBHOOK_URL` in server environment variables to enable protected Discord notifications when articles are approved/published
8. Run the app:
   `npm run dev`
