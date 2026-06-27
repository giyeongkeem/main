"use client";

import { useState } from "react";
import type { Photo } from "@/lib/types";
import { FacilityImage } from "./FacilityImage";

export function Gallery({
  photos,
  icon,
}: {
  photos: Photo[];
  icon: "dumbbell" | "trainer" | "pilates" | "studio";
}) {
  const [active, setActive] = useState(0);
  const current = photos[active] ?? photos[0];

  return (
    <div>
      <FacilityImage
        tone={current.tone}
        label={current.label}
        icon={icon}
        className="aspect-[16/10] w-full rounded-2xl"
      />
      {photos.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`overflow-hidden rounded-xl ring-2 transition ${
                i === active ? "ring-brand-500" : "ring-transparent hover:ring-brand-200"
              }`}
              aria-label={`${p.label} 보기`}
            >
              <FacilityImage
                tone={p.tone}
                icon={icon}
                showLabel={false}
                className="aspect-[4/3] w-full"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
