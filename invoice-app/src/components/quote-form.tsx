"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ClientSelector } from "@/components/client-selector";
import { ArticleSelector } from "@/components/article-selector";
import { formatCurrency } from "@/lib/utils";
import { CURRENCY_OPTIONS, QUOTE_VALIDITY_OPTIONS } from "@/lib/constants";
import type { Quote, QuoteFormData, Client, Article } from "@/lib/types";

interface QuoteFormProps {
  quote?: Quote;
}

function calculateExpiryDate(issueDate: string, days: number): string {
  const date = new Date(issueDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function guessExpiryDays(issueDate: string, expiryDate: string): number {
  if (!issueDate || !expiryDate) return 30;
  const diff = Math.round(
    (new Date(expiryDate).getTime() - new Date(issueDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const closest = QUOTE_VALIDITY_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr.value - diff) < Math.abs(prev.value - diff) ? curr : prev
  );
  return closest.value;
}

export function QuoteForm({ quote }: QuoteFormProps) {
  const isEdit = !!quote;
  const router = useRouter();
  const supabase = createClient();

  const initialExpiryDays = isEdit
    ? guessExpiryDays(quote.date, quote.expiry_date)
    : 30;

  const [form, setForm] = useState<QuoteFormData>({
    client: quote?.client || "",
    email: quote?.email || "",
    client_id: quote?.client_id || null,
    date: quote?.date || new Date().toISOString().split("T")[0],
    expiry_date: quote?.expiry_date || calculateExpiryDate(new Date().toISOString().split("T")[0], 30),
    expiry_days: initialExpiryDays,
    notes: quote?.notes || "",
    currency: quote?.currency || "MAD",
    items: quote?.quote_items?.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      price: it.price,
      article_id: it.article_id || null,
      tax_rate: it.tax_rate || 0,
    })) || [{ description: "", quantity: 1, price: 0, article_id: null, tax_rate: 0 }],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: keyof QuoteFormData, value: string | number) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "date") {
        updated.expiry_date = calculateExpiryDate(value as string, prev.expiry_days);
      }
      if (field === "expiry_days") {
        updated.expiry_date = calculateExpiryDate(prev.date, value as number);
      }
      return updated;
    });
  }

  function handleClientSelect(client: Client) {
    setForm((prev) => ({
      ...prev,
      client_id: client.id,
      client: client.name,
      email: client.email || "",
    }));
    setError("");
  }

  function handleArticleSelect(index: number, article: Article) {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = {
        ...items[index],
        description: article.name,
        price: article.unit_price,
        article_id: article.id,
        tax_rate: article.tax_rate,
      };
      return { ...prev, items };
    });
  }

  function updateItem(index: number, field: string, value: string | number) {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: 1, price: 0, article_id: null, tax_rate: 0 }],
    }));
  }

  function removeItem(index: number) {
    if (form.items.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  const subtotal = form.items.reduce((sum, it) => sum + it.quantity * it.price, 0);
  const taxTotal = form.items.reduce((sum, it) => sum + it.quantity * it.price * (it.tax_rate / 100), 0);
  const total = subtotal + taxTotal;
  const fmt = (amount: number) => formatCurrency(amount, form.currency);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.client_id) {
      setError("Please select a client.");
      return;
    }
    if (!form.date || !form.expiry_date) {
      setError("Please fill in all required fields.");
      return;
    }

    const validItems = form.items.filter((it) => it.description && it.quantity > 0);
    if (validItems.length === 0) {
      setError("Please add at least one line item.");
      return;
    }

    setSaving(true);

    try {
      // ── Stock Validation (check only, no deduction) ──
      for (const item of validItems) {
        if (item.article_id) {
          const { data: article } = await supabase
            .from("articles")
            .select("type, stock_quantity, name")
            .eq("id", item.article_id)
            .single();

          if (article && article.type === "product" && article.stock_quantity !== null) {
            if (item.quantity > article.stock_quantity) {
              setError(
                `Insufficient stock for "${article.name}": available ${article.stock_quantity}, requested ${item.quantity}.`
              );
              setSaving(false);
              return;
            }
          }
        }
      }

      if (isEdit) {
        const { error: quoteError } = await supabase
          .from("quotes")
          .update({
            client: form.client,
            email: form.email,
            client_id: form.client_id,
            date: form.date,
            expiry_date: form.expiry_date,
            notes: form.notes,
            currency: form.currency,
          })
          .eq("id", quote.id);

        if (quoteError) throw quoteError;

        await supabase.from("quote_items").delete().eq("quote_id", quote.id);

        const { error: itemsError } = await supabase.from("quote_items").insert(
          validItems.map((it) => ({
            quote_id: quote.id,
            description: it.description,
            quantity: it.quantity,
            price: it.price,
            article_id: it.article_id,
            tax_rate: it.tax_rate,
          }))
        );
        if (itemsError) throw itemsError;

        router.push(`/devis/${quote.id}`);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: newQuote, error: quoteError } = await supabase
          .from("quotes")
          .insert({
            user_id: user.id,
            quote_number: "",
            client: form.client,
            email: form.email,
            client_id: form.client_id,
            date: form.date,
            expiry_date: form.expiry_date,
            status: "draft",
            notes: form.notes,
            currency: form.currency,
          })
          .select()
          .single();

        if (quoteError) throw quoteError;

        const { error: itemsError } = await supabase.from("quote_items").insert(
          validItems.map((it) => ({
            quote_id: newQuote.id,
            description: it.description,
            quantity: it.quantity,
            price: it.price,
            article_id: it.article_id,
            tax_rate: it.tax_rate,
          }))
        );
        if (itemsError) throw itemsError;

        router.push(`/devis/${newQuote.id}`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={isEdit ? `/devis/${quote.id}` : "/devis"}>
          <Button variant="ghost" size="sm" type="button" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Quote" : "New Quote"}</h1>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* Client Info */}
      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <ClientSelector selectedId={form.client_id} onSelect={handleClientSelect} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input value={form.client} placeholder="Selected from client list" disabled />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} placeholder="Selected from client list" disabled />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Issue Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Valid For *</Label>
              <Select
                value={String(form.expiry_days)}
                onValueChange={(v) => updateField("expiry_days", parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUOTE_VALIDITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Expires: {form.expiry_date}</p>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => updateField("currency", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden grid-cols-[120px_2fr_80px_1fr_80px_auto] gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Article</span>
            <span>Description</span>
            <span>Qty</span>
            <span>Price</span>
            <span>Tax %</span>
            <span className="w-9" />
          </div>

          {form.items.map((item, idx) => (
            <div key={idx} className="space-y-2 rounded-md border p-3 lg:border-0 lg:p-0">
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-[120px_2fr_80px_1fr_80px_auto]">
                <ArticleSelector
                  value={item.article_id}
                  onSelect={(article) => handleArticleSelect(idx, article)}
                />
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(idx, "description", e.target.value)}
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Price"
                  value={item.price}
                  onChange={(e) => updateItem(idx, "price", parseFloat(e.target.value) || 0)}
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  placeholder="Tax %"
                  value={item.tax_rate}
                  onChange={(e) => updateItem(idx, "tax_rate", parseFloat(e.target.value) || 0)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(idx)}
                  disabled={form.items.length <= 1}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addItem} className="w-full gap-2">
            <Plus className="h-4 w-4" /> Add Line Item
          </Button>

          {/* Totals */}
          <div className="flex justify-end border-t pt-4">
            <div className="w-64 space-y-1 text-right">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (HT)</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (TVA)</span>
                <span>{fmt(taxTotal)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>Total (TTC)</span>
                <span>{fmt(total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Additional notes..."
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link href={isEdit ? `/devis/${quote.id}` : "/devis"}>
          <Button type="button" variant="outline">Cancel</Button>
        </Link>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : isEdit ? "Update Quote" : "Create Quote"}
        </Button>
      </div>
    </form>
  );
}
