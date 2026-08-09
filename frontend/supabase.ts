import { createClient } from "@supabase/supabase-js";
import.meta.env.VITE_SUPABASE_URL


console.log("VITE ENV:", import.meta.env);
console.log("SUPABASE URL:", import.meta.env.VITE_SUPABASE_URL);
console.log(
  "SUPABASE KEY:",
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabase environment variables are missing");
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);
// Retrieve environment variables if configured


export interface StudentProfile {
  id?: string;
  user_id: string;
  email?: string;
  display_name: string;
  preferred_subjects: string[];
  target_stream?: string;
  target_exam_year?: number;
  grade_class?: string;
  phone_number?: string;        // NEW
  school_or_coaching?: string;  // NEW
  city?: string;                // NEW
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

// Local Storage Fallback Keys
const LOCAL_STORAGE_PROFILE_KEY = "lumen_student_profiles";
const LOCAL_STORAGE_TASKS_KEY = "lumen_user_tasks";
const LOCAL_STORAGE_NOTES_KEY = "lumen_user_notes";

function getLocalProfiles(): Record<string, StudentProfile> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalProfiles(profiles: Record<string, StudentProfile>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.error("Failed to save local profiles", err);
  }
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

  // Try Supabase if configured with real URL
  if (supabaseUrl && !supabaseUrl.includes("dummy-supabase-project")) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .upsert(fullProfile, { onConflict: "user_id" })
        .select()
        .single();

      if (!error && data) {
        return data as StudentProfile;
      }
      if (error) console.error("Supabase upsert profile error:", error);
    } catch (err) {
      console.warn("Supabase upsert profile failed, falling back to local storage:", err);
    }
  }

  // LocalStorage Fallback
  const profiles = getLocalProfiles();
  const merged = { ...(profiles[profile.user_id] || {}), ...fullProfile } as StudentProfile;
  profiles[profile.user_id] = merged;
  if (merged.email) {
    profiles[merged.email] = merged;
  }
  setLocalProfiles(profiles);
  return merged;
}

// export async function fetchStudentProfile(userIdOrEmail: string): Promise<StudentProfile | null> {
//   if (!userIdOrEmail) return null;

//   if (supabaseUrl && !supabaseUrl.includes("dummy-supabase-project")) {
//     try {
//       const { data, error } = await supabase
//         .from("profiles")
//         .select("*")
//         .or(`user_id.eq.${userIdOrEmail},email.eq.${userIdOrEmail}`)
//         .maybeSingle();

//       if (!error && data) {
//         return data as StudentProfile;
//       }
//     } catch (err) {
//       console.warn("Supabase fetch profile failed, using local storage:", err);
//     }
//   }

//   // Fallback to local storage
//   const profiles = getLocalProfiles();
//   return profiles[userIdOrEmail] || null;
// }

export async function fetchStudentProfile(
  userIdOrEmail: string
): Promise<StudentProfile | null> {
  if (!userIdOrEmail) return null;
console.log("PROFILE USER ID:", userIdOrEmail);
  if (
    supabaseUrl &&
    !supabaseUrl.includes("dummy-supabase-project")
  ) {
    try {
      let query;

      // Email
      if (userIdOrEmail.includes("@")) {
        query = supabase
          .from("profiles")
          .select("*")
          .eq("email", userIdOrEmail)
          .maybeSingle();
      }

      // UUID
      else {
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(userIdOrEmail)) {
          console.warn(
            "Invalid Supabase user ID:",
            userIdOrEmail
          );

          // Don't send invalid value to UUID column
          const profiles = getLocalProfiles();
          return profiles[userIdOrEmail] || null;
        }

        query = supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userIdOrEmail)
          .maybeSingle();
      }

      const { data, error } = await query;

      if (!error && data) {
        return data as StudentProfile;
      }

      if (error) {
        console.error(
          "Supabase profile fetch error:",
          error
        );
      }
    } catch (err) {
      console.warn(
        "Supabase fetch profile failed, using local storage:",
        err
      );
    }
  }

  // LocalStorage fallback
  const profiles = getLocalProfiles();
  return profiles[userIdOrEmail] || null;
}

// Task Handlers
export async function fetchUserTasks(userId: string = "default_user"): Promise<UserTask[]> {
  if (supabaseUrl && !supabaseUrl.includes("dummy-supabase-project")) {
    try {
      const { data, error } = await supabase
        .from("user_tasks")
        .select("*")
        .eq("user_id", userId);

      if (!error && data) return data as UserTask[];
    } catch (err) {
      console.warn("Supabase tasks fetch error:", err);
    }
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TASKS_KEY);
    const tasks: UserTask[] = raw ? JSON.parse(raw) : [];
    return tasks.filter((t) => t.user_id === userId || userId === "default_user");
  } catch {
    return [];
  }
}

