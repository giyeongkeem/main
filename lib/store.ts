/**
 * 데이터 접근 계층 (서버 전용).
 * 현재는 로컬 JSON 파일(data/listings.json)에 저장합니다.
 * 추후 이 파일만 Supabase/Prisma 등으로 교체하면 화면/관리자 코드는 그대로 동작합니다.
 *
 * 주의: fs를 사용하므로 클라이언트 컴포넌트에서 import 하지 마세요.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Listing, ListingType } from "./types";
import { listings as seedListings } from "./data";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "listings.json");

async function ensureSeeded(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(seedListings, null, 2), "utf8");
  }
}

async function saveAll(items: Listing[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function getAll(): Promise<Listing[]> {
  await ensureSeeded();
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as Listing[];
  } catch {
    return [];
  }
}

export async function getById(id: string): Promise<Listing | undefined> {
  return (await getAll()).find((l) => l.id === id);
}

export async function getByType(type: ListingType): Promise<Listing[]> {
  return (await getAll()).filter((l) => l.type === type);
}

export async function getFeatured(limit = 8): Promise<Listing[]> {
  const all = await getAll();
  const featured = all.filter((l) => l.featured);
  const base = featured.length ? featured : all;
  return [...base].sort((a, b) => b.rating - a.rating).slice(0, limit);
}

export async function getRelated(listing: Listing, limit = 3): Promise<Listing[]> {
  return (await getAll())
    .filter((l) => l.id !== listing.id && l.type === listing.type)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}

export async function siteStats() {
  const all = await getAll();
  const total = all.length;
  const verified = all.filter((l) => l.certifications?.some((c) => c.verified)).length;
  const avgRating = total ? all.reduce((s, l) => s + (l.rating || 0), 0) / total : 0;
  const reviews = all.reduce((s, l) => s + (l.reviewCount || 0), 0);
  return { total, verified, avgRating: Math.round(avgRating * 10) / 10, reviews };
}

function slugify(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
    priceValue:
      input.priceValue !== undefined ? Number(input.priceValue) : base.priceValue ?? 0,
    priceUnit: (input.priceUnit ?? base.priceUnit) === "month" ? "month" : "session",
    priceLabel: input.priceLabel ?? base.priceLabel ?? "",
    rating: input.rating !== undefined ? Number(input.rating) : base.rating ?? 0,
    reviewCount:
      input.reviewCount !== undefined ? Number(input.reviewCount) : base.reviewCount ?? 0,
    experienceYears:
      input.experienceYears !== undefined
        ? Number(input.experienceYears)
        : base.experienceYears ?? 0,
    gender: input.gender ?? base.gender,
    certifications: input.certifications ?? base.certifications ?? [],
    specialties: input.specialties ?? base.specialties ?? [],
    amenities: input.amenities ?? base.amenities ?? [],
    photos: input.photos ?? base.photos ?? [],
    description: input.description ?? base.description ?? "",
    reviews: input.reviews ?? base.reviews ?? [],
    featured: input.featured ?? base.featured ?? false,
  };
}

export async function createListing(input: Partial<Listing>): Promise<Listing> {
  const all = await getAll();
  let id = (input.id && input.id.trim()) || `${slugify(input.name || "listing")}-${randomId()}`;
  while (all.some((l) => l.id === id)) id = `${slugify(input.name || "listing")}-${randomId()}`;
  const listing = normalize(input);
  listing.id = id;
  all.push(listing);
  await saveAll(all);
  return listing;
}

export async function updateListing(
  id: string,
  input: Partial<Listing>
): Promise<Listing | null> {
  const all = await getAll();
  const idx = all.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  const updated = normalize(input, all[idx]);
  updated.id = all[idx].id;
  all[idx] = updated;
  await saveAll(all);
  return updated;
}

export async function deleteListing(id: string): Promise<boolean> {
  const all = await getAll();
  const next = all.filter((l) => l.id !== id);
  if (next.length === all.length) return false;
  await saveAll(next);
  return true;
}
