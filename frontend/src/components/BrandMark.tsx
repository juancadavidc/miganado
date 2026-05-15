type Props = { size?: number };

export function BrandMark({ size = 24 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 9c-1 0-2 1-2 2.5S4 14 5 14" />
      <path d="M19 9c1 0 2 1 2 2.5s-1 2.5-2 2.5" />
      <path d="M7 7c0-1 2-3 5-3s5 2 5 3" />
      <path d="M6 12c0-3 2.5-5 6-5s6 2 6 5v3c0 2-2 4-4 4h-4c-2 0-4-2-4-4z" />
      <circle cx="10" cy="13" r="0.8" fill="currentColor" />
      <circle cx="14" cy="13" r="0.8" fill="currentColor" />
      <path d="M11 16h2" />
    </svg>
  );
}
