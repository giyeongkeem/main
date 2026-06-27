/**
 * 데이터 접근 계층 (서버 전용).
 *
 * 저장 백엔드는 환경에 따라 자동 선택됩니다:
 *   - DATABASE_URL 설정됨  → PostgreSQL (Supabase 등) — 배포용
 *   - 설정 안 됨            → 로컬 JSON 파일 (data/listings.json) — 로컬 개발용(설정 불필요)
 *
 * 주의: fs/pg 를 사용하므로 클라이언트 컴포넌트에서 import 하지 마세요.
 */
import type { Listing, ListingType, Review } from "./types";
import { listings as seed } from "./data";
import * as jsonBackend from "./db-json";
import * as pgBackend from "./db-postgres";

const backend = process.env.DATABASE_URL ? pgBackend : jsonBackend;

/** 저장 백엔드 종류 (관리자 화면 표시용) */
export const STORAGE = process.env.DATABASE_URL ? "postgres" : "json";

function loadAll(): Promise<Listing[]> {
  return backend.getAll(seed);
}
function saveAll(items: Listing[]): Promise<void> {
  return backend.saveAll(items);
}

function isPublished(l: Listing): boolean {
  return (l.status ?? "published") === "published";
}

async function loadPublished(): Promise<Listing[]> {
  return (await loadAll()).filter(isPublished);
}

/* ---------- 조회 (공개) ---------- */

export async function getPublished(): Promise<Listing[]> {
  return loadPublished();
}

export async function getByType(type: ListingType): Promise<Listing[]> {
  return (await loadPublished()).filter((l) => l.type === type);
}

export async function getFeatured(limit = 8): Promise<Listing[]> {
  const all = await loadPublished();
  const featured = all.filter((l) => l.featured);
  const base = featured.length ? featured : all;
  return [...base].sort((a, b) => b.rating - a.rating).slice(0, limit);
}

export async function getRelated(listing: Listing, limit = 3): Promise<Listing[]> {
  return (await loadPublished())
    .filter((l) => l.id !== listing.id && l.type === listing.type)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}

export async function siteStats() {
  const all = await loadPublished();
  const total = all.length;
  const verified = all.filter((l) => l.certifications?.some((c) => c.verified)).length;
  const avgRating = total ? all.reduce((s, l) => s + (l.rating || 0), 0) / total : 0;
  const reviews = all.reduce((s, l) => s + (l.reviewCount || 0), 0);
  return { total, verified, avgRating: Math.round(avgRating * 10) / 10, reviews };
}

/* ---------- 조회 (전체/관리자) ---------- */

export async function getAll(): Promise<Listing[]> {
  return loadAll();
}

export async function getById(id: string): Promise<Listing | undefined> {
  return (await loadAll()).find((l) => l.id === id);
}

export async function pendingCount(): Promise<number> {
  return (await loadAll()).filter((l) => !isPublished(l)).length;
}

/* ---------- 변경 ---------- */

function slugify(name: string): string {
  const ascii = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return ascii || "listing";
}
function randomId(): string {
  return Math.random().toString(36).slice(2, 7);
}

function normalize(input: Partial<Listing>, prev?: Listing): Listing {
  const base: Listing = prev ?? ({} as Listing);
  return {
    id: base.id,
    name: input.name ?? base.name ?? "이름 없음",
    type: (input.type as ListingType) ?? base.type ?? "pt",
    tagline: input.tagline ?? base.tagline ?? "",
    district: input.district ?? base.district ?? "강남구",
    neighborhood: input.neighborhood ?? base.neighborhood ?? "",
    address: input.address ?? base.address ?? "",
    priceValue: input.priceValue !== undefined ? Number(input.priceValue) : base.priceValue ?? 0,
    priceUnit: (input.priceUnit ?? base.priceUnit) === "month" ? "month" : "session",
    priceLabel: input.priceLabel ?? base.priceLabel ?? "",
    rating: input.rating !== undefined ? Number(input.rating) : base.rating ?? 0,
    reviewCount: input.reviewCount !== undefined ? Number(input.reviewCount) : base.reviewCount ?? 0,
    experienceYears:
      input.experienceYears !== undefined ? Number(input.experienceYears) : base.experienceYears ?? 0,
    gender: input.gender ?? base.gender,
    certifications: input.certifications ?? base.certifications ?? [],
    specialties: input.specialties ?? base.specialties ?? [],
    amenities: input.amenities ?? base.amenities ?? [],
    photos: input.photos ?? base.photos ?? [],
    description: input.description ?? base.description ?? "",
    reviews: input.reviews ?? base.reviews ?? [],
    featured: input.featured ?? base.featured ?? false,
    status: input.status ?? base.status ?? "published",
    submitterContact: input.submitterContact ?? base.submitterContact,
  };
}

export async function createListing(input: Partial<Listing>): Promise<Listing> {
  const all = await loadAll();
  let id = (input.id && input.id.trim()) || `${slugify(input.name || "listing")}-${randomId()}`;
  while (all.some((l) => l.id === id)) id = `${slugify(input.name || "listing")}-${randomId()}`;
  const listing = normalize(input);
  listing.id = id;
  all.push(listing);
  await saveAll(all);
  return listing;
}

export async function updateListing(id: string, input: Partial<Listing>): Promise<Listing | null> {
  const all = await loadAll();
  const idx = all.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  const updated = normalize(input, all[idx]);
  updated.id = all[idx].id;
  all[idx] = updated;
  await saveAll(all);
  return updated;
}

export async function deleteListing(id: string): Promise<boolean> {
  const all = await loadAll();
  const next = all.filter((l) => l.id !== id);
  if (next.length === all.length) return false;
  await saveAll(next);
  return true;
}

export async function setStatus(
  id: string,
  status: "published" | "pending"
): Promise<Listing | null> {
  return updateListing(id, { status });
}

/* ---------- 후기 ---------- */

function recalc(reviews: Review[]) {
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count : 0;
  return { count, avg: Math.round(avg * 10) / 10 };
}

export async function addReview(
  id: string,
  input: { author: string; rating: number; text: string }
): Promise<Listing | null> {
  const all = await loadAll();
  const listing = all.find((l) => l.id === id);
  if (!listing) return null;
  const review: Review = {
    id: `rv-${Date.now().toString(36)}-${randomId()}`,
    author: input.author?.trim() || "익명",
    rating: Math.min(5, Math.max(1, Math.round(Number(input.rating) || 5))),
    text: input.text?.trim() || "",
    date: new Date().toISOString().slice(0, 7),
  };
  listing.reviews = [review, ...(listing.reviews ?? [])];
  const { count, avg } = recalc(listing.reviews);
  listing.reviewCount = count;
  listing.rating = avg;
  await saveAll(all);
  return listing;
}

export async function deleteReview(id: string, reviewId: string): Promise<Listing | null> {
  const all = await loadAll();
  const listing = all.find((l) => l.id === id);
  if (!listing) return null;
  listing.reviews = (listing.reviews ?? []).filter((r) => r.id !== reviewId);
  const { count, avg } = recalc(listing.reviews);
  listing.reviewCount = count;
  listing.rating = avg;
  await saveAll(all);
  return listing;
}
