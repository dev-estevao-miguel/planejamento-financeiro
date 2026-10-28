import { ImageResponse } from "next/og";
import { BRAND_GRADIENT } from "./brand";

const BARS = [
  { height: 0.3, opacity: 0.65 },
  { height: 0.46, opacity: 0.82 },
  { height: 0.66, opacity: 1 },
];

/**
 * PNG app icon (favicon, Apple touch icon, PWA icons). `maskable` keeps the
 * artwork inside the 80% safe zone and fills the whole square, as Android
 * crops it into circles/squircles.
 */
export function renderAppIcon(size: number, { maskable = false }: { maskable?: boolean } = {}): ImageResponse {
  const artwork = maskable ? 0.5 : 0.62;
  const barWidth = Math.round(size * artwork * 0.18);
  const gap = Math.round(barWidth * 0.55);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: `linear-gradient(135deg, ${BRAND_GRADIENT.from}, ${BRAND_GRADIENT.to})`,
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap, height: Math.round(size * artwork) }}>
          {BARS.map((bar, index) => (
            <div
              key={index}
              style={{
                width: barWidth,
                height: Math.round(size * artwork * bar.height * 1.4),
                borderRadius: barWidth,
                background: "white",
                opacity: bar.opacity,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
