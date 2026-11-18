import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatTime(value?: string | null): string {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function truncateMiddle(value: string, start = 14, end = 12): string {
  if (value.length <= start + end + 3) {
    return value;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function workspaceRelativePath(value: string, root?: string | null) {
  if (!root) return value;

  const prefix = root.replaceAll("\\", "/").replace(/\/+$/, "") + "/";
  const normalized = value.replaceAll("\\", "/");
  const windows = /^[A-Za-z]:\//.test(prefix) || prefix.startsWith("//");
  const insideRoot = windows
    ? normalized.toLowerCase().startsWith(prefix.toLowerCase())
    : normalized.startsWith(prefix);

  return insideRoot ? normalized.slice(prefix.length) : value;
}
