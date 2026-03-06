import { createClient } from "@/lib/supabase/server";
import { calculateTotal } from "@/lib/invoice-calcs";
import type { Currency, Payment, PaymentType } from "@/lib/types";

export async function getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("payment_date", { ascending: false });

  if (error) throw error;
  return data || [];
}

export interface PaymentRow {
  id: string;
  amount: number;
  payment_date: string;
  payment_type: PaymentType;
  reference: string | null;
  notes: string | null;
  created_at: string;
  invoice_id: string;
  invoice_number: string;
  currency: Currency;
  client_id: string;
  client_name: string;
  settlement: "total" | "partial";
}

export function computeSettlement(
  paymentId: string,
  invoicePayments: { id: string; amount: number; created_at: string }[],
  invoiceTotal: number
): "total" | "partial" {
  const sorted = [...invoicePayments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let cumulative = 0;
  for (const p of sorted) {
    cumulative += p.amount;
    if (p.id === paymentId) {
      return cumulative >= invoiceTotal - 0.001 ? "total" : "partial";
    }
  }
  return "partial";
}

export async function getAllPaymentsWithDetails(clientId?: string): Promise<PaymentRow[]> {
  const supabase = await createClient();

  let invoiceIds: string[] | null = null;
  if (clientId) {
    const { data } = await supabase
      .from("invoices")
      .select("id")
      .eq("client_id", clientId);
    invoiceIds = (data || []).map((i: { id: string }) => i.id);
    if (invoiceIds.length === 0) return [];
  }

  let query = supabase
    .from("payments")
    .select(`
      *,
      invoice:invoices(
        id,
        invoice_number,
        currency,
        client_id,
        invoice_items(*),
        all_payments:payments(id, amount, created_at),
        client:clients(id, name)
      )
    `)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (invoiceIds) {
    query = query.in("invoice_id", invoiceIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((p: any) => {
    const inv = p.invoice;
    const invoiceTotal = calculateTotal({ invoice_items: inv.invoice_items } as any);
    const settlement = computeSettlement(p.id, inv.all_payments || [], invoiceTotal);
    return {
      id: p.id,
      amount: p.amount,
      payment_date: p.payment_date,
      payment_type: p.payment_type as PaymentType,
      reference: p.reference ?? null,
      notes: p.notes ?? null,
      created_at: p.created_at,
      invoice_id: p.invoice_id,
      invoice_number: inv.invoice_number,
      currency: inv.currency as Currency,
      client_id: inv.client_id,
      client_name: inv.client?.name ?? "—",
      settlement,
    };
  });
}
