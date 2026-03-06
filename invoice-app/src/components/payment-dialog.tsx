"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_TYPE_LABELS } from "@/lib/constants";
import type { Invoice, PaymentFormData, PaymentType, Currency } from "@/lib/types";

interface PaymentDialogProps {
  invoice: Invoice;
  remainingBalance: number;
  invoiceTotal: number;
}

export function PaymentDialog({ invoice, remainingBalance, invoiceTotal }: PaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<PaymentFormData>({
    amount: remainingBalance,
    payment_date: new Date().toISOString().split("T")[0],
    payment_type: "cash",
    reference: "",
    notes: "",
  });

  function resetForm() {
    setForm({
      amount: remainingBalance,
      payment_date: new Date().toISOString().split("T")[0],
      payment_type: "cash",
      reference: "",
      notes: "",
    });
    setError("");
  }

  const fmt = (amount: number) => formatCurrency(amount, invoice.currency);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.amount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    if (form.amount > remainingBalance) {
      setError(`Amount exceeds remaining balance (${fmt(remainingBalance)}).`);
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert payment
      const { error: paymentError } = await supabase.from("payments").insert({
        user_id: user.id,
        invoice_id: invoice.id,
        amount: form.amount,
        payment_date: form.payment_date,
        payment_type: form.payment_type,
        reference: form.reference,
        notes: form.notes,
      });

      if (paymentError) throw paymentError;

      // Calculate new total paid
      const { data: allPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("invoice_id", invoice.id);

      const totalPaid = (allPayments || []).reduce((sum, p) => sum + p.amount, 0);

      // Auto-update invoice status
      let newStatus = "unpaid";
      if (totalPaid >= invoiceTotal) {
        newStatus = "paid";
      } else if (totalPaid > 0) {
        newStatus = "partially_paid";
      }

      await supabase
        .from("invoices")
        .update({ status: newStatus })
        .eq("id", invoice.id);

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <CreditCard className="h-4 w-4" /> Add Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Total</span>
              <span className="font-medium">{fmt(invoiceTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-bold text-amber-600">{fmt(remainingBalance)}</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount *</Label>
              <Input
                id="payment-amount"
                type="number"
                min={0.01}
                max={remainingBalance}
                step="0.01"
                value={form.amount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-date">Date *</Label>
              <Input
                id="payment-date"
                type="date"
                value={form.payment_date}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, payment_date: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-type">Payment Type *</Label>
            <Select
              value={form.payment_type}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, payment_type: v as PaymentType }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(PAYMENT_TYPE_LABELS) as [PaymentType, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-ref">Reference</Label>
            <Input
              id="payment-ref"
              value={form.reference}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, reference: e.target.value }))
              }
              placeholder="Check #, Transfer ID..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-notes">Notes</Label>
            <Textarea
              id="payment-notes"
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Payment notes..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Processing..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
