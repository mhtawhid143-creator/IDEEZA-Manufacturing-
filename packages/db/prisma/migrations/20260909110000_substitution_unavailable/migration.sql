-- A shop's structured answer for a line it cannot cover at all.
--
-- Postgres refuses to use a freshly added enum value in the same transaction
-- that adds it, so this migration only adds the value; the check constraint
-- that keeps such a row empty of a named substitute follows in the next one.
ALTER TYPE "SubstitutionStatus" ADD VALUE 'unavailable';
ALTER TYPE "DomainEventKind" ADD VALUE 'substitution_unavailable';
