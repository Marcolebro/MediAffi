import {
  LayoutDashboard,
  Globe,
  MessageSquare,
  BarChart3,
  Mail,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Sites", href: "/sites", icon: Globe },
  { title: "Prompts", href: "/prompts", icon: MessageSquare },
  { title: "Performance", href: "/performance", icon: BarChart3 },
  { title: "Newsletter", href: "/newsletter", icon: Mail },
  { title: "Settings", href: "/settings", icon: Settings },
];

export const CHART_COLORS = [
  "hsl(221, 83%, 53%)", // blue
  "hsl(160, 84%, 39%)", // green
  "hsl(38, 92%, 50%)",  // amber
  "hsl(280, 67%, 51%)", // purple
  "hsl(346, 77%, 50%)", // rose
  "hsl(190, 90%, 42%)", // cyan
];

export const STATUS_COLORS: Record<string, string> = {
  published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  scraped: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  writing: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  scheduled: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  posted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};
