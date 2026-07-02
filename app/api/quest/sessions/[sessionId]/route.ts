import { NextResponse } from "next/server";
import { loadQuestSession } from "../../../../../lib/server/questRepository";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId 不能为空。" }, { status: 400 });
    }

    const session = await loadQuestSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: "未找到对应训练会话。" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取训练会话失败。";

    return NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    );
  }
}
