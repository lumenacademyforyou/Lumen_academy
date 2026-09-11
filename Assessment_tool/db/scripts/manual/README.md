# Manual verification scripts

Everything in this directory (including `e2e/`) is a hand-run verification
script, not a regression suite:

- **Non-idempotent.** Several create rows (roles, attempts, invitations,
  institutions) with no cleanup, or assume a specific starting DB state.
  Running one twice can produce different results or fail outright on the
  second run.
- **Mutate live data.** They write through the real service/repository layer
  against whatever database `DATABASE_URL` points at — there is no seeded
  test database or transaction rollback here. Point `DATABASE_URL` at a
  throwaway/dev database before running one, never at production.
- **Not picked up by any test glob.** `npm run test:unit` only runs
  `backend/src/**/*.test.ts` and `db/assess/scoring/*.test.ts`. Nothing here
  matches either pattern, and it must stay that way — these are `prove-*`
  console scripts (run with `npx tsx db/scripts/manual/<file>.ts`), not
  `*.test.ts` files with assertions a runner can collect.

Run one directly, e.g.:

```
npx tsx db/scripts/manual/prove-cl4-lifecycle.ts
npx tsx db/scripts/manual/e2e/core_lifecycle.ts
```

Read each script's own header comment for what it proves and what state it
expects/leaves behind before running it.
