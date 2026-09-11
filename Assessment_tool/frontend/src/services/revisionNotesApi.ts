import { apiFetch } from "./api";

// BUG-21 (docs/assessment-tool-debug-plan.md Phase 7) — real server-side
// persistence for StudyPlanView.tsx's "My Personal Revision Notes" panel.
// Replaces frontend/src/services/supabase.ts's fetchUserNotes/saveUserNote/
// deleteUserNote, which pointed at a Supabase table (`user_notes`) that was
// never migrated and silently failed every call. Server-side sanitisation
// (stripping HTML tags) happens in db/learn/revision_note/revision_note.repository.ts.

export interface RevisionNote {
  note_id: string;
  user_id: string;
  subject: string | null;
  topic: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function listMyRevisionNotes(): Promise<RevisionNote[]> {
  const res = await apiFetch<{ data: RevisionNote[] }>("/learn/revision-notes");
  return res.data;
}

export async function createRevisionNote(data: { title: string; content: string; subject?: string; topic?: string }): Promise<RevisionNote> {
  const res = await apiFetch<{ data: RevisionNote }>("/learn/revision-notes", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateRevisionNote(
  noteId: string,
  data: Partial<Pick<RevisionNote, "title" | "content" | "subject" | "topic">>
): Promise<RevisionNote> {
  const res = await apiFetch<{ data: RevisionNote }>(`/learn/revision-notes/${noteId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteRevisionNote(noteId: string): Promise<void> {
  await apiFetch<void>(`/learn/revision-notes/${noteId}`, { method: "DELETE" });
}
