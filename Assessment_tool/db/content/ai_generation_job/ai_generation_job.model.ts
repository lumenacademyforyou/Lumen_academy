/**
 * content.ai_generation_job — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface AiGenerationJobModel {
  job_id: string;
  requested_by: string;
  job_type: string;
  provider_name: string | null;
  model_name: string | null;
  prompt_version: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_estimate: number | null;
  job_status: string;
}
