import { z } from 'zod';

export const updateSchoolSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).optional(),
    board: z.string().optional(),
    schoolType: z.string().optional(),
    medium: z.string().optional(),
    address: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    plan: z.string().optional(),
    maxStudents: z.number().int().positive().optional(),
    subscriptionStart: z.coerce.date().optional(),
    subscriptionEnd: z.coerce.date().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'TRIAL']).optional(),
  }),
});

export const getSchoolsQuerySchema = z.object({
  params: z.object({}),
  body: z.object({}),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    state: z.string().optional(),
    district: z.string().optional(),
    board: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'TRIAL']).optional(),
  }),
});

export const createSchoolSchema = z.object({
  params: z.object({}),
  query: z.object({}),
  body: z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    board: z.string().optional(),
    schoolType: z.string().optional(),
    medium: z.string().optional(),
    address: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    plan: z.string().optional(),
    maxStudents: z.number().int().positive().optional(),
    subscriptionStart: z.coerce.date().optional(),
    subscriptionEnd: z.coerce.date().optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "TRIAL"]).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({}),
  query: z.object({}),
});