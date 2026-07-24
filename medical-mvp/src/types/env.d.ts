declare namespace NodeJS {
  interface ProcessEnv {
    LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | string;
    /** Required for RAG embeddings / clinical KB ingestion (text-embedding-3-small). */
    OPENAI_API_KEY?: string;
  }
}
