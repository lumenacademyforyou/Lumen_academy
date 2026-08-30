// import { createClient } from "@supabase/supabase-js";

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// if (!supabaseUrl || !supabasePublishableKey) {
//   throw new Error("Supabase environment variables are missing");
// }

// export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// export interface StudentProfile {
//   id?: string;
//   user_id: string;
//   email?: string;
//   display_name: string;
//   preferred_subjects: string[];
//   target_stream?: string;
//   target_exam_year?: number;
//   grade_class?: string;
//   phone_number?: string;
//   school_or_coaching?: string;
//   city?: string;
//   onboarding_completed?: boolean;
//   created_at?: string;
//   updated_at?: string;
// }

// export interface UserTask {
//   id: string;
//   user_id: string;
//   title: string;
//   subject: string;
//   completed: boolean;
//   due_date?: string;
//   created_at?: string;
// }

// export interface UserNote {
//   id: string;
//   user_id: string;
//   unit_id: string;
//   subject: string;
//   title: string;
//   content: string;
//   created_at?: string;
//   updated_at?: string;
// }

// export async function saveStudentProfile(profile: Partial<StudentProfile>): Promise<StudentProfile | null> {
//   if (!profile.user_id) {
//     console.error("saveStudentProfile: user_id is required");
//     return null;
//   }

//   const fullProfile: Partial<StudentProfile> = {
//     ...profile,
//     updated_at: new Date().toISOString(),
//   };

// const { data, error } = await supabase
//   .schema("core")
//   .from("student_profile")
//   .upsert(fullProfile, { onConflict: "user_id" })
//   .select()
//   .single();

//   if (error) {
//     console.error("Supabase upsert profile error:", error);
//     return null;
//   }

//   return data as StudentProfile;
// }

// export async function fetchStudentProfile(userIdOrEmail: string): Promise<StudentProfile | null> {
//   if (!userIdOrEmail) return null;

//   let query;

//   if (userIdOrEmail.includes("@")) {
//     query = supabase.schema("core").from("profiles").select("*").eq("email", userIdOrEmail).maybeSingle();
//   } else {
//     const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
//     if (!uuidRegex.test(userIdOrEmail)) {
//       console.warn("Invalid Supabase user ID:", userIdOrEmail);
//       return null;
//     }
//     query = supabase.schema("core").from("profiles").select("*").eq("user_id", userIdOrEmail).maybeSingle();
//   }

//   const { data, error } = await query;

//   if (error) {
//     console.error("Supabase profile fetch error:", error);
//     return null;
//   }

//   return (data as StudentProfile) ?? null;
// }

// // Task Handlers
// export async function fetchUserTasks(userId: string): Promise<UserTask[]> {
//   const { data, error } = await supabase.from("user_tasks").select("*").eq("user_id", userId);

//   if (error) {
//     console.error("Supabase tasks fetch error:", error);
//     return [];
//   }

//   return data as UserTask[];
// }

// export async function saveUserTask(task: Partial<UserTask> & { user_id: string }): Promise<UserTask | null> {
//   const newTask = {
//     id: task.id || `task_${Date.now()}`,
//     user_id: task.user_id,
//     title: task.title || "Untitled Task",
//     subject: task.subject || "General",
//     completed: task.completed ?? false,
//     due_date: task.due_date || new Date().toISOString(),
//   };

//   const { data, error } = await supabase.from("user_tasks").upsert(newTask).select().single();

//   if (error) {
//     console.error("Supabase task save error:", error);
//     return null;
//   }

//   return data as UserTask;
// }

// export async function deleteUserTask(taskId: string): Promise<void> {
//   const { error } = await supabase.from("user_tasks").delete().eq("id", taskId);
//   if (error) console.error("Supabase delete task error:", error);
// }

// // Note Handlers
// export async function fetchUserNotes(userId: string, unitId?: string): Promise<UserNote[]> {
//   let query = supabase.from("user_notes").select("*").eq("user_id", userId);
//   if (unitId) {
//     query = query.eq("unit_id", unitId);
//   }

//   const { data, error } = await query;

//   if (error) {
//     console.error("Supabase fetch notes error:", error);
//     return [];
//   }

//   return data as UserNote[];
// }

// export async function saveUserNote(note: Partial<UserNote> & { user_id: string }): Promise<UserNote | null> {
//   const newNote = {
//     id: note.id || `note_${Date.now()}`,
//     user_id: note.user_id,
//     unit_id: note.unit_id || "general",
//     subject: note.subject || "General",
//     title: note.title || "Untitled Note",
//     content: note.content || "",
//     updated_at: new Date().toISOString(),
//   };