export async function saveUserTask(task: Partial<UserTask>): Promise<UserTask> {
  const newTask: UserTask = {
    id: task.id || `task_${Date.now()}`,
    user_id: task.user_id || "default_user",
    title: task.title || "Untitled Task",
    subject: task.subject || "General",
    completed: task.completed ?? false,
    due_date: task.due_date || new Date().toISOString()
  };

  if (supabaseUrl && !supabaseUrl.includes("dummy-supabase-project")) {
    try {
      const { data, error } = await supabase
        .from("user_tasks")
        .upsert(newTask)
        .select()
        .single();

      if (!error && data) return data as UserTask;
    } catch (err) {
      console.warn("Supabase task save error:", err);
    }
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TASKS_KEY);
    const tasks: UserTask[] = raw ? JSON.parse(raw) : [];
    const index = tasks.findIndex((t) => t.id === newTask.id);
    if (index >= 0) {
      tasks[index] = newTask;
    } else {
      tasks.push(newTask);
    }
    localStorage.setItem(LOCAL_STORAGE_TASKS_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error("Local task save error:", err);
  }

  return newTask;
}

export async function deleteUserTask(taskId: string, _userId?: string): Promise<void> {
  if (supabaseUrl && !supabaseUrl.includes("dummy-supabase-project")) {
    try {
      await supabase.from("user_tasks").delete().eq("id", taskId);
    } catch (err) {
      console.warn("Supabase delete task error:", err);
    }
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TASKS_KEY);
    const tasks: UserTask[] = raw ? JSON.parse(raw) : [];
    const filtered = tasks.filter((t) => t.id !== taskId);
    localStorage.setItem(LOCAL_STORAGE_TASKS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error("Local delete task error:", err);
  }
}

// Note Handlers
export async function fetchUserNotes(userId: string = "default_user", unitId?: string): Promise<UserNote[]> {
  if (supabaseUrl && !supabaseUrl.includes("dummy-supabase-project")) {
    try {
      let query = supabase.from("user_notes").select("*").eq("user_id", userId);
      if (unitId) {
        query = query.eq("unit_id", unitId);
      }
      const { data, error } = await query;
      if (!error && data) return data as UserNote[];
    } catch (err) {
      console.warn("Supabase fetch notes error:", err);
    }
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NOTES_KEY);
    const notes: UserNote[] = raw ? JSON.parse(raw) : [];
    return notes.filter((n) => (n.user_id === userId || userId === "default_user") && (!unitId || n.unit_id === unitId));
  } catch {
    return [];
  }
}

export async function saveUserNote(note: Partial<UserNote>): Promise<UserNote> {
  const newNote: UserNote = {
    id: note.id || `note_${Date.now()}`,
    user_id: note.user_id || "default_user",
    unit_id: note.unit_id || "general",
    subject: note.subject || "General",
    title: note.title || "Untitled Note",
    content: note.content || "",
    updated_at: new Date().toISOString()
  };

  if (supabaseUrl && !supabaseUrl.includes("dummy-supabase-project")) {
    try {
      const { data, error } = await supabase
        .from("user_notes")
        .upsert(newNote)
        .select()
        .single();

      if (!error && data) return data as UserNote;
    } catch (err) {
      console.warn("Supabase save note error:", err);
    }
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NOTES_KEY);
    const notes: UserNote[] = raw ? JSON.parse(raw) : [];
    const index = notes.findIndex((n) => n.id === newNote.id);
    if (index >= 0) {
      notes[index] = newNote;
    } else {
      notes.push(newNote);
    }
    localStorage.setItem(LOCAL_STORAGE_NOTES_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error("Local note save error:", err);
  }

  return newNote;
}

export async function deleteUserNote(noteId: string, _userId?: string): Promise<void> {
  if (supabaseUrl && !supabaseUrl.includes("dummy-supabase-project")) {
    try {
      await supabase.from("user_notes").delete().eq("id", noteId);
    } catch (err) {
      console.warn("Supabase delete note error:", err);
    }
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NOTES_KEY);
    const notes: UserNote[] = raw ? JSON.parse(raw) : [];
    const filtered = notes.filter((n) => n.id !== noteId);
    localStorage.setItem(LOCAL_STORAGE_NOTES_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error("Local delete note error:", err);
  }
}
