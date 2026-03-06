import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Currency } from "@/lib/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const currencyConfig: Record<Currency, { locale: string; currency: string }> = {
  MAD: { locale: "fr-MA", currency: "MAD" },
  EUR: { locale: "fr-FR", currency: "EUR" },
  USD: { locale: "en-US", currency: "USD" },
};

export function formatCurrency(amount: number, currency: Currency = "MAD"): string {
  const config = currencyConfig[currency];
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.currency,
  }).format(amount);
}
