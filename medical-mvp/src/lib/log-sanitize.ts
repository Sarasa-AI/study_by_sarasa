const REDACTED = "[REDACTED]";
const TRUNCATED_SUFFIX = "...[truncated]";

const SENSITIVE_KEYS = new Set([
  "email",
  "studentfirstname",
  "prompt",
  "systeminstruction",
  "chiefcomplaint",
  "patientinfo",
  "symptoms",
  "diagnosis",
  "answers",
  "htmlbody",
  "html",
  "password",
  "token",
  "apikey",
  "secret",
  "authorization",
  "nextauthsecret",
  "cookie",
  "session",
  "credentials",
  "accesstoken",
  "refreshtoken",
]);

const NAME_KEYS = new Set(["name", "studentfirstname"]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "");
}

const RAW_OUTPUT_MAX_LENGTH = 2000;
const DEFAULT_STRING_MAX_LENGTH = 500;

function maskEmail(value: string): string {
  const atIndex = value.indexOf("@");
  if (atIndex <= 0) {
    return REDACTED;
  }

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}${TRUNCATED_SUFFIX}`;
}

function sanitizeValue(key: string | undefined, value: unknown, parentHasUserId: boolean): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const normalizedKey = key ? normalizeKey(key) : undefined;

  if (typeof value === "string") {
    if (normalizedKey === "email") {
      return maskEmail(value);
    }

    if (normalizedKey === "rawmodeloutput") {
      return truncateString(value, RAW_OUTPUT_MAX_LENGTH);
    }

    if (normalizedKey && SENSITIVE_KEYS.has(normalizedKey)) {
      return REDACTED;
    }

    if (normalizedKey && NAME_KEYS.has(normalizedKey) && parentHasUserId) {
      return REDACTED;
    }

    if (!key && value.length > DEFAULT_STRING_MAX_LENGTH) {
      return truncateString(value, DEFAULT_STRING_MAX_LENGTH);
    }

    if (key && (!normalizedKey || !SENSITIVE_KEYS.has(normalizedKey)) && value.length > DEFAULT_STRING_MAX_LENGTH) {
      return truncateString(value, DEFAULT_STRING_MAX_LENGTH);
    }

    return value;
  }

  if (normalizedKey && SENSITIVE_KEYS.has(normalizedKey)) {
    return REDACTED;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(undefined, item, parentHasUserId));
  }

  if (typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>);
  }

  return value;
}

function sanitizeObject(value: Record<string, unknown>): Record<string, unknown> {
  const hasUserId = "userId" in value;
  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    sanitized[key] = sanitizeValue(key, nestedValue, hasUserId);
  }

  return sanitized;
}

export function sanitizeLogContext<T extends Record<string, unknown>>(context: T): T {
  return sanitizeObject(context) as T;
}
