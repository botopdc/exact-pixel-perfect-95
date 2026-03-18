/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_PROJECT_ID: string;
  readonly VITE_API_BASE_URL: string;
  // Core-Open Supabase (proposals & pricing domain)
  readonly VITE_CORE_SUPABASE_URL: string;
  readonly VITE_CORE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
