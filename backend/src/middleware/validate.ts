import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "./errorHandler.js";

interface ValidateSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export function validate(schemas: ValidateSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const [part, schema] of Object.entries(schemas) as [keyof ValidateSchemas, ZodType][]) {
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        const firstIssue = result.error.issues[0];
        const field = firstIssue.path.join(".") || part;
        next(new AppError(400, "VALIDATION_ERROR", `${field}: ${firstIssue.message}`));
        return;
      }
      req[part] = result.data;
    }
    next();
  };
}
