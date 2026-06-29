"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderCardHTML } from "@/lib/cardTemplate";
import type { Card, Design, Meta } from "@/lib/types";

interface Props {
  card: Card;
  design: Design;
  meta: Meta;
  index: number;
  total: number;
  /** if set, fixed display width; otherwise fills container width */
  width?: number;
  className?: string;
}

/**
 * Renders one card with the SAME html the server screenshots, inside a scaled
 * iframe. WYSIWYG: the preview is pixel-identical to the exported PNG.
 */
export default function CardPreview({ card, design, meta, index, total, width, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(width ?? 0);

  const html = useMemo(
    () => renderCardHTML({ card, design, meta, index, total }),
    [card, design, meta, index, total]
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
          title={`card-${index + 1}`}
          srcDoc={html}
          scrolling="no"
          style={{
            width: design.size.w,
            height: design.size.h,
            border: "none",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
            display: "block",
          }}
        />
      )}
    </div>
  );
}
