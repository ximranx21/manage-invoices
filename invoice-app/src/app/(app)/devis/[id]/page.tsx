import { getQuote, calculateQuoteTotal, calculateQuoteSubtotal, calculateQuoteTax } from "@/lib/quotes";
import { formatCurrency } from "@/lib/utils";
import { quoteStatusConfig } from "@/lib/constants";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { QuoteActions } from "@/components/quote-actions";
import type { QuoteStatus } from "@/lib/types";
import { AlertTriangle, FileText } from "lucide-react";
import Link from "next/link";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  const subtotal = calculateQuoteSubtotal(quote);
  const taxTotal = calculateQuoteTax(quote);
  const total = calculateQuoteTotal(quote);
  const fmt = (amount: number) => formatCurrency(amount, quote.currency);

  const statusCfg = quoteStatusConfig[quote.status as QuoteStatus];

  const isExpired =
    quote.status !== "accepted" &&
    quote.status !== "declined" &&
    new Date(quote.expiry_date) < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{quote.quote_number}</h1>
            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            {isExpired && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Expired
              </Badge>
            )}
          </div>
          <p className="mt-1 text-muted-foreground">
            {quote.client} {quote.email && `· ${quote.email}`}
          </p>
        </div>
        <QuoteActions quote={quote} />
      </div>

      {/* Converted invoice banner */}
      {quote.invoice_id && (
        <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3">
          <FileText className="h-5 w-5 text-green-700 shrink-0" />
          <p className="text-sm text-green-800">
            This quote has been converted to an invoice.{" "}
            <Link href={`/invoices/${quote.invoice_id}`} className="font-semibold underline">
              View Invoice
            </Link>
          </p>
        </div>
      )}

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issue Date</p>
            <p className="mt-1 font-medium">{format(new Date(quote.date), "dd MMM yyyy")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valid Until</p>
            <p className={`mt-1 font-medium ${isExpired ? "text-destructive" : ""}`}>
              {format(new Date(quote.expiry_date), "dd MMM yyyy")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Currency</p>
            <p className="mt-1 font-medium">{quote.currency}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="mt-1 font-bold text-lg">{fmt(total)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Tax %</TableHead>
                <TableHead className="text-right">Total HT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(quote.quote_items || []).map((item) => {
                const lineTotal = item.quantity * item.price;
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{fmt(item.price)}</TableCell>
                    <TableCell className="text-right hidden sm:table-cell text-muted-foreground">
                      {item.tax_rate > 0 ? `${item.tax_rate}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(lineTotal)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Totals */}
          <div className="flex justify-end border-t px-6 py-4">
            <div className="w-56 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal (HT)</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax (TVA)</span>
                <span>{fmt(taxTotal)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Total (TTC)</span>
                <span>{fmt(total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {quote.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
