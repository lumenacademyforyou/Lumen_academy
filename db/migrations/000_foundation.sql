-- 000_foundation.sql
-- Lumen Academy — foundation: schemas, extensions, util shell.
--
-- Sources: docs/db/SCHEMA_SPEC.md, docs/design/05_physical_design_plan.md,
-- CLAUDE.md (migration order + schema list).
--
-- Every later migration depends on this one. Migration order is a hard
-- constraint: catalog -> core -> content -> assess -> learn. This migration
-- only creates containers (schemas, extensions) — no tables yet.
--
-- Idempotent: safe to re-run (create ... if not exists throughout), per
-- CLAUDE.md migration rule 5.

-- Five domain schemas, deliberately outside `public` so Supabase PostgREST
-- does not auto-expose them, plus `util` for shared functions. No util
-- functions are named anywhere in the design pack yet, so `util` is created
-- empty here — add functions in a later migration once they're specified.
create schema if not exists catalog;
create schema if not exists core;
create schema if not exists content;
create schema if not exists assess;
create schema if not exists learn;
create schema if not exists util;

-- Extensions fixed by docs/design/05_physical_design_plan.md
-- ("EXTENSIONS AND OPERATIONAL SETTINGS"):
--   pgcrypto    - password/token hashing, gen_random_uuid() for surrogate PKs
--   pg_trgm     - fuzzy duplicate detection on question stems (content.question)
--   vector      - pgvector: content.document_chunk.embedding + HNSW index
--   pg_partman  - automatic monthly partition maintenance on assess.attempt /
--                 assess.attempt_response
-- NOTE: pg_partman is not available on every managed Postgres host (Neon does
-- not ship it as of this writing; Supabase does via its extensions list). If
-- this statement fails when you run the migration, say so before we drop or
-- work around it — partitioning strategy depends on it (see LA-DBD-005).
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector;
create extension if not exists pg_partman;
