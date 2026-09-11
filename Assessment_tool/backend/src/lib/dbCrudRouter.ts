import { NextFunction, Request, RequestHandler, Response, Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { AppError } from "../middleware/errorHandler.js";

export interface SimpleCrudRepository<TModel> {
  findById(id: string): Promise<TModel>;
  create(data: Partial<TModel>): Promise<TModel>;
  update(id: string, data: Partial<TModel>): Promise<TModel>;
  remove(id: string): Promise<void>;
}

export interface CrudRouterOptions {
  /** Applied to POST/PATCH/DELETE only; GET stays open. */
  writeMiddleware?: RequestHandler[];
  /** Skip registering POST/PATCH/DELETE entirely — for platform-owned data written by something other than this HTTP API (e.g. content, written by the (not yet built) generation/ingest workers per LA-DBD-004_backend_schema_map.md). */
  readOnly?: boolean;
}

/**
 * Generic REST router over a single-uuid-PK db/ repository:
 * GET /:id, POST /, PATCH /:id, DELETE /:id.
 *
 * No per-entity request-body validation here — Postgres itself rejects
 * malformed input (NOT NULL, FK, uuid-shape violations), and
 * backend/middleware/errorHandler.ts maps those to 400/404/409. Add a zod
 * schema per entity (matching backend/middleware/validate.ts's pattern) when
 * an endpoint needs stricter validation than "the database accepted it."
 */
export function makeCrudRouter<TModel>(repository: SimpleCrudRepository<TModel>, options: CrudRouterOptions = {}): Router {
  const router = Router();
  const writeMiddleware = options.writeMiddleware ?? [];

  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await repository.findById(req.params.id) });
    } catch (err) {
      next(err);
    }
  });

  if (options.readOnly) {
    return router;
  }

  router.post("/", ...writeMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ data: await repository.create(req.body ?? {}) });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", ...writeMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await repository.update(req.params.id, req.body ?? {}) });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", ...writeMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await repository.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function isOwnedBy(row: unknown, ownerColumn: string, userId: string): boolean {
  return (row as Record<string, unknown>)[ownerColumn] === userId;
}

const NOT_FOUND = () => new AppError(404, "NOT_FOUND", "Resource not found.");

/**
 * REST router over a single-uuid-PK db/ repository, scoped to rows the
 * signed-in user owns via a direct owner column (e.g. user_id). Every route
 * requires auth. A row that exists but belongs to someone else responds 404,
 * not 403 — same as it not existing at all, so ownership can't be probed by
 * id enumeration. Only usable for entities with a *direct* owner column on
 * the row itself; entities whose ownership is transitive (via a parent row,
 * e.g. assess.attempt_response -> assess.attempt.user_id) need a different
 * router — not this one, and not built yet.
 */
export function makeOwnedCrudRouter<TModel>(repository: SimpleCrudRepository<TModel>, ownerColumn: string): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await repository.findById(req.params.id);
      if (!isOwnedBy(row, ownerColumn, req.user!.appUserId)) {
        next(NOT_FOUND());
        return;
      }
      res.json({ data: row });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Owner column is always forced to the caller's own id — never trusts
      // a client-supplied value, so a user can only ever create rows for
      // themselves.
      const data = { ...(req.body ?? {}), [ownerColumn]: req.user!.appUserId };
      res.status(201).json({ data: await repository.create(data) });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await repository.findById(req.params.id);
      if (!isOwnedBy(existing, ownerColumn, req.user!.appUserId)) {
        next(NOT_FOUND());
        return;
      }
      // Ownership can't be reassigned via PATCH.
      const body = { ...(req.body ?? {}) } as Record<string, unknown>;
      delete body[ownerColumn];
      res.json({ data: await repository.update(req.params.id, body as Partial<TModel>) });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await repository.findById(req.params.id);
      if (!isOwnedBy(existing, ownerColumn, req.user!.appUserId)) {
        next(NOT_FOUND());
        return;
      }
      await repository.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
