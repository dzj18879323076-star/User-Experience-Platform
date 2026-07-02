import { NextResponse } from "next/server";
import { getDatabaseConfigStatus } from "../../../../lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getDatabaseConfigStatus());
}
