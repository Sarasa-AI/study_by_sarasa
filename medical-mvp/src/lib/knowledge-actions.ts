"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { mapAiErrorToClientMessage } from "@/lib/ai-errors";
import { requireInstructorApi } from "@/lib/auth";
import { formatZodError, type CaseActionResult } from "@/lib/case-schema";
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { ingestClinicalText } from "@/lib/rag/ingester";
import { withServerAction } from "@/lib/server-action";
import { serializeError } from "@/lib/serialize-error";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

const ingestKnowledgeSchema = z.object({
  title: z.string().trim().min(3, "عنوان باید حداقل ۳ کاراکتر باشد"),
  source: z.string().trim().min(3, "منبع باید حداقل ۳ کاراکتر باشد"),
  content: z.string().trim().min(50, "متن راهنما باید حداقل ۵۰ کاراکتر باشد"),
  categoryId: z.string().trim().optional(),
});

export type IngestKnowledgeResult = CaseActionResult & {
  data?: { chunkCount: number; documentIds: string[] };
};

export type KnowledgeDocumentSummary = {
  title: string;
  source: string;
  chunkCount: number;
  lastIngestedAt: string | null;
};


/**
 * Extracts text from an uploaded PDF file.
 * Imports pdf-parse's internal lib file (not the package root) to avoid a
 * debug-mode side effect in index.js that reads/writes a test fixture on
 * import — unsafe inside bundled Next.js server code / read-only filesystems.
 */
async function extractPdfText(file: File): Promise<string> {
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await pdfParse(buffer);
  return result.text ?? "";
}

export async function getKnowledgeDocuments(): Promise<KnowledgeDocumentSummary[]> {
  const user = await requireInstructorApi();
  if (!user) {
    return [];
  }

  return withServerAction(
    { operation: "knowledge.list", userId: user.id },
    async () => {
      const groups = await prisma.clinicalDocument.groupBy({
        by: ["title", "source"],
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: "desc" } },
      });

      return groups.map((group) => ({
        title: group.title,
        source: group.source,
        chunkCount: group._count._all,
        lastIngestedAt: group._max.createdAt?.toISOString() ?? null,
      }));
    },
  );
}

/**
 * Ingests a knowledge base document. Accepts FormData so instructors can
 * either paste guideline text directly or upload a PDF; when a PDF file is
 * present its extracted text takes precedence over the manual textarea.
 */
export async function ingestKnowledgeAction(
  formData: FormData,
): Promise<IngestKnowledgeResult> {
  const user = await requireInstructorApi();
  if (!user) {
    return { success: false, message: "فقط استادان می‌توانند پایگاه دانش را به‌روزرسانی کنند" };
  }

  const title = String(formData.get("title") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim() || undefined;
  const manualContent = String(formData.get("content") ?? "").trim();
  const fileEntry = formData.get("file");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

  return withServerAction(
    {
      operation: "knowledge.ingest",
      userId: user.id,
      input: {
        titleLength: title.length,
        sourceLength: source.length,
        contentLength: manualContent.length,
        hasFile: Boolean(file),
        fileSize: file?.size ?? 0,
        categoryId: categoryId ?? null,
      },
    },
    async () => {
      try {
        let sourceContent = manualContent;

        if (file) {
          if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
            return { success: false, message: "فقط فایل PDF پذیرفته می‌شود" };
          }
          if (file.size > MAX_PDF_BYTES) {
            return { success: false, message: "حجم فایل PDF نباید بیشتر از ۲۰ مگابایت باشد" };
          }

          try {
            const extracted = await extractPdfText(file);
            sourceContent = extracted.trim();
          } catch (pdfError) {
            getLogger().error(
              {
                event: "knowledge.pdf_extract.failed",
                userId: user.id,
                err: serializeError(pdfError),
              },
              "PDF text extraction failed",
            );
            return {
              success: false,
              message: "استخراج متن از فایل PDF با خطا مواجه شد؛ فایل را بررسی کنید یا متن را به‌صورت دستی وارد کنید",
            };
          }

          if (!sourceContent) {
            return {
              success: false,
              message: "متنی از فایل PDF استخراج نشد؛ ممکن است فایل اسکن‌شده (تصویری) باشد",
            };
          }
        }

        const parsed = ingestKnowledgeSchema.parse({
          title,
          source,
          content: sourceContent,
          categoryId,
        });

        let categoryName: string | undefined;
        if (parsed.categoryId) {
          const category = await prisma.category.findUnique({
            where: { id: parsed.categoryId },
            select: { id: true, name: true },
          });
          if (!category) {
            return { success: false, message: "دسته‌بندی یافت نشد" };
          }
          categoryName = category.name;
        }

        const metadata: Record<string, unknown> = {
          ingestedBy: user.id,
          sourceType: file ? "pdf" : "manual",
        };
        if (parsed.categoryId) {
          metadata.categoryId = parsed.categoryId;
        }
        if (categoryName) {
          metadata.category = categoryName;
        }

        const result = await ingestClinicalText(
          parsed.title,
          parsed.content,
          parsed.source,
          metadata,
        );

        revalidatePath("/instructor/knowledge");

        return {
          success: true,
          message: `سند با موفقیت ذخیره و ایمبد شد (${result.chunkCount} بخش)`,
          data: {
            chunkCount: result.chunkCount,
            documentIds: result.documentIds,
          },
        };
      } catch (error) {
        getLogger().error(
          {
            event: "knowledge.ingest.failed",
            userId: user.id,
            err: serializeError(error),
          },
          "Knowledge base ingest failed",
        );

        if (error instanceof ZodError) {
          return { success: false, message: formatZodError(error) };
        }

        if (error instanceof Error && error.message.includes("content produced no chunks")) {
          return { success: false, message: "متن واردشده قابل تقسیم به بخش‌های معتبر نیست" };
        }

        const aiMessage = mapAiErrorToClientMessage(error);
        if (aiMessage !== "خطای سرور") {
          return { success: false, message: aiMessage };
        }

        return { success: false, message: "خطا در ذخیره و ایمبد سند" };
      }
    },
  );
}
