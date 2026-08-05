import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../utils/apiError';

export const validate =
  (schema: AnyZodObject) => (req: Request, _res: Response, next: NextFunction) => {
    try {
     schema.parse({
  body: req.body ?? {},
  query: req.query ?? {},
  params: req.params ?? {},
});
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.issues
  .map((e) => `${e.path.join('.')}: ${e.message}`)
  .join(", ");
        return next(new ApiError(400, message));
      }
      next(err);
    }
  };