"use client";

import {
  Banknote,
  BookOpen,
  Bot,
  CalendarDays,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  Landmark,
  MoonStar,
  Printer,
  ReceiptText,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  ArrowLeftRight,
  Plus,
  Pencil,
  Trash2,
  X,
  Mic,
  Send,
  RotateCcw,
  Globe,
  Palette,
  TriangleAlert,
  Check,
  Scissors,
  type LucideIcon,
} from "lucide-react";

const MAP = {
  book: BookOpen,
  calendar: CalendarDays,
  day: MoonStar,
  month: CalendarDays,
  report: ReceiptText,
  excel: FileSpreadsheet,
  backup: Download,
  print: Printer,
  settings: Settings,
  phone: Smartphone,
  ai: Bot,
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight,
  bank: Landmark,
  search: Search,
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  close: X,
  mic: Mic,
  send: Send,
  spark: Sparkles,
  db: Database,
  reset: RotateCcw,
  globe: Globe,
  palette: Palette,
  warn: TriangleAlert,
  check: Check,
  scissors: Scissors,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof MAP;

export function I({ name, size = 14, className }: { name: IconName; size?: number; className?: string }) {
  const Cmp = MAP[name];
  return <Cmp size={size} className={className} aria-hidden />;
}
