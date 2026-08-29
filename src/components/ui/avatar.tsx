export function Avatar({
  url,
  name,
  className = "size-12",
}: {
  url?: string | null;
  name: string;
  className?: string;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- supabase storage URL, unoptimized on purpose
    return <img src={url} alt="" className={`rounded-full object-cover ${className}`} />;
  }
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-surface-muted font-semibold text-primary uppercase ${className}`}
    >
      {name.charAt(0)}
    </span>
  );
}
