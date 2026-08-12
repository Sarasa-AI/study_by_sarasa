"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { AiProcessingIndicator } from "@/components/ui/AiProcessingIndicator";
import {
  ingestKnowledgeAction,
  type KnowledgeDocumentSummary,
} from "@/lib/knowledge-actions";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type KnowledgeBaseManagerProps = {
  categories: Category[];
  documents: KnowledgeDocumentSummary[];
};

const MAX_PDF_MB = 20;

const INGEST_MESSAGES = [
  "در حال استخراج متن سند...",
  "در حال پردازش سند و تولید بردارهای RAG...",
  "در حال ذخیره در پایگاه دانش...",
];

export function KnowledgeBaseManager({ categories, documents }: KnowledgeBaseManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (selected && selected.type !== "application/pdf" && !selected.name.toLowerCase().endsWith(".pdf")) {
      setServerError("فقط فایل PDF پذیرفته می‌شود");
      setFile(null);
      event.target.value = "";
      return;
    }
    if (selected && selected.size > MAX_PDF_MB * 1024 * 1024) {
      setServerError(`حجم فایل PDF نباید بیشتر از ${MAX_PDF_MB} مگابایت باشد`);
      setFile(null);
      event.target.value = "";
      return;
    }
    setServerError(null);
    setFile(selected);
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    if (!file && !content.trim()) {
      setServerError("یک فایل PDF بارگذاری کنید یا متن راهنما را وارد کنید");
      return;
    }

    setIsSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("source", source);
      formData.set("content", content);
      if (categoryId) {
        formData.set("categoryId", categoryId);
      }
      if (file) {
        formData.set("file", file);
      }

      const result = await ingestKnowledgeAction(formData);

      if (!result.success) {
        setServerError(result.message);
        return;
      }

      setSuccessMessage(result.message);
      setTitle("");
      setSource("");
      setCategoryId("");
      setContent("");
      clearFile();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">افزودن سند بالینی به پایگاه دانش</h2>
          <p className="text-sm text-slate-600">
            راهنماهای بالینی (مثلاً AAP) را به‌صورت فایل PDF بارگذاری کنید یا متن آن را وارد کنید تا برای تولید کیس مبتنی بر RAG ایمبد و ذخیره شوند.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm">عنوان سند</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={isSubmitting}
              placeholder="مثال: AAP Bronchiolitis Guideline 2022"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm">منبع / استناد</label>
            <Input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              disabled={isSubmitting}
              placeholder="مثال: AAP Clinical Practice Guideline"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm">دسته‌بندی (اختیاری)</label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50"
            >
              <option value="">بدون دسته‌بندی</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm">بارگذاری فایل PDF</label>
            {file ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2 text-teal-800">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate text-sm font-medium">{file.name}</span>
                  <span className="shrink-0 text-xs text-teal-600">
                    ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  disabled={isSubmitting}
                  className="shrink-0 rounded-lg p-1 text-teal-700 hover:bg-teal-100 disabled:opacity-50"
                  aria-label="حذف فایل"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-6 text-center text-sm text-slate-500 transition-colors hover:border-teal-400 hover:text-teal-700">
                <Upload className="h-6 w-6" />
                <span>برای بارگذاری فایل PDF کلیک کنید</span>
                <span className="text-xs text-slate-400">حداکثر {MAX_PDF_MB} مگابایت</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-sm">
                متن راهنمای بالینی {file ? "(در صورت وجود فایل PDF نادیده گرفته می‌شود)" : ""}
              </label>
              <span className="text-xs text-slate-500">
                {content.length.toLocaleString("fa-IR")} کاراکتر
              </span>
            </div>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={isSubmitting || Boolean(file)}
              placeholder="Paste AAP guideline here..."
              rows={14}
            />
          </div>
          <div className="md:col-span-2 space-y-3">
            {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
            {successMessage ? (
              <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
                {successMessage}
              </p>
            ) : null}
            {isSubmitting ? (
              <AiProcessingIndicator messages={INGEST_MESSAGES} />
            ) : null}
            <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال پردازش سند و تولید بردارهای RAG...
                </span>
              ) : (
                "ذخیره و ایمبد"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">اسناد موجود در پایگاه دانش</h2>
          <p className="text-sm text-slate-600">
            {documents.length > 0
              ? `${documents.length.toLocaleString("fa-IR")} سند ایندکس‌شده`
              : "هنوز سندی وارد نشده است"}
          </p>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-slate-500">
              با افزودن اولین راهنما، جستجوی معنایی برای تولید کیس فعال می‌شود.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {documents.map((doc) => (
                <li
                  key={`${doc.title}::${doc.source}`}
                  className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{doc.title}</p>
                    <p className="truncate text-sm text-slate-500">{doc.source}</p>
                  </div>
                  <div className="shrink-0 text-end text-xs text-slate-500">
                    <p>{doc.chunkCount.toLocaleString("fa-IR")} بخش</p>
                    {doc.lastIngestedAt ? (
                      <p>{new Date(doc.lastIngestedAt).toLocaleDateString("fa-IR")}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
