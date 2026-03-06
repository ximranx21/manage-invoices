"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { calculateTotal } from "@/lib/invoice-calcs";
import type { PaymentRow } from "@/lib/payments";
import type { InvoiceStatus } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_TYPE_LABELS } from "@/lib/constants";
import { format } from "date-fns";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BatchPayment {
  id: string;
  amount: number;
  invoice_id: string;
  invoice_number: string;
  currency: string;
}

interface DeleteTarget {
  origin: PaymentRow;
  batch: BatchPayment[];
}

interface PaymentTableProps {
  payments: PaymentRow[];
  showClient?: boolean;
}

export function PaymentTable({ payments, showClient = true }: PaymentTableProps) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteClick(payment: PaymentRow) {
    setLoadingId(payment.id);
    const supabase = createClient();

    let batch: BatchPayment[] = [];

    if (payment.reference && payment.reference.trim() !== "") {
      // Find all payments with same reference + payment_type (same cheque/transfer)
      const { data } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          invoice_id,
          invoice:invoices(invoice_number, currency)
        `)
        .eq("reference", payment.reference.trim())
        .eq("payment_type", payment.payment_type);

      batch = (data || []).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        invoice_id: p.invoice_id,
        invoice_number: p.invoice?.invoice_number ?? "—",
        currency: p.invoice?.currency ?? payment.currency,
      }));
    } else {
      // No reference → only this specific payment
      batch = [
        {
          id: payment.id,
          amount: payment.amount,
          invoice_id: payment.invoice_id,
          invoice_number: payment.invoice_number,
          currency: payment.currency,
        },
      ];
    }

    setLoadingId(null);
    setDeleteTarget({ origin: payment, batch });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const supabase = createClient();
    const batchIds = deleteTarget.batch.map((p) => p.id);
    const affectedInvoiceIds = [...new Set(deleteTarget.batch.map((p) => p.invoice_id))];

    // 1. Delete all batch payments
    await supabase.from("payments").delete().in("id", batchIds);

    // 2. Recalculate status for each affected invoice
    for (const invoiceId of affectedInvoiceIds) {
      const [{ data: remaining }, { data: invoice }] = await Promise.all([
        supabase.from("payments").select("amount").eq("invoice_id", invoiceId),
        supabase
          .from("invoices")
          .select("*, invoice_items(*)")
          .eq("id", invoiceId)
          .single(),
      ]);

      if (!invoice) continue;

      const totalPaid = (remaining || []).reduce(
        (sum: number, p: { amount: number }) => sum + p.amount,
        0
      );
      const invoiceTotal = calculateTotal(invoice as any);

      let newStatus: InvoiceStatus;
      if (totalPaid < 0.001) {
        const isPastDue = new Date(invoice.due_date) < new Date();
        newStatus = isPastDue ? "delayed" : "unpaid";
      } else if (totalPaid >= invoiceTotal - 0.001) {
        newStatus = "paid";
      } else {
        newStatus = "partially_paid";
      }

      await supabase.from("invoices").update({ status: newStatus }).eq("id", invoiceId);
    }

    setDeleting(false);
    setDeleteTarget(null);
    router.refresh();
  }

  const isBatch = (deleteTarget?.batch.length ?? 0) > 1;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {showClient && <TableHead>Client</TableHead>}
            <TableHead>Invoice</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="hidden sm:table-cell">Reference</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="text-sm">
                {format(new Date(p.payment_date), "dd/MM/yyyy")}
              </TableCell>
              {showClient && (
                <TableCell>
                  <Link
                    href={`/clients/${p.client_id}`}
                    className="font-medium hover:underline text-sm"
                  >
                    {p.client_name}
                  </Link>
                </TableCell>
              )}
              <TableCell>
                <Link
                  href={`/invoices/${p.invoice_id}`}
                  className="font-medium hover:underline text-sm"
                >
                  {p.invoice_number}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {PAYMENT_TYPE_LABELS[p.payment_type]}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                {p.reference || "—"}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(p.amount, p.currency)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteClick(p)}
                  disabled={loadingId === p.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBatch ? "Delete Batch Payment" : "Delete Payment"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {isBatch ? (
                  <>
                    <p>
                      This payment{" "}
                      <span className="font-medium text-foreground">
                        (ref: {deleteTarget?.origin.reference})
                      </span>{" "}
                      was used to pay <strong className="text-foreground">{deleteTarget?.batch.length} invoices</strong>.
                      Deleting it will remove all related payments.
                    </p>
                    <div className="rounded-md border bg-muted/50 px-3 py-2">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Affected invoices
                      </p>
                      <ul className="space-y-1">
                        {deleteTarget?.batch.map((b) => (
                          <li key={b.id} className="flex justify-between text-foreground">
                            <span className="font-medium">{b.invoice_number}</span>
                            <span>{formatCurrency(b.amount, b.currency as any)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p>
                      You&apos;ll need to re-enter new payments for these invoices.
                    </p>
                  </>
                ) : (
                  <p>
                    This will delete the payment of{" "}
                    <strong className="text-foreground">
                      {deleteTarget && formatCurrency(deleteTarget.origin.amount, deleteTarget.origin.currency)}
                    </strong>{" "}
                    on{" "}
                    <strong className="text-foreground">
                      {deleteTarget?.origin.invoice_number}
                    </strong>
                    . The invoice status will be recalculated. You&apos;ll need to re-enter a
                    new payment if needed.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : isBatch ? `Delete ${deleteTarget?.batch.length} payments` : "Delete payment"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
