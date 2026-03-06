// Pure calculation helpers — no server imports, safe to use in client components
import type { Invoice, InvoiceStats, InvoiceStatus } from "@/lib/types";

export function calculateSubtotal(invoice: Invoice): number {
  return (invoice.invoice_items || []).reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );
}

export function calculateTax(invoice: Invoice): number {
  return (invoice.invoice_items || []).reduce(
    (sum, item) => sum + item.quantity * item.price * (item.tax_rate / 100),
    0
  );
}

export function calculateTotal(invoice: Invoice): number {
  return calculateSubtotal(invoice) + calculateTax(invoice);
}

export function calculateTotalPaid(invoice: Invoice): number {
  return (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
}

export function calculateRemainingBalance(invoice: Invoice): number {
  return calculateTotal(invoice) - calculateTotalPaid(invoice);
}

export function getEffectiveStatus(invoice: Invoice): InvoiceStatus {
  if (
    (invoice.status === "unpaid" || invoice.status === "partially_paid") &&
    invoice.due_date &&
    new Date(invoice.due_date) < new Date()
  ) {
    return "delayed";
  }
  return invoice.status;
}

export function calculateStats(invoices: Invoice[]): InvoiceStats {
  const stats: InvoiceStats = {
    total: invoices.length,
    unpaid: 0,
    paid: 0,
    delayed: 0,
    partially_paid: 0,
    totalAmount: 0,
    unpaidAmount: 0,
    paidAmount: 0,
    delayedAmount: 0,
    partially_paidAmount: 0,
  };

  invoices.forEach((inv) => {
    const amount = calculateTotal(inv);
    stats.totalAmount += amount;

    const effectiveStatus = getEffectiveStatus(inv);
    stats[effectiveStatus]++;
    const amountKey = `${effectiveStatus}Amount` as keyof InvoiceStats;
    (stats[amountKey] as number) += amount;
  });

  return stats;
}
