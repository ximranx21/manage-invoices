import { createClient } from "@/lib/supabase/server";
import type { Quote } from "@/lib/types";

export async function getQuotes(): Promise<Quote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*, quote_items(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getQuote(id: string): Promise<Quote | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*, quote_items(*)")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export function calculateQuoteSubtotal(quote: Quote): number {
  return (quote.quote_items || []).reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );
}

export function calculateQuoteTax(quote: Quote): number {
  return (quote.quote_items || []).reduce(
    (sum, item) => sum + item.quantity * item.price * (item.tax_rate / 100),
    0
  );
}

export function calculateQuoteTotal(quote: Quote): number {
  return calculateQuoteSubtotal(quote) + calculateQuoteTax(quote);
}
