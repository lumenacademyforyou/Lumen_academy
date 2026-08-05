import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import * as schoolService from './school.service';


export const createSchool = asyncHandler(async (req: Request, res: Response) => {
  const school = await schoolService.createSchool(req.body);
  return sendSuccess(res, school, "School created");
});


export const getAllSchools = asyncHandler(async (req: Request, res: Response) => {
  const result = await schoolService.getAllSchools(req.query as any);
  return sendSuccess(res, result, 'Schools fetched');
});

export const getSchoolById = asyncHandler(async (req: Request, res: Response) => {
  const school = await schoolService.getSchoolById(req.params.id);
  return sendSuccess(res, school, 'School fetched');
});

export const updateSchool = asyncHandler(async (req: Request, res: Response) => {
  const school = await schoolService.updateSchool(req.params.id, req.body);
  return sendSuccess(res, school, 'School updated');
});

export const deleteSchool = asyncHandler(async (req: Request, res: Response) => {
  await schoolService.deleteSchool(req.params.id);
  return sendSuccess(res, null, 'School deleted');
});