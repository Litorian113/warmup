// OpenMoji (openmoji.org, CC BY-SA 4.0), self-hosted in public/emoji/ as <code point>.svg.

export default function Emoji({ code, size = 28, label, className }: { code: string; size?: number; label?: string; className?: string }) {
  return (
    <img
      src={`/emoji/${code}.svg`}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      className={`emoji${className ? ` ${className}` : ""}`}
      draggable={false}
    />
  );
}
