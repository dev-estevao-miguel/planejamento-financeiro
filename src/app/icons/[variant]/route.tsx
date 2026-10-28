import { renderAppIcon } from "@/lib/app-icon";

/** PWA manifest icons at stable URLs: /icons/192, /icons/512, /icons/maskable. */
const VARIANTS = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  maskable: { size: 512, maskable: true },
} as const;

type Variant = keyof typeof VARIANTS;

function isVariant(value: string): value is Variant {
  return Object.hasOwn(VARIANTS, value);
}

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_request: Request, context: RouteContext<"/icons/[variant]">) {
  const { variant } = await context.params;
  if (!isVariant(variant)) return new Response("Not found", { status: 404 });
  const { size, maskable } = VARIANTS[variant];
  return renderAppIcon(size, { maskable });
}
