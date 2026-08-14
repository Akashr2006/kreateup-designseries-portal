/**
 * Code 39 barcode, rendered as inline SVG.
 *
 * This is a real, standards-compliant symbology — not decorative artwork — so
 * the security desk can scan a printed or on-screen gate pass with any ordinary
 * 1D scanner. Code 39 was chosen because its alphabet (0-9, A-Z, `-`, `.`,
 * space, `$`, `/`, `+`, `%`) covers the pass-code format exactly and it needs
 * no checksum to be readable.
 *
 * Each character is nine elements wide, alternating bar/space, of which exactly
 * three are wide — hence the name. `*` is the start and stop delimiter.
 */

const PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn",
  "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw",
  "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw",
  E: "wnnnwwnnn", F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn",
  I: "nnwnnwwnn", J: "nnnnwwwnn", K: "wnnnnnnww", L: "nnwnnnnww",
  M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn", P: "nnwnwnnwn",
  Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw",
  Y: "wwnnwnnnn", Z: "nwwnwnnnn",
  "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnnwn",
  $: "nwnwnwnnn", "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

const NARROW = 2;
const WIDE = 5;
const GAP = NARROW; // inter-character space

export function Barcode({
  value,
  height = 56,
  showText = true,
  className,
}: {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
}) {
  const text = value.toUpperCase();
  const encodable = [...text].every((char) => PATTERNS[char] !== undefined);

  // Fall back to plain monospace text rather than emitting an unscannable
  // symbol that looks legitimate.
  if (!encodable) {
    return (
      <p className={`font-mono text-[15px] font-bold tracking-[0.18em] ${className ?? ""}`}>{text}</p>
    );
  }

  const chars = ["*", ...text, "*"];
  const bars: Array<{ x: number; width: number }> = [];
  let x = 0;

  for (const char of chars) {
    const pattern = PATTERNS[char];
    for (let i = 0; i < pattern.length; i += 1) {
      const width = pattern[i] === "w" ? WIDE : NARROW;
      // Even indices are bars, odd indices are spaces.
      if (i % 2 === 0) bars.push({ x, width });
      x += width;
    }
    x += GAP;
  }

  const total = x - GAP;

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${total} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Barcode for pass ${text}`}
        style={{ display: "block" }}
      >
        <rect width={total} height={height} fill="#ffffff" />
        {bars.map((bar, index) => (
          <rect key={index} x={bar.x} y={0} width={bar.width} height={height} fill="#000000" />
        ))}
      </svg>
      {showText ? (
        <figcaption
          className="mt-1.5 text-center font-mono text-[12px] font-bold tracking-[0.24em]"
          style={{ color: "var(--text-strong)" }}
        >
          {text}
        </figcaption>
      ) : null}
    </figure>
  );
}
