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
5. Set `VITE_FIREBASE_DATABASE_URL` (and `FIREBASE_DATABASE_URL` for scripts/server) to your Firebase Realtime Database URL
6. (Migration) Set `FIREBASE_PROJECT_ID` and optional `FIRESTORE_DATABASE_ID`, then run:
   `npm run migrate:firestore-to-realtime`
   Add `-- --overwrite` to clear Realtime Database root before import
7. Deploy `database.rules.json` to your Realtime Database rules in Firebase Console (or via Firebase CLI)
8. Set `DISCORD_ARTICLE_WEBHOOK_URL` in server environment variables to enable protected Discord notifications when articles are approved/published
9. Run the app:
   `npm run dev`
