import {
  Award,
  Briefcase,
  CalendarCheck,
  Car,
  CircleDashed,
  CircleEllipsis,
  CirclePlus,
  CreditCard,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  PartyPopper,
  PawPrint,
  Percent,
  Plane,
  Receipt,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  TrendingUp,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/** Icons used by the default categories (finance migration). Unknown names fall back. */
const ICONS: Record<string, LucideIcon> = {
  award: Award,
  briefcase: Briefcase,
  "calendar-check": CalendarCheck,
  car: Car,
  "circle-ellipsis": CircleEllipsis,
  "circle-plus": CirclePlus,
  "credit-card": CreditCard,
  gift: Gift,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  house: House,
  landmark: Landmark,
  laptop: Laptop,
  "party-popper": PartyPopper,
  "paw-print": PawPrint,
  percent: Percent,
  plane: Plane,
  receipt: Receipt,
  repeat: Repeat,
  "shield-check": ShieldCheck,
  "shopping-bag": ShoppingBag,
  sparkles: Sparkles,
  sun: Sun,
  "trending-up": TrendingUp,
  utensils: Utensils,
};

interface CategoryIconProps {
  icon: string | null | undefined;
  color: string | null | undefined;
  className?: string;
}

/** Category glyph on a tinted tile (the color is decorative; the name is always shown next to it). */
export function CategoryIcon({ icon, color, className }: CategoryIconProps) {
  const Icon = (icon && ICONS[icon]) || CircleDashed;
  return (
    <span
      aria-hidden
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted", className)}
      style={color ? { backgroundColor: `${color}1f`, color } : undefined}
    >
      <Icon className="size-5" />
    </span>
  );
}
