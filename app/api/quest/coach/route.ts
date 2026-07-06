import { NextResponse } from "next/server";
import {
  QuestCoachMode,
  QuestCoachRequest,
  runQuestCoach,
  runQuestCoachFallback
} from "../../../../lib/server/questCoach";
import { saveQuestProgress } from "../../../../lib/server/questRepository";

export const runtime = "nodejs";

const validModes: QuestCoachMode[] = [
  "pre_submit_hint",
  "field_followup",
  "post_submit_review",
  "final_report",
  "guide_chat"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseValues(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("values 必须是字段和值组成的 object。");
  }

  return Object.fromEntries(Object.entries(value).map(([key, fieldValue]) => [key, String(fieldValue ?? "")]));
}

function parseSubmissions(value: unknown): QuestCoachRequest["submissions"] {
  if (!isRecord(value)) return undefined;

  const submissions: NonNullable<QuestCoachRequest["submissions"]> = {};

  for (const [levelId, rawSubmission] of Object.entries(value)) {
    if (!isRecord(rawSubmission)) continue;

    submissions[levelId] = {
      levelId:
        typeof rawSubmission.levelId === "string" && rawSubmission.levelId.trim()
          ? rawSubmission.levelId
          : levelId,
      updatedAt: typeof rawSubmission.updatedAt === "string" ? rawSubmission.updatedAt : "",
      score: typeof rawSubmission.score === "number" ? rawSubmission.score : undefined,
      values: parseValues(rawSubmission.values || {})
    };
  }

  return submissions;
}

function parseCoachRequest(payload: unknown): QuestCoachRequest {
  if (!isRecord(payload)) {
    throw new Error("请求体必须是 JSON object。");
  }

  const mode = payload.mode;
  const activeLevelId = payload.activeLevelId;
  const levelId = payload.levelId;
  const score = payload.score;

  if (typeof mode !== "string" || !validModes.includes(mode as QuestCoachMode)) {
    throw new Error("mode 必须是合法的 coach 模式。");
  }

  if (typeof activeLevelId !== "string" || !activeLevelId.trim()) {
    throw new Error("activeLevelId 不能为空。");
  }

  if (typeof levelId !== "string" || !levelId.trim()) {
    throw new Error("levelId 不能为空。");
  }

  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 100) {
    throw new Error("score 必须是 0 到 100 的整数。");
  }

  return {
    sessionId: typeof payload.sessionId === "string" && payload.sessionId.trim() ? payload.sessionId : undefined,
    activeLevelId,
    levelId,
    values: parseValues(payload.values),
    score,
    mode: mode as QuestCoachMode,
    userQuestion: typeof payload.userQuestion === "string" ? payload.userQuestion.trim().slice(0, 800) : undefined,
    submissions: parseSubmissions(payload.submissions)
  };
}

async function persistReportArtifact(request: QuestCoachRequest, reportMarkdown?: string) {
  if (!request.sessionId || !reportMarkdown?.trim()) return;

  if (request.mode !== "post_submit_review" && request.mode !== "final_report") return;

  await saveQuestProgress({
    sessionId: request.sessionId,
    activeLevelId: request.activeLevelId,
    levelId: request.levelId,
    values: request.values,
    score: request.score,
    reportCard: request.mode === "post_submit_review" ? reportMarkdown : undefined,
    finalReport: request.mode === "final_report" ? reportMarkdown : undefined
  });
}

async function runCoachWithRouteTimeout(coachRequest: QuestCoachRequest) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutResult = new Promise<ReturnType<typeof runQuestCoachFallback>>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(runQuestCoachFallback(coachRequest, "小评响应超时，已切换规则引导。"));
    }, 18_000);
  });

  try {
    return await Promise.race([runQuestCoach(coachRequest), timeoutResult]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function POST(request: Request) {
  let coachRequest: QuestCoachRequest;

  try {
    coachRequest = parseCoachRequest(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "请求格式错误。"
      },
      { status: 400 }
    );
  }

  try {
    const result = await runCoachWithRouteTimeout(coachRequest);
    await persistReportArtifact(coachRequest, result.reportMarkdown);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "导师点评生成失败。"
      },
      { status: 500 }
    );
  }
}
