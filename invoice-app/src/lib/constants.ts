import type { InvoiceStatus, Currency, PaymentType, QuoteStatus } from "@/lib/types";

export const statusConfig: Record<
  InvoiceStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  unpaid: { label: "Unpaid", variant: "outline" },
  paid: { label: "Paid", variant: "default" },
  delayed: { label: "Delayed", variant: "destructive" },
  partially_paid: { label: "Partially Paid", variant: "secondary" },
};

export const DUE_DATE_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: 120, label: "120 days" },
] as const;

export const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: "MAD", label: "MAD (Dirham)", symbol: "MAD" },
  { value: "EUR", label: "EUR (Euro)", symbol: "\u20ac" },
  { value: "USD", label: "USD (Dollar)", symbol: "$" },
];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  check: "Check",
};

export const quoteStatusConfig: Record<
  QuoteStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "outline" },
  accepted: { label: "Accepted", variant: "default" },
  declined: { label: "Declined", variant: "destructive" },
};

export const QUOTE_VALIDITY_OPTIONS = [
  { value: 15, label: "15 days" },
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
] as const;
