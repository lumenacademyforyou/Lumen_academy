import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabase environment variables are missing");
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

export interface StudentProfile {
  id?: string;
  user_id: string;
  email?: string;
  display_name: string;
  preferred_subjects: string[];
  target_stream?: string;
  target_exam_year?: number;
  grade_class?: string;
  phone_number?: string;
  school_or_coaching?: string;
  city?: string;
  onboarding_completed?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserTask {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  completed: boolean;
  due_date?: string;
  created_at?: string;
}

export interface UserNote {
  id: string;
  user_id: string;
  unit_id: string;
  subject: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

export async function saveStudentProfile(profile: Partial<StudentProfile>): Promise<StudentProfile | null> {
  if (!profile.user_id) {
    console.error("saveStudentProfile: user_id is required");
    return null;
  }

  const fullProfile: Partial<StudentProfile> = {
    ...profile,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(fullProfile, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("Supabase upsert profile error:", error);
    return null;
  }

  return data as StudentProfile;
}

export async function fetchStudentProfile(userIdOrEmail: string): Promise<StudentProfile | null> {
  if (!userIdOrEmail) return null;

  let query;

  if (userIdOrEmail.includes("@")) {
    query = supabase.from("profiles").select("*").eq("email", userIdOrEmail).maybeSingle();
  } else {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userIdOrEmail)) {
      console.warn("Invalid Supabase user ID:", userIdOrEmail);
      return null;
    }
    query = supabase.from("profiles").select("*").eq("user_id", userIdOrEmail).maybeSingle();
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase profile fetch error:", error);
    return null;
  }

  return (data as StudentProfile) ?? null;
}

// Task Handlers
export async function fetchUserTasks(userId: string): Promise<UserTask[]> {
  const { data, error } = await supabase.from("user_tasks").select("*").eq("user_id", userId);

  if (error) {
    console.error("Supabase tasks fetch error:", error);
    return [];
  }

  return data as UserTask[];
}

export async function saveUserTask(task: Partial<UserTask> & { user_id: string }): Promise<UserTask | null> {
  const newTask = {
    id: task.id || `task_${Date.now()}`,
    user_id: task.user_id,
    title: task.title || "Untitled Task",
    subject: task.subject || "General",
    completed: task.completed ?? false,
    due_date: task.due_date || new Date().toISOString(),
  };

  const { data, error } = await supabase.from("user_tasks").upsert(newTask).select().single();

  if (error) {
    console.error("Supabase task save error:", error);
    return null;
  }

  return data as UserTask;
}

export async function deleteUserTask(taskId: string): Promise<void> {
  const { error } = await supabase.from("user_tasks").delete().eq("id", taskId);
  if (error) console.error("Supabase delete task error:", error);
}

// Note Handlers
export async function fetchUserNotes(userId: string, unitId?: string): Promise<UserNote[]> {
  let query = supabase.from("user_notes").select("*").eq("user_id", userId);
  if (unitId) {
    query = query.eq("unit_id", unitId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase fetch notes error:", error);
    return [];
  }

  return data as UserNote[];
}

export async function saveUserNote(note: Partial<UserNote> & { user_id: string }): Promise<UserNote | null> {
  const newNote = {
    id: note.id || `note_${Date.now()}`,
    user_id: note.user_id,
    unit_id: note.unit_id || "general",
    subject: note.subject || "General",
    title: note.title || "Untitled Note",
    content: note.content || "",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("user_notes").upsert(newNote).select().single();

  if (error) {
    console.error("Supabase save note error:", error);
    return null;
  }

  return data as UserNote;
}

export async function deleteUserNote(noteId: string): Promise<void> {
  const { error } = await supabase.from("user_notes").delete().eq("id", noteId);
  if (error) console.error("Supabase delete note error:", error);
}
