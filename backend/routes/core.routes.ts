import { Router } from "express";
import { makeOwnedCrudRouter } from "../lib/dbCrudRouter.js";
import { subscriptionRepository } from "../../db/core/institution/app_user/subscription/subscription.repository.js";
import { enrollmentRepository } from "../../db/core/institution/app_user/enrollment/enrollment.repository.js";

// Only the core entities with a direct user_id column and a single-uuid PK
// are wired here, scoped to the signed-in user via makeOwnedCrudRouter:
//   - subscription, enrollment
// Deliberately NOT wired in this pass:
//   - app_user / student_profile / educator_profile — already served by the
//     existing GET /api/me + userProfile.service.ts; a second generic route
//     for the same rows would be a redundant, competing path.
//   - institution, subscription_plan — tenant/platform reference data, not
//     owned by a single user; needs an admin/tenant-scoped router, not this one.
//   - batch — tenant-scoped (institution_id), not user-owned.
//   - batch_member — composite PK (batch_id, user_id); makeOwnedCrudRouter's
//     single-:id shape doesn't support it.
const router = Router();

router.use("/subscriptions", makeOwnedCrudRouter(subscriptionRepository, "user_id"));
router.use("/enrollments", makeOwnedCrudRouter(enrollmentRepository, "user_id"));

export default router;
