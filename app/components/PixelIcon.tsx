import type { CSSProperties } from "react";

type PixelIconProps = {
  name: string;
  label?: string;
  className?: string;
  size?: number;
};

export function PixelIcon({ name, label, className = "", size = 18 }: PixelIconProps) {
  return (
    <img
      className={`pixelIcon ${className}`.trim()}
      src={`/icons/pixel/${name}.svg`}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      style={{ "--icon-size": `${size}px` } as CSSProperties}
      draggable={false}
    />
  );
}
