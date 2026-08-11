# Prisma migration policy

`schema6.prisma` remains at the project root because the package scripts
reference it directly.

Do not use `prisma db push` for a production database. After the schema is
reviewed and the Supabase URLs are in `.env`, create the initial migration:

```powershell
npm run db:migrate -- --name initial_schema
```

Commit the generated `migrations/` directory. Apply committed migrations to
production only with:

```powershell
npm run db:deploy
```

After the migration is applied, insert the safe demonstration content with:

```powershell
npm run db:seed
```

The seed is idempotent: it updates its syllabus and question records on later
runs, and refreshes only tests whose names begin with `__DEMO__`.

The content publishing service must validate these conditions in one database
transaction:

- A unit belongs to the supplied subject and a topic belongs to the supplied unit.
- A test section belongs to the supplied test.
- A test question belongs to the supplied test and, when present, its section.
- A single-correct question has exactly one correct option.
- A multiple-correct question has one or more correct options.
- Numerical, matching, and assertion-reason configurations match their
  declared `QuestionType` and are never exposed before submission.
