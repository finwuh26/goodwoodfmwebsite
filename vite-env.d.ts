/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OWNER_EMAIL?: string;
  readonly VITE_FIRESTORE_DATABASE_ID?: string;
  readonly GEMINI_API_KEY?: string;
  readonly LASTFM_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
