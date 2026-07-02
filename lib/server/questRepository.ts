import "server-only";

import { PoolClient } from "pg";
import { getLevelFields, levels } from "../quest";
import { getPool } from "./db";

export type SaveQuestRequest = {
  sessionId?: string;
  activeLevelId: string;
  levelId: string;
  values: Record<string, string>;
  score: number;
  reportCard?: string;
  finalReport?: string;
};

export type SaveQuestResponse = {
  sessionId: string;
  submissionId: string;
  savedFieldCount: number;
  verified: boolean;
  savedAt: string;
};

export type LoadQuestSessionResponse = {
  activeLevelId: string;
  submissions: Record<
    string,
    {
      levelId: string;
      score?: number;
      updatedAt: string;
      values: Record<string, string>;
    }
  >;
  reportArtifactCount: number;
};

type FieldMetadata = {
  fieldKey: string;
  fieldLabel: string;
  sectionTitle: string | null;
  sortOrder: number;
};

function getFieldMetadata(levelId: string, values: Record<string, string>) {
  const level = levels.find((item) => item.id === levelId);
  const metadata = new Map<string, FieldMetadata>();
  let sortOrder = 0;

  if (level?.sections) {
    for (const section of level.sections) {
      for (const field of section.fields) {
        sortOrder += 1;
        metadata.set(field, {
          fieldKey: field,
          fieldLabel: field,
          sectionTitle: section.title,
          sortOrder
        });
      }
    }
  } else if (level) {
    for (const field of getLevelFields(level)) {
      sortOrder += 1;
      metadata.set(field, {
        fieldKey: field,
        fieldLabel: field,
        sectionTitle: null,
        sortOrder
      });
    }
  }

  for (const field of Object.keys(values)) {
    if (!metadata.has(field)) {
      sortOrder += 1;
      metadata.set(field, {
        fieldKey: field,
        fieldLabel: field,
        sectionTitle: null,
        sortOrder
      });
    }
  }

  return Array.from(metadata.values()).filter((field) => Object.prototype.hasOwnProperty.call(values, field.fieldKey));
}

async function ensureSession(client: PoolClient, request: SaveQuestRequest) {
  if (request.sessionId) {
    const existing = await client.query<{ id: string }>(
      `
        update public.quest_sessions
        set active_level_id = $2
        where id = $1
        returning id
      `,
      [request.sessionId, request.activeLevelId]
    );

    if (existing.rowCount) {
      return existing.rows[0].id;
    }
  }

  const created = await client.query<{ id: string }>(
    `
      insert into public.quest_sessions (active_level_id, metadata)
      values ($1, $2::jsonb)
      returning id
    `,
    [request.activeLevelId, JSON.stringify({ source: "web_mvp" })]
  );

  return created.rows[0].id;
}

async function upsertSubmission(client: PoolClient, sessionId: string, request: SaveQuestRequest) {
  const result = await client.query<{ id: string; updated_at: Date }>(
    `
      insert into public.quest_level_submissions (session_id, level_id, score, status)
      values ($1, $2, $3, $4)
      on conflict (session_id, level_id)
      do update set
        score = excluded.score,
        status = excluded.status
      returning id, updated_at
    `,
    [sessionId, request.levelId, request.score, request.score >= 80 ? "completed" : "draft"]
  );

  return result.rows[0];
}

async function upsertFields(
  client: PoolClient,
  submissionId: string,
  levelId: string,
  values: Record<string, string>
) {
  const fields = getFieldMetadata(levelId, values);

  for (const field of fields) {
    await client.query(
      `
        insert into public.quest_submission_fields (
          submission_id,
          field_key,
          field_label,
          section_title,
          sort_order,
          value
        )
        values ($1, $2, $3, $4, $5, $6)
        on conflict (submission_id, field_key)
        do update set
          field_label = excluded.field_label,
          section_title = excluded.section_title,
          sort_order = excluded.sort_order,
          value = excluded.value
      `,
      [submissionId, field.fieldKey, field.fieldLabel, field.sectionTitle, field.sortOrder, values[field.fieldKey] || ""]
    );
  }
}

async function insertReportArtifacts(
  client: PoolClient,
  sessionId: string,
  submissionId: string,
  request: SaveQuestRequest
) {
  const artifacts = [
    { type: "level_report_card", content: request.reportCard?.trim() || "" },
    { type: "final_report", content: request.finalReport?.trim() || "" }
  ].filter((artifact) => artifact.content);

  for (const artifact of artifacts) {
    await client.query(
      `
        insert into public.quest_report_artifacts (
          session_id,
          submission_id,
          artifact_type,
          content_markdown,
          score
        )
        values ($1, $2, $3, $4, $5)
      `,
      [sessionId, submissionId, artifact.type, artifact.content, request.score]
    );
  }
}

async function countSubmissionFields(client: PoolClient, submissionId: string) {
  const result = await client.query<{ count: string }>(
    `
      select count(*)::text as count
      from public.quest_submission_fields
      where submission_id = $1
    `,
    [submissionId]
  );

  return Number(result.rows[0].count);
}

export async function saveQuestProgress(request: SaveQuestRequest): Promise<SaveQuestResponse> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const sessionId = await ensureSession(client, request);
    const submission = await upsertSubmission(client, sessionId, request);
    await upsertFields(client, submission.id, request.levelId, request.values);
    await insertReportArtifacts(client, sessionId, submission.id, request);

    const savedFieldCount = await countSubmissionFields(client, submission.id);
    await client.query("commit");

    const expectedFieldCount = Object.keys(request.values).length;

    return {
      sessionId,
      submissionId: submission.id,
      savedFieldCount,
      verified: savedFieldCount >= expectedFieldCount,
      savedAt: submission.updated_at.toISOString()
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function loadQuestSession(sessionId: string): Promise<LoadQuestSessionResponse | null> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const session = await client.query<{ active_level_id: string }>(
      `
        select active_level_id
        from public.quest_sessions
        where id = $1
      `,
      [sessionId]
    );

    if (!session.rowCount) {
      return null;
    }

    const submissions = await client.query<{
      level_id: string;
      score: number | null;
      updated_at: Date;
      field_key: string | null;
      value: string | null;
    }>(
      `
        select
          submissions.level_id,
          submissions.score,
          submissions.updated_at,
          fields.field_key,
          fields.value
        from public.quest_level_submissions submissions
        left join public.quest_submission_fields fields
          on fields.submission_id = submissions.id
        where submissions.session_id = $1
        order by submissions.level_id, fields.sort_order, fields.field_key
      `,
      [sessionId]
    );

    const artifacts = await client.query<{ count: string }>(
      `
        select count(*)::text as count
        from public.quest_report_artifacts
        where session_id = $1
      `,
      [sessionId]
    );

    const restored: LoadQuestSessionResponse = {
      activeLevelId: session.rows[0].active_level_id,
      submissions: {},
      reportArtifactCount: Number(artifacts.rows[0].count)
    };

    for (const row of submissions.rows) {
      if (!restored.submissions[row.level_id]) {
        restored.submissions[row.level_id] = {
          levelId: row.level_id,
          score: row.score ?? undefined,
          updatedAt: row.updated_at.toISOString(),
          values: {}
        };
      }

      if (row.field_key) {
        restored.submissions[row.level_id].values[row.field_key] = row.value || "";
      }
    }

    return restored;
  } finally {
    client.release();
  }
}
