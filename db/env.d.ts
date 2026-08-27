declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    DISCORD_CLIENT_ID?: string;
    DISCORD_CLIENT_SECRET?: string;
    APP_BASE_URL?: string;
    APP_ENCRYPTION_KEY?: string;
  }
}
