"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderCardHTML } from "@/lib/cardTemplate";
import type { Card, Design, Meta } from "@/lib/types";

export type EditableField = "eyebrow" | "title" | "body" | "image";

interface Props {
  card: Card;
  design: Design;
  meta: Meta;
  index: number;
  total: number;
  /** if set, fixed display width; otherwise fills container width */
  width?: number;
  className?: string;
  /** click-to-edit mode: text in the preview becomes directly editable */
  interactive?: boolean;
  /** fired when text is edited inside the preview (on blur) */
  onEdit?: (field: EditableField, value: string) => void;
  /** fired when an element is clicked/focused inside the preview */
  onFocusField?: (field: EditableField) => void;
}

/**
 * Renders one card with the SAME html the server screenshots, inside a scaled
 * iframe. WYSIWYG: the preview is pixel-identical to the exported PNG.
 * With `interactive`, the iframe adds contenteditable + placeholders and
 * reports edits via postMessage (see EDIT_SCRIPT in lib/cardTemplate.ts).
 */
export default function CardPreview({
  card,
  design,
  meta,
  index,
  total,
  width,
  className,
  interactive,
  onEdit,
  onFocusField,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [avail, setAvail] = useState(width ?? 0);

  const html = useMemo(
    () => renderCardHTML({ card, design, meta, index, total, interactive }),
    [card, design, meta, index, total, interactive]
  );

  useEffect(() => {
    if (width) return;
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setAvail(entries[0].contentRect.width));
    ro.observe(el);
    setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, [width]);

  // bridge edit/focus messages from THIS iframe only
  useEffect(() => {
    if (!interactive) return;
    function onMessage(e: MessageEvent) {
      if (e.source !== frameRef.current?.contentWindow) return;
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "cardnews-edit" && typeof d.value === "string") onEdit?.(d.field, d.value);
      else if (d.type === "cardnews-focus") onFocusField?.(d.field);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [interactive, onEdit, onFocusField]);

  const displayW = width ?? avail;
  const scale = displayW ? displayW / design.size.w : 0;
  const displayH = design.size.h * scale;

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ width: width ?? "100%", height: displayH || undefined, overflow: "hidden", borderRadius: 14 }}
    >
      {scale > 0 && (
        <iframe
          ref={frameRef}
          title={`card-${index + 1}`}
          srcDoc={html}
          scrolling="no"
          style={{
            width: design.size.w,
            height: design.size.h,
            border: "none",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: interactive ? "auto" : "none",
            display: "block",
          }}
        />
      )}
    </div>
  );
}
