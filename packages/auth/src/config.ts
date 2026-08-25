/**
 * Every tunable comes from the environment with a safe default. There is no
 * signing secret to manage: sessions are opaque server side records, so nothing
 * secret is ever embedded in a token or in this codebase.
 */
export interface AuthConfig {
  /** How long a session survives without being used. */
  readonly idleWindowMinutes: number;
  /** How long a session may live in total, however active it is. */
  readonly absoluteWindowDays: number;
  /** How often an active session writes its last-seen timestamp back. */
  readonly touchIntervalSeconds: number;
  /** Failed sign-in attempts before the account is temporarily locked. */
  readonly maxFailedAttempts: number;
  readonly lockMinutes: number;
  /** log2 of the scrypt cost parameter. 15 means N = 32768. */
  readonly scryptCostLog2: number;
}

const positiveInt = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const DEFAULT_AUTH_CONFIG: AuthConfig = Object.freeze({
  idleWindowMinutes: 720,
  absoluteWindowDays: 30,
  touchIntervalSeconds: 60,
  maxFailedAttempts: 10,
  lockMinutes: 15,
  scryptCostLog2: 15,
});

export const authConfigFromEnvironment = (
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthConfig =>
  Object.freeze({
    idleWindowMinutes: positiveInt(
      environment['AUTH_SESSION_IDLE_MINUTES'],
      DEFAULT_AUTH_CONFIG.idleWindowMinutes,
    ),
    absoluteWindowDays: positiveInt(
      environment['AUTH_SESSION_ABSOLUTE_DAYS'],
      DEFAULT_AUTH_CONFIG.absoluteWindowDays,
    ),
    touchIntervalSeconds: positiveInt(
      environment['AUTH_SESSION_TOUCH_SECONDS'],
      DEFAULT_AUTH_CONFIG.touchIntervalSeconds,
    ),
    maxFailedAttempts: positiveInt(
      environment['AUTH_MAX_FAILED_ATTEMPTS'],
      DEFAULT_AUTH_CONFIG.maxFailedAttempts,
    ),
    lockMinutes: positiveInt(environment['AUTH_LOCK_MINUTES'], DEFAULT_AUTH_CONFIG.lockMinutes),
    scryptCostLog2: positiveInt(
      environment['AUTH_SCRYPT_COST_LOG2'],
      DEFAULT_AUTH_CONFIG.scryptCostLog2,
    ),
  });

/** The cookie the session token travels in. */
export const SESSION_COOKIE_NAME = 'ideeza_session';
