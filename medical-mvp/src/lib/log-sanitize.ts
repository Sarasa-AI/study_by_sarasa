const REDACTED = "[REDACTED]";
const TRUNCATED_SUFFIX = "...[truncated]";

const SENSITIVE_KEYS = new Set([
  "email",
  "studentFirstName",
  "prompt",
  "systemInstruction",
  "chiefComplaint",
  "patientInfo",
  "symptoms",
  "diagnosis",
  "answers",
  "htmlBody",
  "html",
  "password",
  "token",
  "apiKey",
]);

const NAME_KEYS = new Set(["name", "studentFirstName"]);

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

  if (typeof value === "string") {
    if (key === "email") {
      return maskEmail(value);
    }

    if (key === "rawModelOutput") {
      return truncateString(value, RAW_OUTPUT_MAX_LENGTH);
    }

    if (key && SENSITIVE_KEYS.has(key)) {
      return REDACTED;
    }

    if (key && NAME_KEYS.has(key) && parentHasUserId) {
      return REDACTED;
    }

    if (!key && value.length > DEFAULT_STRING_MAX_LENGTH) {
      return truncateString(value, DEFAULT_STRING_MAX_LENGTH);
    }

    if (key && !SENSITIVE_KEYS.has(key) && value.length > DEFAULT_STRING_MAX_LENGTH) {
      return truncateString(value, DEFAULT_STRING_MAX_LENGTH);
    }

    return value;
  }

  if (key && SENSITIVE_KEYS.has(key)) {
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
