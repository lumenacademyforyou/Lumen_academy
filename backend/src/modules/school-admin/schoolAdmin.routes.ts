import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { getSchoolAdminsQuerySchema, updateSchoolAdminSchema, updateSchoolAdminStatusSchema, idParamSchema } from './schoolAdmin.validator';
import * as controller from './schoolAdmin.controller';

const router = Router();

// router.use(authenticate, requireRole('SUPER_ADMIN'));

router.get('/', validate(getSchoolAdminsQuerySchema), controller.getAllSchoolAdmins);
router.get('/:id', validate(idParamSchema), controller.getSchoolAdminById);
router.put('/:id', validate(updateSchoolAdminSchema), controller.updateSchoolAdmin);
router.patch('/:id', validate(updateSchoolAdminSchema), controller.updateSchoolAdmin);
router.patch('/:id/status', validate(updateSchoolAdminStatusSchema), controller.updateSchoolAdminStatus);
router.patch('/:id/suspend', validate(idParamSchema), controller.suspendSchoolAdmin);
router.patch('/:id/activate', validate(idParamSchema), controller.activateSchoolAdmin);
router.delete('/:id', validate(idParamSchema), controller.deleteSchoolAdmin);

export default router;