/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_MAGIC_PUBLISHABLE_KEY: string;
  readonly VITE_CELO_CHAIN_ID: string;
  readonly VITE_CELO_RPC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