//   const { data, error } = await supabase.from("user_notes").upsert(newNote).select().single();

//   if (error) {
//     console.error("Supabase save note error:", error);
//     return null;
//   }

//   return data as UserNote;
// }

// export async function deleteUserNote(noteId: string): Promise<void> {
//   const { error } = await supabase.from("user_notes").delete().eq("id", noteId);
//   if (error) console.error("Supabase delete note error:", error);
// }


import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabase environment variables are missing");
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);

// =====================================================
// App User
// =====================================================

export interface AppUser {
  user_id: string;
  institution_id?: string | null;
  auth_user_id: string;
  email: string;
  mobile_number?: string | null;
  full_name: string;
  user_role: string;
  preferred_language?: string | null;
  status: string;
  last_login_at?: string | null;
}

// =====================================================
// Student Profile
// =====================================================

export interface StudentProfile {
  user_id: string;
  target_year?: number | null;
  class_level?: string | null;
  guardian_contact?: string | null;
  daily_study_minutes?: number | null;
  onboarding_state?: string | null;
}

// =====================================================
// APP USER HANDLERS
// =====================================================

/**
 * Fetch the application user using the Supabase Auth user ID.
 *
 * auth.users.id
 *      ↓
 * core.app_user.auth_user_id
 */
export async function fetchAppUser(
  authUserId: string
): Promise<AppUser | null> {
  if (!authUserId) {
    return null;
  }

  const { data, error } = await supabase
    .schema("core")
    .from("app_user")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    console.error("Supabase app_user fetch error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return null;
  }

  return (data as AppUser) ?? null;
}

// =====================================================
// STUDENT PROFILE HANDLERS
// =====================================================

/**
 * Fetch student profile using the Supabase Auth user ID.
 *
 * auth.users.id
 *      ↓
 * core.app_user.auth_user_id
 *      ↓
 * core.app_user.user_id
 *      ↓
 * core.student_profile.user_id
 */
export async function fetchStudentProfile(
  authUserId: string
): Promise<StudentProfile | null> {
  if (!authUserId) {
    return null;
  }

  // Step 1: Find the application user
  const appUser = await fetchAppUser(authUserId);

  if (!appUser) {
    console.warn(
      "No core.app_user found for auth user:",
      authUserId
    );

    return null;
  }

  // Step 2: Find the student profile
  const { data, error } = await supabase
    .schema("core")
    .from("student_profile")
    .select("*")
    .eq("user_id", appUser.user_id)
    .maybeSingle();

  if (error) {
    console.error("Supabase student_profile fetch error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return null;
  }

  return (data as StudentProfile) ?? null;
}

/**
 * Save/update a student profile.
 *
 * The caller provides the Supabase Auth user ID.
 * We resolve the corresponding core.app_user.user_id
 * before writing to core.student_profile.
 */
export async function saveStudentProfile(
  authUserId: string,
  profile: Partial<StudentProfile>
): Promise<StudentProfile | null> {
  if (!authUserId) {
    console.error(
      "saveStudentProfile: authUserId is required"
    );

    return null;
  }

  // Find application user
  const appUser = await fetchAppUser(authUserId);

  if (!appUser) {
    console.error(
      "saveStudentProfile: core.app_user not found for auth user:",
      authUserId
    );

    return null;
  }

  const profileData = {
    user_id: appUser.user_id,

    target_year:
      profile.target_year ?? null,

    class_level:
      profile.class_level ?? null,

    guardian_contact:
      profile.guardian_contact ?? null,

    daily_study_minutes:
      profile.daily_study_minutes ?? null,

    onboarding_state:
      profile.onboarding_state ?? null,
  };

  const { data, error } = await supabase
    .schema("core")
    .from("student_profile")
    .upsert(profileData, {
      onConflict: "user_id",
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase student_profile save error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return null;
  }

  return data as StudentProfile;
}

// BUG-20/21 (docs/assessment-tool-debug-plan.md Phase 7) — the task/note
// handlers that used to live here (querying `user_tasks`/`user_notes`,
// Supabase tables that were never migrated — every call silently failed)
// were removed. Real, server-backed replacements: frontend/src/services/
// customTasksApi.ts (learn.custom_task) and revisionNotesApi.ts
// (learn.revision_note).