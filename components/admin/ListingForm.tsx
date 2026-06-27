"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Link from "next/link";
import { CATEGORIES, DISTRICTS, ALL_SPECIALTIES } from "@/lib/data";
import type { Certification, Listing, ListingType, Photo } from "@/lib/types";
import { FacilityImage } from "@/components/FacilityImage";
import { CheckIcon, XIcon } from "@/components/Icons";

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

const blankCert: Certification = { name: "", issuer: "", year: 2024, verified: false };
const blankPhoto: Photo = { label: "", tone: 0 };

export function ListingForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: Listing;
}) {
  const router = useRouter();
  const iconFor = (t: ListingType) => CATEGORIES.find((c) => c.type === t)!.icon;

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ListingType>(initial?.type ?? "pt");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [district, setDistrict] = useState(initial?.district ?? DISTRICTS[0]);
  const [neighborhood, setNeighborhood] = useState(initial?.neighborhood ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [priceValue, setPriceValue] = useState(String(initial?.priceValue ?? ""));
  const [priceUnit, setPriceUnit] = useState<"session" | "month">(initial?.priceUnit ?? "session");
  const [priceLabel, setPriceLabel] = useState(initial?.priceLabel ?? "");
  const [rating, setRating] = useState(String(initial?.rating ?? ""));
  const [reviewCount, setReviewCount] = useState(String(initial?.reviewCount ?? ""));
  const [experienceYears, setExperienceYears] = useState(String(initial?.experienceYears ?? ""));
  const [gender, setGender] = useState<"" | "남" | "여">(initial?.gender ?? "");
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [specialties, setSpecialties] = useState<string[]>(initial?.specialties ?? []);
  const [amenities, setAmenities] = useState<string[]>(initial?.amenities ?? []);
  const [certs, setCerts] = useState<Certification[]>(initial?.certifications ?? []);
  const [photos, setPhotos] = useState<Photo[]>(initial?.photos ?? []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      type,
      tagline,
      district,
      neighborhood,
      address,
      priceValue: Number(priceValue) || 0,
      priceUnit,
      priceLabel: priceLabel || (priceUnit === "month" ? "월 가격 미정" : "회당 가격 미정"),
      rating: Number(rating) || 0,
      reviewCount: Number(reviewCount) || 0,
      experienceYears: Number(experienceYears) || 0,
      gender: gender || undefined,
      featured,
      description,
      specialties,
      amenities,
      certifications: certs
        .filter((c) => c.name.trim())
        .map((c) => ({ ...c, year: Number(c.year) || new Date().getFullYear() })),
      photos: photos.filter((p) => p.label.trim() || p.url),
    };

    try {
      const res = await fetch(
        mode === "create" ? "/api/admin/listings" : `/api/admin/listings/${initial!.id}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "저장에 실패했습니다.");
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* 기본 정보 */}
      <Card title="기본 정보">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="이름" required>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김도현 트레이너 / 코어밸런스 필라테스" />
          </Field>
          <Field label="카테고리" required>
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as ListingType)}>
              {CATEGORIES.map((c) => (
                <option key={c.type} value={c.type}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="한 줄 소개" className="sm:col-span-2">
            <input className={inputCls} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="예: 바디프로필·체중감량 1:1 PT 전문" />
          </Field>
          <Field label="자치구">
            <select className={inputCls} value={district} onChange={(e) => setDistrict(e.target.value)}>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="동 / 지역">
            <input className={inputCls} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="예: 신사동" />
          </Field>
          <Field label="주소" className="sm:col-span-2">
            <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="예: 서울 강남구 도산대로 ..." />
          </Field>
        </div>
      </Card>

      {/* 가격 · 지표 */}
      <Card title="가격 및 지표">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="가격(숫자, 만원)">
            <input type="number" className={inputCls} value={priceValue} onChange={(e) => setPriceValue(e.target.value)} placeholder="예: 8" />
          </Field>
          <Field label="가격 단위">
            <select className={inputCls} value={priceUnit} onChange={(e) => setPriceUnit(e.target.value as "session" | "month")}>
              <option value="session">회당</option>
              <option value="month">월 정기</option>
            </select>
          </Field>
          <Field label="가격 표기 문구">
            <input className={inputCls} value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} placeholder="예: 회당 8만원 / 월 12만원~" />
          </Field>
          <Field label="평점 (0~5)">
            <input type="number" step="0.1" min="0" max="5" className={inputCls} value={rating} onChange={(e) => setRating(e.target.value)} placeholder="예: 4.8" />
          </Field>
          <Field label="후기 수">
            <input type="number" className={inputCls} value={reviewCount} onChange={(e) => setReviewCount(e.target.value)} placeholder="예: 142" />
          </Field>
          <Field label="경력(년)">
            <input type="number" className={inputCls} value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} placeholder="예: 8" />
          </Field>
          <Field label="트레이너 성별(개인만)">
            <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value as "" | "남" | "여")}>
              <option value="">해당 없음</option>
              <option value="여">여성</option>
              <option value="남">남성</option>
            </select>
          </Field>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-soft">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              홈 ‘추천’에 노출
            </label>
          </div>
        </div>
      </Card>

      {/* 소개 */}
      <Card title="상세 소개">
        <textarea className={`${inputCls} min-h-[120px]`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="전문가/센터에 대한 자세한 소개를 작성하세요." />
      </Card>

      {/* 전문분야 / 편의 */}
      <Card title="전문 분야 · 편의시설">
        <div className="space-y-5">
          <Field label="전문 분야">
            <TagInput value={specialties} onChange={setSpecialties} suggestions={ALL_SPECIALTIES} placeholder="입력 후 Enter (예: 체형교정)" />
          </Field>
          <Field label="시설 · 편의사항">
            <TagInput value={amenities} onChange={setAmenities} placeholder="입력 후 Enter (예: 샤워실, 주차 가능)" />
          </Field>
        </div>
      </Card>

      {/* 자격증 */}
      <Card title="자격증 및 인증" action={<AddBtn onClick={() => setCerts((c) => [...c, { ...blankCert }])} label="자격증 추가" />}>
        {certs.length === 0 && <Empty>등록된 자격증이 없습니다. ‘자격증 추가’로 입력하세요.</Empty>}
        <div className="space-y-3">
          {certs.map((c, i) => (
            <div key={i} className="grid items-end gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_90px_auto_auto]">
              <Field label="자격명"><input className={inputCls} value={c.name} onChange={(e) => updateAt(setCerts, i, { name: e.target.value })} placeholder="예: NSCA-CPT" /></Field>
              <Field label="발급기관"><input className={inputCls} value={c.issuer} onChange={(e) => updateAt(setCerts, i, { issuer: e.target.value })} placeholder="예: NSCA" /></Field>
              <Field label="취득연도"><input type="number" className={inputCls} value={c.year} onChange={(e) => updateAt(setCerts, i, { year: Number(e.target.value) })} /></Field>
              <label className="flex h-[42px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium text-ink-soft">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" checked={c.verified} onChange={(e) => updateAt(setCerts, i, { verified: e.target.checked })} />
                인증
              </label>
              <button type="button" onClick={() => removeAt(setCerts, i)} className="grid h-[42px] w-10 place-items-center rounded-xl border border-slate-200 text-ink-muted hover:border-red-300 hover:text-red-600" aria-label="삭제">
                <XIcon width={16} height={16} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* 사진 */}
      <Card title="시설 사진" action={<AddBtn onClick={() => setPhotos((p) => [...p, { ...blankPhoto, tone: p.length }])} label="사진 추가" />}>
        {photos.length === 0 && <Empty>사진을 추가하면 사진을 올리거나, 올리지 않으면 색상 플레이스홀더가 표시됩니다.</Empty>}
        <div className="grid gap-3 sm:grid-cols-2">
          {photos.map((p, i) => (
            <PhotoRow
              key={i}
              photo={p}
              icon={iconFor(type)}
              onChange={(patch) => updateAt(setPhotos, i, patch)}
              onRemove={() => removeAt(setPhotos, i)}
            />
          ))}
        </div>
      </Card>

      {/* 액션 */}
      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/90 py-4 backdrop-blur">
        <Link href="/admin" className="btn-outline">취소</Link>
        <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
          {submitting ? "저장 중…" : mode === "create" ? "등록하기" : "수정 저장"}
        </button>
      </div>
    </form>
  );
}

/* ---------- 보조 컴포넌트 ---------- */

function updateAt<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number, patch: Partial<T>) {
  setter((arr) => arr.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
}
function removeAt<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number) {
  setter((arr) => arr.filter((_, idx) => idx !== i));
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, required, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="btn-outline px-3 py-1.5 text-xs">
      + {label}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-ink-muted">{children}</p>;
}

function TagInput({
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = raw.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  const remaining = (suggestions ?? []).filter((s) => !value.includes(s));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="grid h-4 w-4 place-items-center rounded-full hover:bg-brand-100" aria-label={`${t} 제거`}>
              <XIcon width={11} height={11} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={placeholder}
          className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-ink-muted hover:border-brand-300 hover:text-brand-700">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoRow({
  photo,
  icon,
  onChange,
  onRemove,
}: {
  photo: Photo;
  icon: "dumbbell" | "trainer" | "pilates" | "studio";
  onChange: (patch: Partial<Photo>) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function upload(file: File) {
    setErr("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "업로드 실패");
      onChange({ url: data.url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 p-3">
      <FacilityImage tone={photo.tone} url={photo.url} icon={icon} showLabel={false} className="h-20 w-24 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <input className={inputCls} value={photo.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="캡션 (예: 리포머 룸)" />
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-outline px-3 py-1.5 text-xs disabled:opacity-60">
            {uploading ? "업로드 중…" : photo.url ? "사진 변경" : "사진 업로드"}
          </button>
          {photo.url ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
              <CheckIcon width={13} height={13} /> 업로드됨
            </span>
          ) : (
            <label className="flex items-center gap-1 text-xs text-ink-muted">
              색상
              <input type="number" min={0} max={9} value={photo.tone} onChange={(e) => onChange({ tone: Number(e.target.value) })} className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
            </label>
          )}
          <button type="button" onClick={onRemove} className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label="사진 삭제">
            <XIcon width={15} height={15} />
          </button>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    </div>
  );
}
