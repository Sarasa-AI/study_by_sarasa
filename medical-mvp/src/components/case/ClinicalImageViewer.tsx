"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { Expand, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { cn } from "@/lib/utils";

type ClinicalImageViewerProps = {
  src: string;
  alt?: string;
  className?: string;
  /** Compact preview height class; default h-56 */
  previewClassName?: string;
};

function isLocalUpload(src: string) {
  return src.startsWith("/");
}

const ZOOMED_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;

export function ClinicalImageViewer({
  src,
  alt = "تصویر بالینی",
  className,
  previewClassName = "h-56",
}: ClinicalImageViewerProps) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const unoptimized = isLocalUpload(src) || src.startsWith("data:");

  const closeZoom = useCallback(() => {
    setZoomOpen(false);
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  useBodyScrollLock(zoomOpen);
  useEscapeKey(closeZoom, zoomOpen);

  function openZoom() {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setZoomOpen(true);
  }

  function toggleZoomScale() {
    if (scale > 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else {
      setScale(ZOOMED_SCALE);
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    movedRef.current = false;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    if (scale > 1) {
      draggingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const dx = event.clientX - lastPointerRef.current.x;
    const dy = event.clientY - lastPointerRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      movedRef.current = true;
    }
    if (!draggingRef.current || scale <= 1) return;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const wasDragging = draggingRef.current;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // Double-tap / double-click zoom toggle (ignore if user was panning)
    if (wasDragging && movedRef.current) return;

    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      toggleZoomScale();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }

  return (
    <>
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-600">
            تصویر بالینی (EKG / تصویربرداری / یافته پوستی)
          </p>
          <Button
            type="button"
            variant="secondary"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={openZoom}
          >
            <Expand className="h-3.5 w-3.5" />
            بزرگ‌نمایی
          </Button>
        </div>
        <button
          type="button"
          onClick={openZoom}
          className={cn(
            "relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
            previewClassName,
          )}
          aria-label="بزرگ‌نمایی تصویر بالینی"
        >
          <Image
            src={src}
            alt={alt}
            fill
            unoptimized={unoptimized}
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 720px"
          />
        </button>
      </div>

      {zoomOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="نمایش بزرگ تصویر بالینی"
          onClick={closeZoom}
        >
          <div
            className="relative h-[min(85vh,900px)] w-full max-w-5xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="relative h-full w-full touch-none select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onDoubleClick={(event) => {
                event.preventDefault();
                toggleZoomScale();
              }}
            >
              <div
                className="relative h-full w-full transition-transform duration-150 ease-out will-change-transform"
                style={{
                  transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                  cursor: scale > 1 ? "grab" : "zoom-in",
                }}
              >
                <Image
                  src={src}
                  alt={alt}
                  fill
                  unoptimized={unoptimized}
                  className="pointer-events-none object-contain"
                  sizes="100vw"
                  draggable={false}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="absolute start-2 top-2 z-10 h-10 min-w-10 gap-1.5 px-3"
              onClick={closeZoom}
              aria-label="بستن"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">بستن</span>
            </Button>
            <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/90 sm:text-xs">
              دوبار ضربه برای بزرگ‌نمایی · کشیدن برای جابه‌جایی
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
