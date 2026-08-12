"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { uploadClinicalImage } from "@/lib/clinical-media-actions";

type ClinicalImageFieldProps = {
  value: string;
  onChange: (url: string) => void;
  error?: string;
};

export function ClinicalImageField({ value, onChange, error }: ClinicalImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadClinicalImage(formData);
      if (!result.success) {
        setUploadError(result.message);
        return;
      }
      onChange(result.url);
    } catch {
      setUploadError("خطا در بارگذاری تصویر");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm text-slate-700">
          تصویر بالینی (Clinical Image / EKG / X-Ray)
        </label>
        <p className="mb-2 text-xs text-slate-500">
          JPEG یا PNG — حداکثر ۵ مگابایت. دانشجویان این تصویر را هنگام آزمون/تمرین می‌بینند.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={uploading}
            className="gap-2"
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال بارگذاری...
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4" />
                انتخاب تصویر
              </>
            )}
          </Button>
          {value ? (
            <Button
              type="button"
              variant="danger"
              disabled={uploading}
              className="gap-2"
              onClick={() => onChange("")}
            >
              <Trash2 className="h-4 w-4" />
              حذف تصویر
            </Button>
          ) : null}
        </div>
      </div>

      {value ? (
        <div className="relative h-48 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <Image
            src={value}
            alt="پیش‌نمایش تصویر بالینی"
            fill
            unoptimized={value.startsWith("/")}
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 640px"
          />
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-xs text-slate-500">یا آدرس تصویر (اختیاری)</label>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://… یا /uploads/cases/…"
          disabled={uploading}
        />
      </div>

      {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
