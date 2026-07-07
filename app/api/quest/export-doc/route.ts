import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeTitle(title: string) {
  const cleaned = title.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || "抖音评价评分用户体验报告";
}

function ensureMarkdownName(title: string) {
  const sanitized = sanitizeTitle(title);
  return sanitized.endsWith(".md") ? sanitized : `${sanitized}.md`;
}

function findFirstUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    const match = value.match(/https?:\/\/[^\s"'<>]+/);
    return match?.[0];
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstUrl(item);
      if (found) return found;
    }
    return undefined;
  }

  if (isRecord(value)) {
    const preferredKeys = ["url", "link", "web_url", "document_url", "file_url", "share_url"];

    for (const key of preferredKeys) {
      const found = findFirstUrl(value[key]);
      if (found) return found;
    }

    for (const item of Object.values(value)) {
      const found = findFirstUrl(item);
      if (found) return found;
    }
  }

  return undefined;
}

function parseCliUrl(stdout: string) {
  const trimmed = stdout.trim();
  if (!trimmed) return undefined;

  try {
    return findFirstUrl(JSON.parse(trimmed));
  } catch {
    return findFirstUrl(trimmed);
  }
}

function getLarkCliCommand() {
  const nativeBinaryName = process.platform === "win32" ? "lark-cli.exe" : "lark-cli";
  const nativePaths = [
    join(process.cwd(), "node_modules", "@larksuite", "cli", "bin", nativeBinaryName),
    join(process.cwd(), ".netlify", "functions-internal", "___netlify-server-handler", "node_modules", "@larksuite", "cli", "bin", nativeBinaryName),
    join(process.cwd(), "node_modules", ".pnpm", "@larksuite+cli@1.0.65", "node_modules", "@larksuite", "cli", "bin", nativeBinaryName)
  ];

  const nativePath = nativePaths.find((item) => existsSync(item));
  if (nativePath) {
    return nativePath;
  }

  const shimName = process.platform === "win32" ? "lark-cli.cmd" : "lark-cli";
  const localShim = join(process.cwd(), "node_modules", ".bin", shimName);

  return existsSync(localShim) ? localShim : "lark-cli";
}

function getCliEnv() {
  const localBin = join(process.cwd(), "node_modules", ".bin");

  return {
    ...process.env,
    PATH: [localBin, process.env.PATH || ""].filter(Boolean).join(delimiter)
  };
}

export async function POST(request: Request) {
  let tempDir = "";

  try {
    const payload = await request.json();

    if (!isRecord(payload)) {
      return NextResponse.json({ error: "请求体必须是 JSON object。" }, { status: 400 });
    }

    const markdown = typeof payload.markdown === "string" ? payload.markdown.trim() : "";
    const title = typeof payload.title === "string" ? payload.title : "抖音评价评分用户体验报告";

    if (!markdown) {
      return NextResponse.json({ error: "markdown 不能为空。" }, { status: 400 });
    }

    tempDir = await mkdtemp(join(tmpdir(), "quest-report-"));
    const fileName = ensureMarkdownName(title);
    const filePath = join(tempDir, fileName);
    await writeFile(filePath, markdown, "utf8");

    try {
      const cli = getLarkCliCommand();
      const { stdout } = await execFileAsync(cli, ["markdown", "+create", "--file", filePath, "--format", "json"], {
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
        env: getCliEnv()
      });
      const url = parseCliUrl(stdout);

      return NextResponse.json({
        status: "ready",
        message: url ? "飞书 Markdown 文档已创建。" : "飞书 Markdown 文档已创建，但 CLI 未返回可打开链接。",
        url
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "飞书 CLI 调用失败";

      return NextResponse.json({
        status: "fallback",
        message: `${message}；已生成报告 Markdown，请先使用页面内复制能力。`
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "导出请求处理失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
