"use client";

import { useEffect, useState } from "react";
import type { Listing } from "@/lib/types";

/** 주어진 id 목록에 해당하는 리스팅을 API에서 가져옵니다(순서 보존). */
export function useListingsByIds(ids: string[]) {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const key = ids.join(",");

  useEffect(() => {
    let alive = true;
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/listings?ids=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Listing[]) => {
        if (alive) setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { items, loading };
}
