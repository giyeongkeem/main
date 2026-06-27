"use client";

import { useCompare } from "./CompareContext";
import { CheckIcon, ScaleIcon } from "./Icons";

export function CompareToggle({
  id,
  variant = "chip",
}: {
  id: string;
  variant?: "chip" | "button" | "icon";
}) {
  const { has, toggle, isFull } = useCompare();
  const active = has(id);
  const disabled = !active && isFull;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle(id);
  }

  if (variant === "icon") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={active ? "비교함에서 제거" : disabled ? "최대 3개까지 비교" : "비교함에 담기"}
        aria-pressed={active}
        className={`grid h-9 w-9 place-items-center rounded-full border backdrop-blur-sm transition ${
          active
            ? "border-brand-500 bg-brand-600 text-white"
            : "border-white/70 bg-white/85 text-ink-soft hover:border-brand-400 hover:text-brand-700 disabled:opacity-40"
        }`}
      >
        {active ? <CheckIcon width={18} height={18} /> : <ScaleIcon width={18} height={18} />}
      </button>
    );
  }

  if (variant === "button") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        aria-pressed={active}
        className={active ? "btn-primary w-full" : "btn-outline w-full disabled:opacity-50"}
      >
        {active ? <CheckIcon width={18} height={18} /> : <ScaleIcon width={18} height={18} />}
        {active ? "비교함에 담김" : disabled ? "비교함이 가득 찼어요" : "비교함에 담기"}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`chip ${active ? "chip-active" : ""} disabled:opacity-40`}
    >
      {active ? <CheckIcon width={15} height={15} /> : <ScaleIcon width={15} height={15} />}
      {active ? "비교중" : "비교"}
    </button>
  );
}
