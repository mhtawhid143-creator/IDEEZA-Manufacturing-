# Authentication, roles and guards (T03)

`packages/auth` turns a request into an actor and refuses everything it cannot
justify. It owns no business rules: capabilities and access rules come from
`packages/domain` (T01) and rows come from `packages/db` (T02).

## 1. Shape

```
packages/auth/src
├─ password.ts        scrypt hashing, constant time verification, rehash policy
├─ tokens.ts          opaque session tokens, sha256 hashing at rest
├─ ports.ts           IdentityStore, SessionStore, BoundaryStore, Clock
├─ session.ts         SessionService: issue, verify, resolveActor, rotate, revoke, purge
├─ authentication.ts  AuthenticationService: sign in, sign out, password changes
├─ actor.ts           session + user -> AuthenticatedActor
├─ guards.ts          token reading, capability, role and self guards
├─ route-rules.ts     one route table per deployed surface, deny by default
├─ boundaries.ts      resource level access: request, quote, order, inventory, payout
├─ config.ts          all tunables from the environment
└─ prisma-stores.ts   Prisma implementations of the ports + createAuthServices
```

## 2. Design decisions

**Opaque server side sessions, not JWTs.** A session is a row. The token is 32
random bytes; only its SHA-256 hash is stored, so a database dump cannot be
replayed as a live session. The consequence worth naming: there is **no signing
secret to manage** anywhere in this system.

**Two expiry windows.** `idleExpiresAt` slides forward while the session is used;
`absoluteExpiresAt` never moves. A stolen token therefore cannot be kept alive
indefinitely, and the sliding write is throttled to once a minute
(`AUTH_SESSION_TOUCH_SECONDS`) so reads stay cheap.

**Every actor is re-derived from storage.** `resolveActor` re-checks suspension,
the account role and manufacturer membership on every request, and revokes the
session when any of them changed since sign-in. A role cannot be smuggled in by
passing an object around: the only way to obtain an `AuthenticatedActor` is from
a stored session.

**A manufacturer session names the manufacturer it acts for.** This is the
isolation boundary. It is enforced three times: the service verifies membership
before issuing, `resolveActor` re-verifies it, and the database refuses the row
outright (`session_manufacturer_binding`).

**scrypt, from the standard library.** N = 2^15, r = 8, p = 1, 64 byte key, per
user salt, constant time comparison. The parameters travel inside the stored
value (`scrypt$15$8$1$salt$key`), so the cost can be raised later and existing
passwords are re-hashed on the next successful sign-in. No native dependency.

**Sign-in tells an attacker nothing.** An unknown address, an account with no
password and a wrong password all produce the same `InvalidCredentialsError` with
the same public message, and the unknown-address path still spends the time of a
hash verification against a decoy.

**Failed attempts lock the account, not the address.** Ten failures
(`AUTH_MAX_FAILED_ATTEMPTS`) lock for fifteen minutes; a successful sign-in
resets the counter. While locked, even the right password is refused.

**Changing a password ends every session for that account.**

## 3. Roles

Three roles, from the domain layer: `buyer`, `manufacturer`, `ops_admin`. The
permission matrix (T01, deny by default) is the single authority for what each
one may do; `requireCapability` delegates straight to it.

A manufacturer actor always carries `manufacturerId`. A buyer or operations actor
never does.

## 4. Route guards

Each deployed surface has its own table, so a buyer path does not exist in the
manufacturer table and cannot be reached by mistake:

| Surface | Role | Examples |
| --- | --- | --- |
| `user` | buyer | `/manufacturing/rfq/*`, `/manufacturing/checkout/**`, `/manufacturing/orders/*/refund` |
| `manufacturer` | manufacturer | `/rfqs/*/quote`, `/quotes/*/revise`, `/orders/*/production`, `/inventory/**`, `/payouts` |
| `ops` | ops_admin | `/ops/refunds`, `/ops/disputes/*`, `/ops/payouts` |

`assertRouteAccess(surface, path, actor)` checks, in order:

1. a rule matches the path — **a path with no rule is refused**;
2. the rule is anonymous, or a session exists;
3. the actor role is the role that surface serves;
4. the actor holds the capability the rule names;
5. a manufacturer actor is bound to a manufacturer.

