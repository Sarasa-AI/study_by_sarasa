"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { requireInstructorApi } from "@/lib/auth";
import { getLogger, logError } from "@/lib/logger";
import { withServerAction } from "@/lib/server-action";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 80;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

export type UploadClinicalImageResult =
  | { success: true; message: string; url: string }
  | { success: false; message: string };

/**
 * Saves a clinical image (EKG / X-Ray / rash) under public/uploads/cases
 * and returns a public URL path for Case.mediaUrl.
 */
export async function uploadClinicalImage(formData: FormData): Promise<UploadClinicalImageResult> {
  const user = await requireInstructorApi();
  if (!user) {
    return { success: false, message: "فقط اساتید می‌توانند تصویر بالینی بارگذاری کنند" };
  }

  return withServerAction(
    { operation: "clinicalMedia.upload", userId: user.id },
    async () => {
      try {
        const file = formData.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return { success: false, message: "فایل تصویر انتخاب نشده است" };
        }

        if (!ALLOWED_TYPES.has(file.type)) {
          return { success: false, message: "فقط فایل‌های JPEG و PNG مجاز هستند" };
        }

        if (file.size > MAX_BYTES) {
          return { success: false, message: "حجم تصویر نباید بیشتر از ۵ مگابایت باشد" };
        }

        const ext = file.type.includes("png") ? "png" : "jpg";
        const filename = `${Date.now()}-${randomUUID()}.${ext}`;
        const uploadsDir = path.join(process.cwd(), "public", "uploads", "cases");
        const inputBuffer = Buffer.from(await file.arrayBuffer());
        const image = sharp(inputBuffer, {
          failOn: "error",
          limitInputPixels: 40_000_000,
          sequentialRead: true,
        })
          .rotate()
          .resize({
            width: MAX_DIMENSION,
            height: MAX_DIMENSION,
            fit: "inside",
            withoutEnlargement: true,
          });

        let optimizedBuffer: Buffer;
        try {
          optimizedBuffer =
            ext === "png"
              ? await image
                  .png({ compressionLevel: 9, adaptiveFiltering: true })
                  .toBuffer()
              : await image
                  .jpeg({
                    quality: JPEG_QUALITY,
                    mozjpeg: true,
                    chromaSubsampling: "4:4:4",
                  })
                  .toBuffer();
        } catch (error) {
          getLogger().error(
            {
              event: "clinical_media.optimization.failed",
              userId: user.id,
              fileType: file.type,
              fileSize: file.size,
              err:
                error instanceof Error
                  ? { name: error.name, message: error.message }
                  : { message: "UnknownError" },
            },
            "Clinical image optimization failed",
          );
          return {
            success: false,
            message: "پردازش و فشرده‌سازی تصویر ناموفق بود؛ لطفاً فایل معتبر دیگری انتخاب کنید",
          };
        }

        await mkdir(uploadsDir, { recursive: true });
        await writeFile(path.join(uploadsDir, filename), optimizedBuffer, { flag: "wx" });

        return {
          success: true,
          message: "تصویر بالینی با موفقیت بارگذاری شد",
          url: `/uploads/cases/${filename}`,
        };
      } catch (error) {
        logError(getLogger(), {
          event: "clinicalMedia.upload.error",
          operation: "clinicalMedia.upload",
          error,
          msg: "Clinical image upload failed",
        });
        return { success: false, message: "خطا در ذخیره تصویر روی سرور" };
      }
    },
  );
}
