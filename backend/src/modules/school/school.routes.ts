import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {createSchoolSchema, getSchoolsQuerySchema, updateSchoolSchema, idParamSchema } from './school.validator';
import * as controller from './school.controller';

const router = Router();

// router.use(authenticate, requireRole('SUPER_ADMIN'));
router.post("/", validate(createSchoolSchema), controller.createSchool);

router.get('/', validate(getSchoolsQuerySchema), controller.getAllSchools);
router.get('/:id', validate(idParamSchema), controller.getSchoolById);
router.put('/:id', validate(updateSchoolSchema), controller.updateSchool);
router.patch('/:id', validate(updateSchoolSchema), controller.updateSchool);
router.delete('/:id', validate(idParamSchema), controller.deleteSchool);

export default router;