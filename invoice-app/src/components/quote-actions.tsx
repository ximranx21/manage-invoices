"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  ArrowLeft,
  Pencil,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import type { Quote } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface QuoteActionsProps {
  quote: Quote;
}

interface StockIssue {
  name: string;
  available: number;
  needed: number;
}

function calculateDueDate(issueDate: string, days: number): string {
  const date = new Date(issueDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

export function QuoteActions({ quote }: QuoteActionsProps) {
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  async function handleStatusChange(newStatus: Quote["status"]) {
    setStatusLoading(true);
    const supabase = createClient();
    await supabase.from("quotes").update({ status: newStatus }).eq("id", quote.id);
    setStatusLoading(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("quotes").delete().eq("id", quote.id);
    router.push("/devis");
  }

  async function handleConvertToInvoice() {
    setConverting(true);
    const supabase = createClient();

    // Check stock for all product articles
    const issues: StockIssue[] = [];
    for (const item of quote.quote_items || []) {
      if (item.article_id) {
        const { data: article } = await supabase
          .from("articles")
          .select("type, stock_quantity, name")
          .eq("id", item.article_id)
          .single();

        if (article && article.type === "product" && article.stock_quantity !== null) {
          if (item.quantity > article.stock_quantity) {
            issues.push({
              name: article.name,
              available: article.stock_quantity,
              needed: item.quantity,
            });
          }
        }
      }
    }

    if (issues.length > 0) {
      // Revert quote status to "sent"
      await supabase.from("quotes").update({ status: "sent" }).eq("id", quote.id);
      setStockIssues(issues);
      setShowStockDialog(true);
      setConverting(false);
      router.refresh();
      return;
    }

    // All stock OK → create invoice
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setConverting(false);
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .insert({
        user_id: user.id,
        invoice_number: "",
        client: quote.client,
        email: quote.email,
        client_id: quote.client_id,
        date: today,
        due_date: calculateDueDate(today, 30),
        status: "unpaid",
        notes: quote.notes || "",
        currency: quote.currency,
      })
      .select()
      .single();

    if (invError) {
      setConverting(false);
      return;
    }

    // Insert invoice items from quote
    await supabase.from("invoice_items").insert(
      (quote.quote_items || []).map((it) => ({
        invoice_id: invoice.id,
        description: it.description,
        quantity: it.quantity,
        price: it.price,
        article_id: it.article_id,
        tax_rate: it.tax_rate,
      }))
    );

    // Deduct stock for product articles
    for (const item of quote.quote_items || []) {
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

    // Link invoice to quote
    await supabase
      .from("quotes")
      .update({ invoice_id: invoice.id })
      .eq("id", quote.id);

    setConverting(false);
    router.push(`/invoices/${invoice.id}`);
  }

  const isExpired =
    quote.status !== "accepted" &&
    quote.status !== "declined" &&
    new Date(quote.expiry_date) < new Date();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/devis">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>

        {/* Status action buttons */}
        {quote.status === "draft" && (
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => handleStatusChange("sent")}
            disabled={statusLoading}
          >
            <Send className="h-4 w-4" /> Mark as Sent
          </Button>
        )}

        {quote.status === "sent" && (
          <>
            <Button
              size="sm"
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => handleStatusChange("accepted")}
              disabled={statusLoading}
            >
              <CheckCircle className="h-4 w-4" /> Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => handleStatusChange("declined")}
              disabled={statusLoading}
            >
              <XCircle className="h-4 w-4" /> Decline
            </Button>
          </>
        )}

        {quote.status === "accepted" && !quote.invoice_id && (
          <Button
            size="sm"
            className="gap-2"
            onClick={handleConvertToInvoice}
            disabled={converting}
          >
            <FileText className="h-4 w-4" />
            {converting ? "Converting..." : "Convert to Invoice"}
          </Button>
        )}

        {quote.invoice_id && (
          <Link href={`/invoices/${quote.invoice_id}`}>
            <Button size="sm" variant="outline" className="gap-2">
              <FileText className="h-4 w-4" /> View Invoice
            </Button>
          </Link>
        )}

        {/* Edit — only if not accepted/declined */}
        {(quote.status === "draft" || quote.status === "sent") && (
          <Link href={`/devis/${quote.id}/edit`}>
            <Button size="sm" variant="outline" className="gap-2">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          </Link>
        )}

        <Button
          size="sm"
          variant="destructive"
          className="gap-2"
          onClick={() => setShowDelete(true)}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete quote{" "}
              <strong>{quote.quote_number}</strong>?
              {quote.invoice_id && (
                <span className="mt-2 block text-amber-600">
                  Note: The linked invoice will not be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stock issues dialog */}
      <AlertDialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cannot Convert — Insufficient Stock
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  The following articles don&apos;t have enough stock. The quote has been reverted
                  to <strong>Sent</strong>. Please update your stock or adjust the quantities.
                </p>
                <div className="rounded-md border bg-muted/50 px-3 py-2">
                  <div className="mb-1 grid grid-cols-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Article</span>
                    <span className="text-center">Available</span>
                    <span className="text-center">Needed</span>
                  </div>
                  {stockIssues.map((issue, i) => (
                    <div key={i} className="grid grid-cols-3 border-t py-1 text-sm">
                      <span className="font-medium text-foreground">{issue.name}</span>
                      <span className="text-center text-red-600">{issue.available}</span>
                      <span className="text-center">{issue.needed}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <Link href="/articles">
              <Button variant="outline">Go to Articles</Button>
            </Link>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
