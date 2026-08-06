import { z } from 'zod';

export const updateSchoolAdminSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    role: z.string().optional(),
    schoolId: z.string().uuid().optional(),
  }),
  query: z.object({}),
});

export const getSchoolAdminsQuerySchema = z.object({
  params: z.object({}),
  body: z.object({}),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    schoolId: z.string().uuid().optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  }),
});

export const updateSchoolAdminStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.string().transform((val) => val.toUpperCase()).pipe(z.enum(['ACTIVE', 'SUSPENDED'])),
  }),
  query: z.object({}),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({}),
  query: z.object({}),
});