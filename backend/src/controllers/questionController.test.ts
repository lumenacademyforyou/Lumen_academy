import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextFunction, Request, Response } from "express";

// Integration test against the live content.question database — needs
// DATABASE_URL/SUPABASE_URL, which db/shared/pool.ts's config (db/config/env.ts)
// requires at import time (process.exit(1) if missing, for the whole process,
// not just this file). So the controller module is only ever imported once
// DATABASE_URL is confirmed present, and the test is skipped with an explicit
// reason otherwise — never a silent pass, per the CI test-step requirement.
const hasDb = Boolean(process.env.DATABASE_URL);

function invoke(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  subject?: string
): Promise<{ count?: number; questions?: unknown[] }> {
  return new Promise((resolve, reject) => {
    const req = { query: subject ? { subject } : {} } as unknown as Request;
    const res = { json: (body: { count?: number; questions?: unknown[] }) => resolve(body) } as unknown as Response;
    handler(req, res, reject as NextFunction).catch(reject);
  });
}

test(
  "getQuestionCount agrees with an unpaginated getQuestions list for the same subject filter",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live content.question database" },
  async () => {
    const { getQuestionCount, getQuestions } = await import("./questionController.js");
    const { pool } = await import("../../../db/shared/pool.js");

    try {
      for (const subject of ["physics", "chemistry", "botany", "zoology", undefined] as const) {
        const countResult = await invoke(getQuestionCount, subject);
        const listResult = await invoke(getQuestions, subject);
        assert.equal(
          countResult.count,
          listResult.questions?.length,
          `count endpoint and list endpoint disagree for subject=${subject ?? "(all)"}`
        );
      }
    } finally {
      await pool.end();
    }
  }
);
