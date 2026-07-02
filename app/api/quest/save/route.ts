import { NextResponse } from "next/server";
import { invalidDatabaseUrlMessage, missingDatabaseUrlMessage } from "../../../../lib/server/db";
import { saveQuestProgress, SaveQuestRequest } from "../../../../lib/server/questRepository";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseSaveRequest(payload: unknown): SaveQuestRequest {
  if (!isRecord(payload)) {
    throw new Error("请求体必须是 JSON object。");
  }

  const activeLevelId = payload.activeLevelId;
  const levelId = payload.levelId;
  const values = payload.values;
  const score = payload.score;

  if (typeof activeLevelId !== "string" || !activeLevelId.trim()) {
    throw new Error("activeLevelId 不能为空。");
  }

  if (typeof levelId !== "string" || !levelId.trim()) {
    throw new Error("levelId 不能为空。");
  }

  if (!isRecord(values)) {
    throw new Error("values 必须是字段和值组成的 object。");
  }

  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 100) {
    throw new Error("score 必须是 0 到 100 的整数。");
  }

  return {
    sessionId: typeof payload.sessionId === "string" && payload.sessionId.trim() ? payload.sessionId : undefined,
    activeLevelId,
    levelId,
    values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value ?? "")])),
    score,
    reportCard: typeof payload.reportCard === "string" ? payload.reportCard : undefined,
    finalReport: typeof payload.finalReport === "string" ? payload.finalReport : undefined
  };
}

export async function POST(request: Request) {
  let saveRequest: SaveQuestRequest;

  try {
    const payload = await request.json();
    saveRequest = parseSaveRequest(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求格式错误。";

    return NextResponse.json(
      {
        error: message
      },
      { status: 400 }
    );
  }

  try {
    const result = await saveQuestProgress(saveRequest);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败。";
    const status = message === missingDatabaseUrlMessage || message === invalidDatabaseUrlMessage ? 503 : 500;

    return NextResponse.json(
      {
        error: message
      },
      { status }
    );
  }
}
