"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Wallet } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { calculateTotal, calculateTotalPaid, calculateRemainingBalance, getEffectiveStatus } from "@/lib/invoice-calcs";
import { statusConfig, CURRENCY_OPTIONS, PAYMENT_TYPE_LABELS } from "@/lib/constants";
import type { Invoice, Currency, PaymentType } from "@/lib/types";

interface PaymentMultiDialogProps {
  invoices: Invoice[]; // all client invoices (with invoice_items + payments loaded)
}

export function PaymentMultiDialog({ invoices }: PaymentMultiDialogProps) {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<Currency>("MAD");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Invoices outstanding for selected currency
  const outstandingByCurrency = useMemo(() => {
    return invoices
      .filter((inv) => {
        if (inv.currency !== currency) return false;
        const remaining = calculateRemainingBalance(inv);
        return remaining > 0;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // oldest first
  }, [invoices, currency]);

  // Remaining balance per invoice (for display)
  const remainingMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of outstandingByCurrency) {
      map.set(inv.id, calculateRemainingBalance(inv));
    }
    return map;
  }, [outstandingByCurrency]);

  // Total remaining of selected invoices
  const totalSelectedRemaining = useMemo(() => {
    return Array.from(selectedIds).reduce((sum, id) => sum + (remainingMap.get(id) || 0), 0);
  }, [selectedIds, remainingMap]);

  function resetForm() {
    setSelectedIds(new Set());
    setAmount(0);
    setDate(new Date().toISOString().split("T")[0]);
    setPaymentType("cash");
    setReference("");
    setError("");
  }

  function handleOpen(v: boolean) {
    setOpen(v);
    if (v) resetForm();
  }

  function handleCurrencyChange(c: Currency) {
    setCurrency(c);
    setSelectedIds(new Set());
    setAmount(0);
    setError("");
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setError("");
  }

  function toggleAll() {
    if (selectedIds.size === outstandingByCurrency.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(outstandingByCurrency.map((inv) => inv.id)));
    }
    setError("");
  }

  // When user clicks "Pay total" shortcut
  function setMaxAmount() {
    setAmount(parseFloat(totalSelectedRemaining.toFixed(2)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (selectedIds.size === 0) {
      setError("Select at least one invoice.");
      return;
    }
    if (amount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (amount > totalSelectedRemaining + 0.001) {
      setError(
        `Amount exceeds total remaining (${formatCurrency(totalSelectedRemaining, currency)}).`
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Sort selected invoices oldest-first
      const selected = outstandingByCurrency.filter((inv) => selectedIds.has(inv.id));
      // already sorted oldest-first from useMemo

      let remaining = amount;

      for (const inv of selected) {
        if (remaining <= 0.001) break;

        const invRemaining = remainingMap.get(inv.id) || 0;
        const payThis = Math.min(remaining, invRemaining);

        // Insert payment record
        await supabase.from("payments").insert({
          user_id: user.id,
          invoice_id: inv.id,
          amount: parseFloat(payThis.toFixed(2)),
          payment_date: date,
          payment_type: paymentType,
          reference: reference || null,
          notes: selectedIds.size > 1 ? "Multi-invoice payment" : null,
        });

        // Recalculate invoice status
        const newTotalPaid = calculateTotalPaid(inv) + payThis;
        const total = calculateTotal(inv);
        let newStatus = "unpaid";
        if (newTotalPaid >= total - 0.001) newStatus = "paid";
        else if (newTotalPaid > 0) newStatus = "partially_paid";

        await supabase.from("invoices").update({ status: newStatus }).eq("id", inv.id);

        remaining -= payThis;
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const allSelected =
    outstandingByCurrency.length > 0 &&
    outstandingByCurrency.every((inv) => selectedIds.has(inv.id));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Wallet className="h-4 w-4" /> Record Payment
        </Button>
      </DialogTrigger>

      <DialogContent className="flex flex-col gap-0 p-0 max-w-xl max-h-[90vh]">
        {/* Fixed header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Record Multi-Invoice Payment</DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Currency selector */}
            <div className="space-y-2">
              <Label>Currency</Label>
              <div className="flex gap-2">
                {CURRENCY_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={currency === opt.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleCurrencyChange(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Invoice list */}
            <div className="space-y-2">
              <Label>Outstanding Invoices ({currency})</Label>
              {outstandingByCurrency.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No outstanding invoices in {currency}.
                </p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 px-3">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleAll}
                            aria-label="Select all"
                          />
                        </TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead className="text-muted-foreground font-normal">Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outstandingByCurrency.map((inv) => {
                        const remaining = remainingMap.get(inv.id) || 0;
                        const total = calculateTotal(inv);
                        const es = getEffectiveStatus(inv);
                        const isSelected = selectedIds.has(inv.id);
                        return (
                          <TableRow
                            key={inv.id}
                            className="cursor-pointer"
                            data-state={isSelected ? "selected" : undefined}
                            onClick={() => toggleOne(inv.id)}
                          >
                            <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleOne(inv.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{inv.invoice_number}</div>
                              <Badge variant={statusConfig[es].variant} className="text-xs mt-0.5">
                                {statusConfig[es].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(inv.date), "dd/MM/yy")}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatCurrency(total, currency)}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-amber-600">
                              {formatCurrency(remaining, currency)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Total row */}
                  {selectedIds.size > 0 && (
                    <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-sm">
                      <span className="text-muted-foreground">
                        {selectedIds.size} invoice{selectedIds.size > 1 ? "s" : ""} selected
                      </span>
                      <span className="font-semibold">
                        À régler:{" "}
                        <span className="text-amber-600">
                          {formatCurrency(totalSelectedRemaining, currency)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Payment details */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="multi-amount">Amount * ({currency})</Label>
                  {selectedIds.size > 0 && totalSelectedRemaining > 0 && (
                    <button
                      type="button"
                      onClick={setMaxAmount}
                      className="text-xs text-primary hover:underline"
                    >
                      Pay total
                    </button>
                  )}
                </div>
                <Input
                  id="multi-amount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  max={totalSelectedRemaining || undefined}
                  value={amount || ""}
                  onChange={(e) => {
                    setAmount(parseFloat(e.target.value) || 0);
                    setError("");
                  }}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="multi-date">Date *</Label>
                <Input
                  id="multi-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="multi-type">Payment Type *</Label>
                <Select
                  value={paymentType}
                  onValueChange={(v) => setPaymentType(v as PaymentType)}
                >
                  <SelectTrigger id="multi-type">
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
                <Label htmlFor="multi-ref">Reference</Label>
                <Input
                  id="multi-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Check #, Transfer ID..."
                />
              </div>
            </div>

            {/* Preview distribution */}
            {selectedIds.size > 0 && amount > 0 && amount <= totalSelectedRemaining + 0.001 && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Distribution preview
                </p>
                {(() => {
                  const selected = outstandingByCurrency.filter((inv) => selectedIds.has(inv.id));
                  let rem = amount;
                  return selected.map((inv) => {
                    if (rem <= 0.001) return null;
                    const invRem = remainingMap.get(inv.id) || 0;
                    const payThis = Math.min(rem, invRem);
                    rem -= payThis;
                    const willBePaid = payThis >= invRem - 0.001;
                    return (
                      <div key={inv.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{inv.invoice_number}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatCurrency(payThis, currency)}
                          </span>
                          <Badge
                            variant={willBePaid ? "default" : "secondary"}
                            className="text-xs h-5"
                          >
                            {willBePaid ? "Paid" : "Partial"}
                          </Badge>
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Fixed footer */}
          <div className="shrink-0 border-t px-6 py-4 flex justify-end gap-2 bg-background">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || selectedIds.size === 0 || amount <= 0}
            >
              {saving ? "Processing..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