Tests assert the negative cases explicitly: no inventory route exists on the
buyer surface, no checkout route exists on the manufacturer surface, and neither
counterparty can reach the operations surface.

## 5. Protected domain boundaries

Route access is not resource access. `boundaries.ts` answers "may this actor see
*this* record", using the T01 access invariants:

| Function | Rule |
| --- | --- |
| `authorizeRfqAccess` | the owning buyer, a routed manufacturer, or operations |
| `authorizeQuoteAccess` | the buyer of the request, the quote's own manufacturer, or operations |
| `listVisibleQuotes` | buyer and operations see all; a manufacturer sees only its own |
| `authorizeOrderAccess` | the two counterparties of that order, or operations |
| `authorizeInventoryAccess` | the owning manufacturer (write), operations (read); a buyer holds no inventory capability at all |
| `authorizePayoutAccess` | the owning manufacturer may read, only operations may release |

A record that does not exist and a record the actor may not see produce the same
refusal, so ids cannot be probed.

## 6. Database additions

Two tables and one enum (migrations `20260825085934_auth_sessions` and
`20260825090000_auth_guards`):

- `UserCredential` — the password hash, kept out of `User` so a user read never
  carries it. Counters for failed attempts and the lock window.
- `Session` — `tokenHash` unique, role snapshot, `activeManufacturerId`, both
  expiry windows, revocation with a reason.

Check constraints:

| Constraint | Rule |
| --- | --- |
| `session_manufacturer_binding` | a manufacturer session must name a manufacturer; no other role may |
| `session_expiry_window_ordered` | `issuedAt <= idleExpiresAt <= absoluteExpiresAt` |
| `session_revocation_is_explained` | revoked exactly when a reason is recorded |
| `credential_counters_sane` | non-negative counters, non-empty hash |

## 7. Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `AUTH_SESSION_IDLE_MINUTES` | 720 | sliding idle window |
| `AUTH_SESSION_ABSOLUTE_DAYS` | 30 | hard session lifetime |
| `AUTH_SESSION_TOUCH_SECONDS` | 60 | how often the idle window is written back |
| `AUTH_MAX_FAILED_ATTEMPTS` | 10 | failures before a lock |
| `AUTH_LOCK_MINUTES` | 15 | lock duration |
| `AUTH_SCRYPT_COST_LOG2` | 15 | log2 of the scrypt cost |

No secret is required, and none is stored in the codebase. `.env` stays
git-ignored; `packages/db/.env.example` documents the database url.

## 8. Provisioning credentials

The seed deliberately does **not** create passwords: a default development
password is exactly the kind of thing that survives into production. Provision
explicitly instead:

```ts
const services = createAuthServices(prisma);
await services.authentication.setPassword(userId, passwordFromEnvironment);
```

## 9. Tests

62 tests, in two groups.

Unit (`packages/auth/test`, no database):

- `password.test.ts` — hash shape, salting, wrong password, tampered hash, rehash policy
- `session.test.ts` — issue, hash at rest, sliding window, clamping, idle and absolute expiry, revocation, rotation, purge, suspension, role change, membership withdrawal
- `authentication.test.ts` — sign in, identical refusals, lock and unlock, sign out, password change ends all sessions
- `guards.test.ts` — bearer and cookie reading, case-insensitive headers, token in a url ignored, capability and role guards per role, whole-request guard
- `route-rules.test.ts` — surface isolation both ways, fail closed on unknown paths, anonymous routes, unbound manufacturer session
- `boundaries.test.ts` — per-resource access for buyer, both manufacturers, an outsider and operations

Database (`auth-persistence.db.test.ts`, real PostgreSQL): credential storage,
session persistence and binding, the four check constraints, duplicate token
hash, sliding and expiry against stored rows, revocation reasons, password change
revoking everything, purge, and every boundary rule against the seeded scenario
including membership withdrawal and suspension revoking a live session.

## 10. Not in this task

No UI, no API routes, no Figma work, no payment integration and no deployment.
`guardRequest` and `assertRouteAccess` are framework agnostic on purpose: the
Next.js middleware and route handlers that call them arrive with the app tasks.
