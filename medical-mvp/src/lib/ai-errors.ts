import { AIGatewayError, AIValidationError } from "@/lib/ai";

const AI_CLIENT_MESSAGES: Record<string, string> = {
  RATE_LIMIT: "محدودیت درخواست هوش مصنوعی؛ لطفاً کمی بعد تلاش کنید",
  NETWORK_ERROR: "خطا در اتصال به سرویس هوش مصنوعی",
  PARSE_ERROR: "پاسخ هوش مصنوعی قابل پردازش نبود",
  VALIDATION_ERROR: "خروجی هوش مصنوعی با ساختار مورد انتظار مطابقت ندارد",
  API_ERROR: "خطا در سرویس هوش مصنوعی",
};

export function mapAiErrorToClientMessage(error: unknown): string {
  if (error instanceof AIValidationError) {
    return AI_CLIENT_MESSAGES.VALIDATION_ERROR;
  }

  if (error instanceof AIGatewayError) {
    return AI_CLIENT_MESSAGES[error.code] ?? AI_CLIENT_MESSAGES.API_ERROR;
  }

  return "خطای سرور";
}
