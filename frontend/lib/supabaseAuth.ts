import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase.js";

// Sends a one-time code to the given email via Supabase Auth. shouldCreateUser
// controls whether a brand-new account is created if the email isn't
// registered yet (true for the register flow, false for sign-in so an
// unregistered email fails the same way a wrong password would).
export async function sendEmailOtp(email: string, shouldCreateUser: boolean): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(email: string, token: string): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
  if (!data.session) throw new Error("Verification succeeded but no session was returned.");
  return data.session;
}

// Phone must be in E.164 format (e.g. "+919876543210") — Supabase rejects
// anything else before it ever reaches the SMS provider.
export async function sendPhoneOtp(phone: string, shouldCreateUser: boolean): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser },
  });
  if (error) throw error;
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) throw error;
  if (!data.session) throw new Error("Verification succeeded but no session was returned.");
  return data.session;
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
