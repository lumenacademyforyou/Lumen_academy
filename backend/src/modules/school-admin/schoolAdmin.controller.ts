import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import * as service from './schoolAdmin.service';

export const getAllSchoolAdmins = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getAllSchoolAdmins(req.query as any);
  return sendSuccess(res, result, 'School admins fetched');
});

export const getSchoolAdminById = asyncHandler(async (req: Request, res: Response) => {
  const admin = await service.getSchoolAdminById(req.params.id);
  return sendSuccess(res, admin, 'School admin fetched');
});

export const updateSchoolAdmin = asyncHandler(async (req: Request, res: Response) => {
  const admin = await service.updateSchoolAdmin(req.params.id, req.body);
  return sendSuccess(res, admin, 'School admin updated');
});

export const suspendSchoolAdmin = asyncHandler(async (req: Request, res: Response) => {
  const admin = await service.setSchoolAdminStatus(req.params.id, 'SUSPENDED');
  return sendSuccess(res, admin, 'School admin suspended');
});

export const activateSchoolAdmin = asyncHandler(async (req: Request, res: Response) => {
  const admin = await service.setSchoolAdminStatus(req.params.id, 'ACTIVE');
  return sendSuccess(res, admin, 'School admin activated');
});

export const deleteSchoolAdmin = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteSchoolAdmin(req.params.id);
  return sendSuccess(res, null, 'School admin deleted');
});