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
  // Le point etait `brand-gold` (#D4A574), vestige de l'ancienne charte or :
  // 2,23:1 sur blanc, en dessous meme du seuil de 3:1 des elements non
  // textuels. Le rose de la palette actuelle porte l'identite de la marque,
  // et c'est deja celui qu'utilisent les pages de connexion.
  const dotClass = tone === "light" ? "text-rose" : "text-rose-fonce";

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
