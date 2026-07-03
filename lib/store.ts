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

/** 공개 응답용 — 관리자 전용 필드(신청자 연락처)를 제거합니다. */
export function toPublic(listing: Listing): Omit<Listing, "submitterContact"> {
  const { submitterContact: _private, ...pub } = listing;
  return pub;
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

/* ---------- 후기 ----------
 * 평점/후기 수는 증분 방식으로 갱신합니다.
 * (시드 데이터의 집계치(예: 후기 218개)는 보존하면서 새 후기만 가중 반영 —
 *  후기 배열 길이로 재계산하면 시드 집계가 파괴됩니다)
 */

const clampRating = (v: number) => Math.min(5, Math.max(0, Math.round(v * 10) / 10));

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
  const prevCount = Math.max(listing.reviewCount ?? 0, 0);
  const prevAvg = listing.rating ?? 0;
  const newCount = prevCount + 1;
  listing.rating = clampRating((prevAvg * prevCount + review.rating) / newCount);
  listing.reviewCount = newCount;
  await saveAll(all);
  return listing;
}

export async function deleteReview(id: string, reviewId: string): Promise<Listing | null> {
  const all = await loadAll();
  const listing = all.find((l) => l.id === id);
  if (!listing) return null;
  const target = (listing.reviews ?? []).find((r) => r.id === reviewId);
  if (!target) return listing;
  listing.reviews = (listing.reviews ?? []).filter((r) => r.id !== reviewId);
  const prevCount = Math.max(listing.reviewCount ?? 0, 1);
  const prevAvg = listing.rating ?? 0;
  const newCount = prevCount - 1;
  listing.rating =
    newCount === 0 ? 0 : clampRating((prevAvg * prevCount - target.rating) / newCount);
  listing.reviewCount = newCount;
  await saveAll(all);
  return listing;
}
