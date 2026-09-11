import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";
import { AppError } from "./errorHandler.js";

/**
 * Rate limiting for the whole API surface.
 *
 * Before this, the only throttling anywhere in the app was three hand-rolled
 * cooldowns — `/auth/email-exists` (emailAvailability.service.ts's in-memory
 * per-IP window), invitation resend, and admin password-reset resend. Every
 * other route, including the unauthenticated reads below and every path that
 * fans out into Supabase Auth, could be called as fast as a caller could open
 * sockets, against a database pool capped at 4 connections
 * (db/shared/pool.ts). That is a cheap availability lever, not a theoretical
 * one.
 *
 * Two things shape the limits chosen here:
 *
 * 1. **Students share IPs.** Coaching centres and school labs sit behind one
 *    NAT, so every limiter below is really budgeting for a whole room, not
 *    one candidate. Both limiters run *before* requireAuth (the global one is
 *    mounted on the app, the public one guards routes that take no token at
 *    all), so in practice both key on the IP — `userOrIpKey` prefers the
 *    authenticated user, but `req.user` is only populated on routes mounted
 *    after requireAuth, so that branch is there for any per-user limiter
 *    added later, not for these two. The limits are sized accordingly:
 *    generous enough that a shared connection full of real candidates never
 *    reaches them.
 *
 * 2. **Taking a test is chatty.** TestTakingView flushes dirty answers on a
 *    timer, on blur, and before unload, on top of envelope/event/heartbeat
 *    traffic. The global ceiling has to sit well above a lab full of
 *    candidates all doing that at once, so it is deliberately high: it exists
 *    to stop automated abuse, not to shape normal use.
 *
 * In-memory (the default MemoryStore), for the same reason
 * emailAvailability.service.ts gives for its own bucket map: this process is
 * what serves the route, and a limiter that resets on deploy is still the
 * difference between "a script can sweep this endpoint" and "it cannot". If
 * this is ever deployed as more than one instance, these become per-instance
 * budgets and want a shared store.
 */

// `req.user` is populated by requireAuth, which runs per-route — so it is
// only set on limiters mounted after it. For the global limiter this
// naturally falls back to the IP, which is the correct behaviour for
// anonymous traffic anyway.
//
// ipKeyGenerator normalises IPv6 addresses to a /56 subnet; a raw req.ip key
// would let anyone with an IPv6 allocation mint a fresh bucket per request.
function userOrIpKey(req: Request): string {
  const appUserId = req.user?.appUserId;
  if (appUserId) return `u:${appUserId}`;
  return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

function limitExceeded(_req: Request, _res: Response, next: (err: AppError) => void): void {
  // Routed through the app's own error handler so a throttled caller gets the
  // same { error: { code, message } } envelope as every other failure,
  // instead of express-rate-limit's plain-text default.
  next(new AppError(429, "RATE_LIMITED", "Too many requests. Slow down and try again shortly."));
}

const shared = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: limitExceeded,
};

/**
 * The outer ceiling for everything under /api, per IP.
 *
 * A candidate mid-test generates on the order of 10-20 requests a minute
 * (autosave flushes, attempt events, session heartbeats, navigation). 1200
 * leaves room for a ~40-seat lab all sitting the same paper from one NAT
 * with headroom to spare, while still being far below what a scraper or a
 * flood needs to be effective. This is a crude abuse ceiling; the tight
 * budget lives on publicReadLimiter below, where the anonymous endpoints are.
 */
export const globalApiLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 1200,
  // GET /api/health is what an orchestrator or load balancer polls to decide
  // whether to keep this instance in rotation. Throttling it would turn a
  // burst of ordinary traffic into a false "unhealthy" verdict and a restart
  // loop, which is strictly worse than the abuse it would prevent — the
  // handler reads one `SELECT 1`.
  skip: (req) => req.path === "/health",
});

/**
 * The endpoints that answer without any token at all: GET /questions/count
 * and GET /syllabus. Both are cheap and legitimately public — a landing page
 * showing a question count, a syllabus listing — but they are also exactly
 * what an anonymous script would hammer, so they get a much tighter per-IP
 * budget than the authenticated surface.
 *
 * 120/min is roughly two landing-page loads a second from a single shared
 * connection, which no real audience produces and which makes a sweep of
 * these routes pointlessly slow.
 */
export const publicReadLimiter = rateLimit({
  ...shared,
  windowMs: 60_000,
  limit: 120,
});
