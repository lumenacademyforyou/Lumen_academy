import type { NextFunction, Request, Response } from "express";

// P2-13 (docs/assessment-tool-fix-prompt.md) — "add basic timing logs so we
// can see which endpoint is actually slow rather than guessing." Nothing in
// this codebase logged request duration anywhere before this; every
// performance discussion up to this point was necessarily a guess. One line
// per request, method + path + status + elapsed ms; anything over
// SLOW_REQUEST_MS gets flagged so it's grep-able (`grep SLOW`) without
// needing a log aggregator or APM tool wired up first.
const SLOW_REQUEST_MS = 500;

export function requestTiming(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs.toFixed(1)}ms`;
    if (elapsedMs >= SLOW_REQUEST_MS) {
      console.warn(`SLOW ${line}`);
    } else {
      console.log(line);
    }
  });
  next();
}
