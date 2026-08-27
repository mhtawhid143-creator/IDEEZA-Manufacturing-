# Deploying the two panels for a client review

Two Next.js applications, one database, one Vercel project each. The steps below
are the whole path from the pushed branch to two links a reviewer can open.

Nothing here contains a credential. Every value marked `«…»` is supplied at the
time it is used and lives only in Vercel's environment settings or in a local
`.env` file that git ignores.

## What is being deployed

| Panel | Vercel root directory | Landing page |
| --- | --- | --- |
| Buyer | `apps/user` | `/manufacturing` |
| Manufacturer | `apps/manufacturer` | `/dashboard` |

Branch: `feature/two-panel-platform`. It is never merged into `main` or
`develop` as part of a review.

## 1. A database

Both panels read one PostgreSQL database. Any hosted Postgres works; Neon
through Vercel's own integration is the shortest path, and its pooled connection
string is what the apps want.

Once it exists, apply the schema and the demo data **once**, from this machine:

```bash
DATABASE_URL="«the hosted connection string»" node tools/prepare-demo-database.mjs
```

That applies the committed migrations, seeds the reference scenario and lays down
both fixture sets — so a reviewer opens the panels onto real requests, quotes,
orders in production, payouts and cases instead of empty screens.

## 2. Two Vercel projects

Either import the repository twice from the Vercel dashboard, or run the CLI
twice from this machine. Each project needs:

- **Root Directory**: `apps/user` or `apps/manufacturer`
- **Include source files outside the Root Directory**: on (the apps import the
  workspace packages)
- **Framework**: Next.js — install and build commands come from the
  `vercel.json` beside each app, which builds the workspace packages the app
  depends on before the app itself
- **Node version**: 20 or newer

### Environment variables, on both projects

| Name | Value | Why |
| --- | --- | --- |
| `DATABASE_URL` | «the hosted connection string» | Both panels read the same database, so both get the same value |
| `REVIEW_DIRECT_SIGN_IN` | `1` | Replaces the password form with one click per seeded account, so a reviewer with the link is straight in |

### The CLI path

```bash
pnpm dlx vercel login          # authenticates in your browser, on your machine
cd apps/user          && pnpm dlx vercel --prod
cd ../manufacturer    && pnpm dlx vercel --prod
```

The CLI asks for the settings above on the first deploy of each project and
remembers them in `.vercel/`, which git ignores.

## 3. What the reviewer gets

Two links. Opening either one signs them in — the buyer panel as Nova Robotics,
the manufacturer panel as PrecisionCircuit Co. — with no password to type.
`/auth/sign-in?pick=1` on either panel switches account, which is how a reviewer
sees the second shop, and it is where signing out lands.

## Read this before sharing the links

`REVIEW_DIRECT_SIGN_IN=1` means **anyone holding the link is signed in**. That is
the point for a design review, and it is only acceptable because:

- the data is seeded fixture data — invented companies, invented orders, no real
  person's information and no real money;
- there is no payment provider connected, so nothing on these screens can move
  funds;
- the route it enables answers 404 without the variable, and both harnesses
  assert that, so turning review mode off restores the password form completely.

When the review is over, remove the variable from both projects and redeploy, or
delete the projects. Do not set it on anything that will hold real customer data.

## Keeping a review deployment current

Vercel redeploys on a push to the branch. The database only needs preparing
again when a migration is added:

```bash
DATABASE_URL="«…»" node tools/prepare-demo-database.mjs
```
