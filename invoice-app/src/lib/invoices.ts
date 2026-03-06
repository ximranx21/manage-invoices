import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/types";

// Re-export all pure calculation helpers (safe for client + server)
export {
  calculateSubtotal,
  calculateTax,
  calculateTotal,
  calculateTotalPaid,
  calculateRemainingBalance,
  getEffectiveStatus,
  calculateStats,
} from "@/lib/invoice-calcs";

export async function getInvoices(): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), payments(*)")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}
