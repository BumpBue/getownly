import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges conditional class names and lets a later Tailwind class win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
