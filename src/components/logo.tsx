import Link from "next/link";

export function Logo({
  className = "",
  href = "/",
  tone = "ink",
}: {
  className?: string;
  href?: string | null;
  tone?: "ink" | "light";
}) {
  const colorClass = tone === "light" ? "text-white" : "text-brand-ink";
  const dotClass = "text-brand-gold";

  const inner = (
    <span className={`luxury-heading tracking-tight ${colorClass} ${className}`}>
      <span className="italic">salon</span>ista<span className={dotClass}>.</span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-block">
      {inner}
    </Link>
  );
}
