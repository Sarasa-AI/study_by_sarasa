declare namespace NodeJS {
  interface ProcessEnv {
    LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | string;
  }
}
