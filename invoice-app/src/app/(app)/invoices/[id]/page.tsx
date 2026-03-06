import { getInvoice, calculateTotal, calculateSubtotal, calculateTax, calculateTotalPaid, calculateRemainingBalance, getEffectiveStatus } from "@/lib/invoices";
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
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { InvoiceActions } from "@/components/invoice-actions";
import { PaymentDialog } from "@/components/payment-dialog";
import { PaymentList } from "@/components/payment-list";
import { formatCurrency } from "@/lib/utils";
import { statusConfig } from "@/lib/constants";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) notFound();

  const subtotal = calculateSubtotal(invoice);
  const tax = calculateTax(invoice);
  const total = calculateTotal(invoice);
  const totalPaid = calculateTotalPaid(invoice);
  const remaining = calculateRemainingBalance(invoice);
  const effectiveStatus = getEffectiveStatus(invoice);
  const items = invoice.invoice_items || [];
  const payments = invoice.payments || [];

  const fmt = (amount: number) => formatCurrency(amount, invoice.currency);
  const sc = statusConfig[effectiveStatus];
  const paymentPercent = total > 0 ? Math.min((totalPaid / total) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      {/* Print-only header */}
      <div className="hidden print:block print:mb-6 print:border-b print:pb-4">
        <h1 className="text-3xl font-bold tracking-tight">INVOICE</h1>
        <p className="text-lg text-muted-foreground mt-1">{invoice.invoice_number}</p>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold print:hidden">{invoice.invoice_number}</h1>
            <Badge variant={sc.variant} className="text-sm">
              {sc.label}
            </Badge>
            <Badge variant="outline" className="text-sm">
              {invoice.currency}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">{invoice.client}</p>
        </div>
        <div className="print:hidden">
          <InvoiceActions invoice={invoice} />
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Invoice Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Client</p>
              <p className="mt-1 font-medium">{invoice.client}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
              <p className="mt-1 font-medium">{invoice.email || "\u2014"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issue Date</p>
              <p className="mt-1 font-medium">{format(new Date(invoice.date), "MMM d, yyyy")}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Due Date</p>
              <p className="mt-1 font-medium">{format(new Date(invoice.due_date), "MMM d, yyyy")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Line Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="w-20 text-right">Qty</TableHead>
                <TableHead className="w-28 text-right">Price</TableHead>
                <TableHead className="w-20 text-right hidden sm:table-cell">Tax</TableHead>
                <TableHead className="w-28 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{fmt(item.price)}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{item.tax_rate}%</TableCell>
                  <TableCell className="text-right font-medium">
                    {fmt(item.quantity * item.price * (1 + item.tax_rate / 100))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator />
          <div className="px-4 py-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal (HT)</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax (TVA)</span>
              <span>{fmt(tax)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-lg font-bold">
              <span>Total (TTC)</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      <Card className="print:hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Payments
            </CardTitle>
            {effectiveStatus !== "paid" && (
              <PaymentDialog
                invoice={invoice}
                remainingBalance={remaining}
                invoiceTotal={total}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Payment progress */}
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {fmt(totalPaid)} paid of {fmt(total)}
              </span>
              <span className={remaining > 0 ? "font-medium text-amber-600" : "font-medium text-green-600"}>
                {remaining > 0 ? `${fmt(remaining)} remaining` : "Fully paid"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  paymentPercent >= 100 ? "bg-green-500" : paymentPercent > 0 ? "bg-blue-500" : "bg-muted"
                }`}
                style={{ width: `${paymentPercent}%` }}
              />
            </div>
          </div>

          <PaymentList
            payments={payments}
            currency={invoice.currency}
          />
        </CardContent>
      </Card>

      {/* Notes */}
      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
