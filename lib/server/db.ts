import "server-only";

import { Pool } from "pg";

export const missingDatabaseUrlMessage = "后端数据库未配置，请先在 .env.local 设置 DATABASE_URL。";
export const invalidDatabaseUrlMessage =
  "DATABASE_URL 不是有效的 Supabase Session Pooler 连接串，请从 Supabase Connect 面板复制完整 Session pooler URI。";

export type DatabaseConfigStatus = {
  databaseConfigured: boolean;
  databaseUrlValid: boolean;
  message: string;
};

declare global {
  var questPostgresPool: Pool | undefined;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabaseConfigStatus(): DatabaseConfigStatus {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    return {
      databaseConfigured: false,
      databaseUrlValid: false,
      message: missingDatabaseUrlMessage
    };
  }

  try {
    const url = new URL(connectionString);
    const rawValue = connectionString.toLowerCase();
    const username = decodeURIComponent(url.username || "").toLowerCase();
    const hasPassword = Boolean(url.password);
    const host = url.hostname.toLowerCase();
    const database = url.pathname.replace(/^\//, "");
    const hasPlaceholder =
      rawValue.includes("hidden") ||
      rawValue.includes("user") ||
      rawValue.includes("password") ||
      rawValue.includes("host") ||
      rawValue.includes("[your-password]");

    if (
      !["postgres", "postgresql"].includes(url.protocol.replace(":", "")) ||
      !username.startsWith("postgres.") ||
      username === "hidden" ||
      !hasPassword ||
      !host.endsWith(".pooler.supabase.com") ||
      host === "hidden" ||
      url.port !== "5432" ||
      database !== "postgres" ||
      hasPlaceholder
    ) {
      return {
        databaseConfigured: true,
        databaseUrlValid: false,
        message: invalidDatabaseUrlMessage
      };
    }

    return {
      databaseConfigured: true,
      databaseUrlValid: true,
      message: "后端数据库连接串格式有效。"
    };
  } catch {
    return {
      databaseConfigured: true,
      databaseUrlValid: false,
      message: invalidDatabaseUrlMessage
    };
  }
}

function createPool() {
  const status = getDatabaseConfigStatus();
  const connectionString = process.env.DATABASE_URL;

  if (!status.databaseConfigured) {
    throw new Error(missingDatabaseUrlMessage);
  }

  if (!status.databaseUrlValid || !connectionString) {
    throw new Error(invalidDatabaseUrlMessage);
  }

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
}

export function getPool() {
  const status = getDatabaseConfigStatus();

  if (!status.databaseConfigured) {
    throw new Error(missingDatabaseUrlMessage);
  }

  if (!status.databaseUrlValid) {
    throw new Error(invalidDatabaseUrlMessage);
  }

  if (!globalThis.questPostgresPool) {
    globalThis.questPostgresPool = createPool();
  }

  return globalThis.questPostgresPool;
}
