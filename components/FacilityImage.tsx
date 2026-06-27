import { CategoryIcon } from "./Icons";

/**
 * 시설 이미지. 업로드된 실제 사진(url)이 있으면 사진을 보여주고,
 * 없으면 네트워크 의존 없는 자체 생성 플레이스홀더(그라데이션)를 렌더합니다.
 */

const GRADIENTS: [string, string][] = [
  ["#0f766e", "#10b981"], // teal -> emerald
  ["#1e293b", "#334155"], // slate
  ["#b45309", "#f59e0b"], // amber
  ["#475569", "#94a3b8"], // cool gray
  ["#9d174d", "#ec4899"], // rose
  ["#0369a1", "#06b6d4"], // sky -> cyan
  ["#5b21b6", "#8b5cf6"], // violet
  ["#0d9488", "#5eead4"], // teal light
  ["#047857", "#84cc16"], // emerald -> lime
  ["#1d4ed8", "#22d3ee"], // blue -> cyan
];

type IconName = "dumbbell" | "trainer" | "pilates" | "studio";

export function FacilityImage({
  tone,
  label,
  icon,
  url,
  className = "",
  showLabel = true,
}: {
  tone: number;
  label?: string;
  icon: IconName;
  url?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const [from, to] = GRADIENTS[((tone % GRADIENTS.length) + GRADIENTS.length) % GRADIENTS.length];
  return (
    <div
      className={`relative isolate overflow-hidden ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
      aria-label={label ? `${label} 이미지` : "시설 이미지"}
      role="img"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label || "시설 사진"} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-6 h-44 w-44 rounded-full bg-black/10 blur-2xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)",
            }}
          />
          <CategoryIcon
            name={icon}
            className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 text-white/25"
            strokeWidth={1.1}
          />
        </>
      )}
      {showLabel && label && (
        <span className="absolute bottom-2.5 left-2.5 rounded-md bg-black/40 px-2 py-1 text-xs font-medium text-white/95 backdrop-blur-sm">
          {label}
        </span>
      )}
    </div>
  );
}
