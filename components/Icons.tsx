import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export function DumbbellIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="m3 9 3-3" />
      <path d="m18 21 3-3" />
      <rect x="1.5" y="8.5" width="4" height="7" rx="1" transform="rotate(45 3.5 12)" />
      <rect x="18.5" y="8.5" width="4" height="7" rx="1" transform="rotate(45 20.5 12)" />
    </svg>
  );
}

export function TrainerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
      <path d="M9 11.5 6 14M15 11.5 18 14" />
    </svg>
  );
}

export function PilatesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="16" cy="5" r="2" />
      <path d="M16 8c-2 1-5 2-8 1" />
      <path d="M8 9c2.5 2 4 4 4 6l1 5" />
      <path d="M12 15c1.5-1.5 4-2.5 6-2" />
      <path d="m11 20-4-1" />
    </svg>
  );
}

export function StudioIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M3 21h18" />
      <path d="M8 21v-6h8v6" />
      <path d="M9 11h.01M15 11h.01" />
    </svg>
  );
}

export function StarIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base({ ...props, strokeWidth: 1.4 })} fill={filled ? "currentColor" : "none"}>
      <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.4 6.1 21.5l1.2-6.5-4.8-4.6 6.6-.9z" />
    </svg>
  );
}

export function BadgeCheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.85 8.62a4 4 0 0 1 2.77-2.77l1.2-.34a4 4 0 0 0 1.9-1.1l.86-.88a4 4 0 0 1 5.74 0l.86.88a4 4 0 0 0 1.9 1.1l1.2.34a4 4 0 0 1 2.77 2.77l.34 1.2a4 4 0 0 0 1.1 1.9l.02.02" />
      <path d="m9 12 2 2 4-4" />
      <circle cx="12" cy="12" r="9.5" opacity="0" />
    </svg>
  );
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="13" cy="18" r="2" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function ScaleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v18M7 21h10" />
      <path d="M5 7h14l-2.5-3h-9z" opacity="0" />
      <path d="M6 7h12" />
      <path d="m6 7-3 6a3 3 0 0 0 6 0z" />
      <path d="m18 7-3 6a3 3 0 0 0 6 0z" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6.3 6.3 1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

const ICONS = {
  dumbbell: DumbbellIcon,
  trainer: TrainerIcon,
  pilates: PilatesIcon,
  studio: StudioIcon,
};

export function CategoryIcon({
  name,
  ...props
}: { name: "dumbbell" | "trainer" | "pilates" | "studio" } & IconProps) {
  const Cmp = ICONS[name];
  return <Cmp {...props} />;
}
