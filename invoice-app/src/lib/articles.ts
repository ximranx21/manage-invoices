import { createClient } from "@/lib/supabase/server";
import type { Article, StockAlert } from "@/lib/types";

export async function getArticles(): Promise<Article[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getArticle(id: string): Promise<Article | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export function getStockAlerts(articles: Article[]): StockAlert[] {
  const alerts: StockAlert[] = [];
  for (const article of articles) {
    if (article.type !== "product" || !article.is_active) continue;
    if (article.stock_quantity === 0) {
      alerts.push({ article, alertType: "rupture" });
    } else if (
      article.stock_quantity !== null &&
      article.min_stock_alert > 0 &&
      article.stock_quantity <= article.min_stock_alert
    ) {
      alerts.push({ article, alertType: "low_stock" });
    }
  }
  return alerts;
}
