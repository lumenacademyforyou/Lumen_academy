import { prisma } from "../db.js";

export interface SupabaseAccessTokenPayload {
  sub: string;
  email?: string;
  phone?: string;
  user_metadata?: Record<string, unknown>;
}

export interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  role: string;
  locale: string;
  targetExam: string;
}

// Supabase's auth.users is the source of truth for identity. This lazily
// creates the matching row in our own User table on a given account's first
// authenticated request — see CLAUDE.md's "Auth architecture" section.
export async function ensureUserProfile(payload: SupabaseAccessTokenPayload): Promise<UserProfile> {
  const existing = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (existing) {
    return toProfile(existing);
  }

  const displayName =
    (payload.user_metadata?.display_name as string | undefined) ||
    (payload.user_metadata?.full_name as string | undefined) ||
    payload.email?.split("@")[0] ||
    payload.phone ||
    "Student";

  const created = await prisma.user.upsert({
    where: { id: payload.sub },
    update: {},
    create: {
      id: payload.sub,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      displayName,
    },
  });

  return toProfile(created);
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? toProfile(user) : null;
}

function toProfile(user: {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  role: string;
  locale: string;
  targetExam: string;
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    role: user.role,
    locale: user.locale,
    targetExam: user.targetExam,
  };
}
