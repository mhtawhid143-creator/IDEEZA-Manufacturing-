-- Database-level guards for authentication rows.
--
-- As in the first guard migration, these are single-row statements only. The
-- session lifecycle itself is owned by packages/auth.

-- ---------------------------------------------------------------------------
-- A manufacturer session must name the manufacturer it acts for, and only a
-- manufacturer session may name one. This is the isolation boundary between two
-- manufacturers expressed at the lowest possible level: a session that could
-- act for "no particular manufacturer" would make every ownership check
-- ambiguous.
-- ---------------------------------------------------------------------------
ALTER TABLE "Session"
  ADD CONSTRAINT "session_manufacturer_binding"
  CHECK (
    ("role" = 'manufacturer' AND "activeManufacturerId" IS NOT NULL)
    OR ("role" <> 'manufacturer' AND "activeManufacturerId" IS NULL)
  );

-- ---------------------------------------------------------------------------
-- An idle window can never outlive the absolute window.
-- ---------------------------------------------------------------------------
ALTER TABLE "Session"
  ADD CONSTRAINT "session_expiry_window_ordered"
  CHECK ("idleExpiresAt" <= "absoluteExpiresAt" AND "issuedAt" <= "idleExpiresAt");

-- ---------------------------------------------------------------------------
-- A revoked session must say why, and a session with a reason must be revoked.
-- ---------------------------------------------------------------------------
ALTER TABLE "Session"
  ADD CONSTRAINT "session_revocation_is_explained"
  CHECK (("revokedAt" IS NULL) = ("revocationReason" IS NULL));

-- ---------------------------------------------------------------------------
-- Sign-in counters cannot go negative, and a stored hash is never empty.
-- ---------------------------------------------------------------------------
ALTER TABLE "UserCredential"
  ADD CONSTRAINT "credential_counters_sane"
  CHECK ("failedAttempts" >= 0 AND length("passwordHash") > 0);
