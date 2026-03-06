"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Pencil, Trash2, CheckCircle, Clock, Printer } from "lucide-react";
import type { Invoice, InvoiceStatus } from "@/lib/types";

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleStatusChange(status: InvoiceStatus) {
    setUpdating(true);
    await supabase.from("invoices").update({ status }).eq("id", invoice.id);
    router.refresh();
    setUpdating(false);
  }

  async function handleDelete() {
    setDeleting(true);

    // Restore stock for product articles
    if (invoice.invoice_items) {
      for (const item of invoice.invoice_items) {
        if (item.article_id) {
          const { data: article } = await supabase
            .from("articles")
            .select("type, stock_quantity")
            .eq("id", item.article_id)
            .single();

          if (article && article.type === "product" && article.stock_quantity !== null) {
            await supabase
              .from("articles")
              .update({ stock_quantity: article.stock_quantity + item.quantity })
              .eq("id", item.article_id);
          }
        }
      }
    }

    await supabase.from("invoices").delete().eq("id", invoice.id);
    router.push("/invoices");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/invoices">
        <Button variant="ghost" size="sm" className="gap-2 print:hidden">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </Link>

      <Button
        variant="outline"
        size="sm"
        className="gap-2 print:hidden"
        onClick={() => window.print()}
      >
        <Printer className="h-4 w-4" /> Print
      </Button>

      {invoice.status !== "paid" && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-green-200 text-green-700 hover:bg-green-50 print:hidden"
          onClick={() => handleStatusChange("paid")}
          disabled={updating}
        >
          <CheckCircle className="h-4 w-4" /> Mark Paid
        </Button>
      )}
      {invoice.status !== "unpaid" && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 print:hidden"
          onClick={() => handleStatusChange("unpaid")}
          disabled={updating}
        >
          <Clock className="h-4 w-4" /> Mark Unpaid
        </Button>
      )}

      <Link href={`/invoices/${invoice.id}/edit`}>
        <Button variant="outline" size="sm" className="gap-2 print:hidden">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </Link>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm" className="gap-2 print:hidden">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete invoice {invoice.invoice_number}? This action cannot be undone. Stock will be restored for any linked products.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
