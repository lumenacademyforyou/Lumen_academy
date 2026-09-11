/**
 * learn.revision_note — model (026_learn_study_tools.sql)
 *
 * BUG-21 — personal revision notes, optionally attached to a subject/topic.
 */
export interface RevisionNoteModel {
  note_id: string;
  user_id: string;
  subject: string | null;
  topic: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}
