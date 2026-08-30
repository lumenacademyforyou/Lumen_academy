import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { validate } from "../middleware/validate.js";
import {
  createInvitation,
  createInvitationSchema,
  getInvitationContext,
  listInvitations,
  revokeInvitation,
  resendInvitation,
} from "../services/invitation.service.js";
import {
  listUsers,
  listUsersQuerySchema,
  getUserDetail,
  adminUpdateUser,
  adminUpdateUserSchema,
  transitionUserStatus,
  transitionStatusSchema,
  grantRole,
  grantRoleSchema,
  revokeRole,
  forceSignOut,
  forcePasswordReset,
} from "../services/adminUser.service.js";

// LA-BE-CORE-002 CL-P6 task 5 / CL-P7. Every invitation route requires
// users:invite — creation, listing, revocation and resend are all the same
// authority question ("can this caller act on this invitation"), so one
// permission covers the whole surface rather than a separate code per verb.
// The user-lifecycle routes below accept *either* users:manage_platform or
// users:manage_institution — which rows each caller can actually reach is
// then narrowed by tenancy inside the service layer (getUserDetail/
// listUsers), not by which permission they hold.
const router = Router();
const gated = [requireAuth, requirePermission("users:invite")];

export function requireUserManagePermission(): (req: Request, res: Response, next: (err?: unknown) => void) => void {
  const managePlatform = requirePermission("users:manage_platform");
  const manageInstitution = requirePermission("users:manage_institution");
  return (req, res, next) => {
    managePlatform(req, res, (errPlatform) => {
      if (!errPlatform) return next();
      manageInstitution(req, res, next);
    });
  };
}
const userManageGated = [requireAuth, requireUserManagePermission()];

router.post("/invitations", ...gated, validate({ body: createInvitationSchema }), async (req: Request, res: Response, next) => {
  try {
    const ctx = await getInvitationContext(req.user!.appUserId);
    const invitation = await createInvitation(ctx, req.body);
    res.status(201).json({ data: invitation });
  } catch (err) {
    next(err);
  }
});

router.get("/invitations", ...gated, async (req: Request, res: Response, next) => {
  try {
    const ctx = await getInvitationContext(req.user!.appUserId);
    const invitations = await listInvitations(ctx);
    res.json({ data: invitations });
  } catch (err) {
    next(err);
  }
});

router.delete("/invitations/:id", ...gated, async (req: Request, res: Response, next) => {
  try {
    const ctx = await getInvitationContext(req.user!.appUserId);
    await revokeInvitation(ctx, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/invitations/:id/resend", ...gated, async (req: Request, res: Response, next) => {
  try {
    const ctx = await getInvitationContext(req.user!.appUserId);
    await resendInvitation(ctx, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// --- CL-P7: user lifecycle administration ---

router.get("/users", ...userManageGated, validate({ query: listUsersQuerySchema }), async (req: Request, res: Response, next) => {
  try {
    const ctx = await getInvitationContext(req.user!.appUserId);
    const result = await listUsers(ctx, req.query as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/users/:id", ...userManageGated, async (req: Request, res: Response, next) => {
  try {
    const ctx = await getInvitationContext(req.user!.appUserId);
    const user = await getUserDetail(ctx, req.params.id);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.patch("/users/:id", ...userManageGated, validate({ body: adminUpdateUserSchema }), async (req: Request, res: Response, next) => {
  try {
    const ctx = await getInvitationContext(req.user!.appUserId);
    const user = await adminUpdateUser(ctx, req.params.id, req.body);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.post("/users/:id/status", ...userManageGated, validate({ body: transitionStatusSchema }), async (req: Request, res: Response, next) => {
  try {
    const ctx = await getInvitationContext(req.user!.appUserId);
    const user = await transitionUserStatus(ctx, req.params.id, req.body, req.user!.appUserId);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.post("/users/:id/roles", ...userManageGated, validate({ body: grantRoleSchema }), async (req: Request, res: Response, next) => {
  try {
    const ctx = await getInvitationContext(req.user!.appUserId);
    const user = await grantRole(ctx, req.params.id, req.body, req.user!.appUserId);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.delete("/users/:id/roles/:roleCode", ...userManageGated, async (req: Request, res: Response, next) => {
  try {
    const ctx = await getInvitationContext(req.user!.appUserId);
    const user = await revokeRole(ctx, req.params.id, req.params.roleCode, req.user!.appUserId);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.post("/users/:id/force-sign-out", ...userManageGated, async (req: Request, res: Response, next) => {
  try {
    const ctx = await getInvitationContext(req.user!.appUserId);
    await forceSignOut(ctx, req.params.id, req.user!.appUserId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/users/:id/force-password-reset", ...userManageGated, async (req: Request, res: Response, next) => {
  try {
    const ctx = await getInvitationContext(req.user!.appUserId);
    await forcePasswordReset(ctx, req.params.id, req.user!.appUserId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
