import { accentFor, cn, initials } from "@/lib/utils";

/**
 * Identity chip. Deliberately typographic — initials on one of the four brand
 * tints — so no profile photography or generated portrait is ever needed.
 */
export function Avatar({
  name,
  seed,
  size = 36,
  className,
  ring = false,
}: {
  name: string;
  /** Anything stable per user (id, email). Falls back to the name. */
  seed?: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const tone = accentFor(seed || name);

  return (
    <span
      data-accent={tone}
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full font-bold", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: "var(--tone-soft)",
        color: "var(--tone)",
        boxShadow: ring
          ? "0 0 0 2px var(--surface-raised), 0 0 0 3.5px var(--tone)"
          : "inset 0 0 0 1px color-mix(in srgb, var(--tone) 26%, transparent)",
        letterSpacing: "-0.02em",
      }}
    >
      {initials(name)}
    </span>
  );
}

/** Avatar + name + secondary line, the standard person cell in tables and lists. */
export function PersonCell({
  name,
  meta,
  seed,
  size = 34,
  className,
}: {
  name: string;
  meta?: string;
  seed?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar name={name} seed={seed} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
          {name}
        </span>
        {meta ? (
          <span className="block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
            {meta}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** Overlapping avatar stack for "who is in this cohort" summaries. */
export function AvatarStack({
  people,
  max = 5,
  size = 28,
}: {
  people: Array<{ id: string; name: string }>;
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <span className="flex items-center">
      {shown.map((person, index) => (
        // The outer wrapper carries the ring so it matches the surface behind
        // the stack without the Avatar needing to know about stacking.
        <span
          key={person.id}
          className="rounded-full"
          style={{
            marginLeft: index === 0 ? 0 : -size * 0.32,
            zIndex: max - index,
            boxShadow: "0 0 0 2px var(--surface-raised)",
          }}
        >
          <Avatar name={person.name} seed={person.id} size={size} />
        </span>
      ))}
      {rest > 0 ? (
        <span
          className="grid place-items-center rounded-full text-[10.5px] font-bold"
          style={{
            width: size,
            height: size,
            marginLeft: -size * 0.32,
            background: "var(--surface-inset)",
            color: "var(--text-muted)",
            boxShadow: "0 0 0 2px var(--surface-raised)",
          }}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
