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
import { Plus, X, ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ClientSelector } from "@/components/client-selector";
import { ArticleSelector } from "@/components/article-selector";
import { formatCurrency } from "@/lib/utils";
import { DUE_DATE_OPTIONS, CURRENCY_OPTIONS } from "@/lib/constants";
import type { Invoice, InvoiceFormData, Client, Article, Currency } from "@/lib/types";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface InvoiceFormProps {
  invoice?: Invoice;
}

function calculateDueDate(issueDate: string, days: number): string {
  const date = new Date(issueDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function guessDueDateDays(issueDate: string, dueDate: string): number {
  if (!issueDate || !dueDate) return 30;
  const diff = Math.round(
    (new Date(dueDate).getTime() - new Date(issueDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const closest = DUE_DATE_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr.value - diff) < Math.abs(prev.value - diff) ? curr : prev
  );
  return closest.value;
}

export function InvoiceForm({ invoice }: InvoiceFormProps) {
  const isEdit = !!invoice;
  const router = useRouter();
  const supabase = createClient();

  const initialDueDateDays = isEdit
    ? guessDueDateDays(invoice.date, invoice.due_date)
    : 30;

  const [form, setForm] = useState<InvoiceFormData>({
    client: invoice?.client || "",
    email: invoice?.email || "",
    client_id: invoice?.client_id || null,
    date: invoice?.date || new Date().toISOString().split("T")[0],
    due_date: invoice?.due_date || calculateDueDate(new Date().toISOString().split("T")[0], 30),
    due_date_days: initialDueDateDays,
    status: invoice?.status === "delayed" ? "unpaid" : invoice?.status || "unpaid",
    notes: invoice?.notes || "",
    currency: invoice?.currency || "MAD",
    items: invoice?.invoice_items?.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      price: it.price,
      article_id: it.article_id || null,
      tax_rate: it.tax_rate || 0,
    })) || [{ description: "", quantity: 1, price: 0, article_id: null, tax_rate: 0 }],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [creditWarning, setCreditWarning] = useState("");

  function updateField(field: keyof InvoiceFormData, value: string | number) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Recalculate due_date when issue date or days change
      if (field === "date") {
        updated.due_date = calculateDueDate(value as string, prev.due_date_days);
      }
      if (field === "due_date_days") {
        updated.due_date = calculateDueDate(prev.date, value as number);
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

    if (!form.date || !form.due_date) {
      setError("Please fill in all required fields.");
      return;
    }

    const validItems = form.items.filter((it) => it.description && it.quantity > 0);
    if (validItems.length === 0) {
      setError("Please add at least one line item.");
      return;
    }

    setSaving(true);
    setCreditWarning("");

    try {
      // ── Credit Limit Check ───────────────────────
      if (form.client_id && form.status !== "paid") {
        const { data: clientData } = await supabase
          .from("clients")
          .select("credit_limit")
          .eq("id", form.client_id)
          .single();

        const creditLimit = clientData?.credit_limit || 0;

        if (creditLimit > 0) {
          const { data: outstandingInvoices } = await supabase
            .from("invoices")
            .select("id, invoice_items(quantity, price, tax_rate)")
            .eq("client_id", form.client_id)
            .in("status", ["unpaid", "delayed", "partially_paid"]);

          let outstandingTotal = 0;
          if (outstandingInvoices) {
            for (const inv of outstandingInvoices) {
              if (isEdit && inv.id === invoice.id) continue;
              const invItems = inv.invoice_items || [];
              outstandingTotal += invItems.reduce(
                (sum: number, it: { quantity: number; price: number; tax_rate: number }) =>
                  sum + it.quantity * it.price * (1 + (it.tax_rate || 0) / 100),
                0
              );
            }
          }

          const newInvoiceTotal = total;

          if (outstandingTotal + newInvoiceTotal > creditLimit) {
            const remaining = Math.max(creditLimit - outstandingTotal, 0);
            setError(
              `Credit limit exceeded! Limit: ${fmt(creditLimit)}. ` +
              `Outstanding: ${fmt(outstandingTotal)} · This invoice: ${fmt(newInvoiceTotal)} · ` +
              `Remaining: ${fmt(remaining)}.`
            );
            setSaving(false);
            return;
          }

          const usageAfter = ((outstandingTotal + newInvoiceTotal) / creditLimit) * 100;
          if (usageAfter >= 80) {
            setCreditWarning(
              `Warning: After this invoice, the client will be at ${usageAfter.toFixed(0)}% of their credit limit (${fmt(creditLimit)}).`
            );
          }
        }
      }

      // ── Stock Validation (for new items with article_id) ──
      for (const item of validItems) {
        if (item.article_id) {
          const { data: article } = await supabase
            .from("articles")
            .select("type, stock_quantity, name")
            .eq("id", item.article_id)
            .single();

          if (article && article.type === "product" && article.stock_quantity !== null) {
            // For edit mode, find old quantity for this article to account for
            let oldQty = 0;
            if (isEdit && invoice.invoice_items) {
              const oldItem = invoice.invoice_items.find((oi) => oi.article_id === item.article_id);
              if (oldItem) oldQty = oldItem.quantity;
            }
            const effectiveStock = article.stock_quantity + oldQty;
            if (item.quantity > effectiveStock) {
              setError(
                `Insufficient stock for "${article.name}": available ${effectiveStock}, requested ${item.quantity}.`
              );
              setSaving(false);
              return;
            }
          }
        }
      }

      // ── Edit mode: restore old stock first ──
      if (isEdit && invoice.invoice_items) {
        for (const oldItem of invoice.invoice_items) {
          if (oldItem.article_id) {
            const { data: article } = await supabase
              .from("articles")
              .select("type, stock_quantity")
              .eq("id", oldItem.article_id)
              .single();
            if (article && article.type === "product" && article.stock_quantity !== null) {
              await supabase
                .from("articles")
                .update({ stock_quantity: article.stock_quantity + oldItem.quantity })
                .eq("id", oldItem.article_id);
            }
          }
        }
      }

      if (isEdit) {
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({
            client: form.client,
            email: form.email,
            client_id: form.client_id,
            date: form.date,
            due_date: form.due_date,
            status: form.status,
            notes: form.notes,
            currency: form.currency,
          })
          .eq("id", invoice.id);

        if (invoiceError) throw invoiceError;

        await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id);

        const { error: itemsError } = await supabase.from("invoice_items").insert(
          validItems.map((it) => ({
            invoice_id: invoice.id,
            description: it.description,
            quantity: it.quantity,
            price: it.price,
            article_id: it.article_id,
            tax_rate: it.tax_rate,
          }))
        );

        if (itemsError) throw itemsError;

        router.push(`/invoices/${invoice.id}`);
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: newInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            user_id: user.id,
            invoice_number: "",
            client: form.client,
            email: form.email,
            client_id: form.client_id,
            date: form.date,
            due_date: form.due_date,
            status: form.status,
            notes: form.notes,
            currency: form.currency,
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        const { error: itemsError } = await supabase.from("invoice_items").insert(
          validItems.map((it) => ({
            invoice_id: newInvoice.id,
            description: it.description,
            quantity: it.quantity,
            price: it.price,
            article_id: it.article_id,
            tax_rate: it.tax_rate,
          }))
        );

        if (itemsError) throw itemsError;

        router.push(`/invoices/${newInvoice.id}`);
      }

      // ── Decrease stock for product articles ──
      for (const item of validItems) {
        if (item.article_id) {
          const { data: article } = await supabase
            .from("articles")
            .select("type, stock_quantity")
            .eq("id", item.article_id)
            .single();
          if (article && article.type === "product" && article.stock_quantity !== null) {
            await supabase
              .from("articles")
              .update({ stock_quantity: article.stock_quantity - item.quantity })
              .eq("id", item.article_id);
          }
        }
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
        <Link href={isEdit ? `/invoices/${invoice.id}` : "/invoices"}>
          <Button variant="ghost" size="sm" type="button" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Invoice" : "New Invoice"}</h1>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {creditWarning && (
        <Alert variant="default" className="border-amber-500 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-4 w-4 !text-amber-600" />
          <AlertTitle className="text-amber-800">Credit Limit Warning</AlertTitle>
          <AlertDescription className="text-amber-700">{creditWarning}</AlertDescription>
        </Alert>
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
              <Label htmlFor="client">Client Name</Label>
              <Input id="client" value={form.client} placeholder="Selected from client list" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} placeholder="Selected from client list" disabled />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="date">Issue Date *</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date_days">Payment Terms *</Label>
              <Select
                value={String(form.due_date_days)}
                onValueChange={(v) => updateField("due_date_days", parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DUE_DATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Due: {form.due_date}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
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
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
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
          {/* Header */}
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
        <Link href={isEdit ? `/invoices/${invoice.id}` : "/invoices"}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : isEdit ? "Update Invoice" : "Create Invoice"}
        </Button>
      </div>
    </form>
  );
}
