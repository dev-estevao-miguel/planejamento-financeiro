import { renderAppIcon } from "@/lib/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applies its own rounded mask, so the tile is drawn full-bleed.
export default function AppleIcon() {
  return renderAppIcon(size.width, { maskable: true });
}
