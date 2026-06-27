"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORIES, DISTRICTS, ALL_SPECIALTIES } from "@/lib/data";
import type { ListingType } from "@/lib/types";
import { ArrowRightIcon, CheckIcon, ShieldCheckIcon } from "@/components/Icons";

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [type, setType] = useState<ListingType>("pt");
  const [district, setDistrict] = useState(DISTRICTS[0]);
  const [neighborhood, setNeighborhood] = useState("");
  const [tagline, setTagline] = useState("");
  const [priceLabel, setPriceLabel] = useState("");
  const [description, setDescription] = useState("");
  const [submitterContact, setContact] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function toggleSpec(s: string) {
    setSpecialties((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/listings/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          district,
          neighborhood,
          tagline,
          priceLabel,
          description,
          submitterContact,
          specialties,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "신청에 실패했습니다.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "신청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="container-page py-20">
        <div className="card mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600">
            <CheckIcon width={32} height={32} />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold text-ink">등록 신청이 접수되었어요</h1>
          <p className="mt-2 text-ink-muted">
            관리자 검수(자격증·정보 확인) 후 사이트에 공개됩니다. 보통 1~2일 소요됩니다.
          </p>
          <Link href="/" className="btn-primary mt-6">홈으로 <ArrowRightIcon width={18} height={18} /></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page max-w-2xl py-10">
      <div className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
          <ShieldCheckIcon width={14} height={14} /> 전문가·센터 입점 신청
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          내 센터·프로필 등록하기
        </h1>
        <p className="mt-2 text-ink-muted">
          정보를 남겨주시면 관리자 검수 후 핏매치에 노출됩니다. 자세한 사진·자격증은 승인 후 추가됩니다.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-5 p-6">
        <Field label="이름 (전문가명 / 센터명)" required>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 홍길동 트레이너 / OO 필라테스" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="카테고리" required>
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as ListingType)}>
              {CATEGORIES.map((c) => (<option key={c.type} value={c.type}>{c.label}</option>))}
            </select>
          </Field>
          <Field label="자치구">
            <select className={inputCls} value={district} onChange={(e) => setDistrict(e.target.value)}>
              {DISTRICTS.map((d) => (<option key={d} value={d}>{d}</option>))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="동 / 지역">
            <input className={inputCls} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="예: 역삼동" />
          </Field>
          <Field label="대표 가격(표기 문구)">
            <input className={inputCls} value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} placeholder="예: 회당 7만원 / 월 15만원~" />
          </Field>
        </div>
        <Field label="한 줄 소개">
          <input className={inputCls} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="예: 체형교정·재활 필라테스 전문" />
        </Field>
        <Field label="소개">
          <textarea className={`${inputCls} min-h-[100px]`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="센터/프로필 소개를 자유롭게 작성하세요." />
        </Field>
        <Field label="전문 분야">
          <div className="flex flex-wrap gap-2">
            {ALL_SPECIALTIES.map((s) => (
              <button type="button" key={s} onClick={() => toggleSpec(s)} className={`chip ${specialties.includes(s) ? "chip-active" : ""}`}>
                {s}
              </button>
            ))}
          </div>
        </Field>
        <Field label="연락처 (관리자 확인용, 비공개)">
          <input className={inputCls} value={submitterContact} onChange={(e) => setContact(e.target.value)} placeholder="이메일 또는 전화번호" />
        </Field>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <Link href="/" className="btn-outline">취소</Link>
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
            {busy ? "신청 중…" : "등록 신청하기"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
