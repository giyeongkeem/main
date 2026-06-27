import { StarIcon } from "./Icons";

export function RatingStars({
  value,
  size = 16,
  showValue = false,
  count,
  className = "",
}: {
  value: number;
  size?: number;
  showValue?: boolean;
  count?: number;
  className?: string;
}) {
  const rounded = Math.round(value);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="inline-flex text-amber-400">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon key={i} width={size} height={size} filled={i < rounded} />
        ))}
      </span>
      {showValue && (
        <span className="ml-0.5 text-sm font-semibold text-ink">
          {value.toFixed(1)}
        </span>
      )}
      {typeof count === "number" && (
        <span className="text-sm text-ink-muted">({count.toLocaleString()})</span>
      )}
    </span>
  );
}
