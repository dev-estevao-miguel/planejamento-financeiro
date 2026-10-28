import { ArrowLeftRight, ChartPie, Ellipsis, House, Target, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: House },
  { href: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  { href: "/planejamento", label: "Planejamento", icon: Target },
  { href: "/relatorios", label: "Relatórios", icon: ChartPie },
  { href: "/mais", label: "Mais", icon: Ellipsis },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
