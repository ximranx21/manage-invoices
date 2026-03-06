import { getClient, getClientInvoices } from "@/lib/clients";
import { calculateTotal, calculateRemainingBalance, getEffectiveStatus } from "@/lib/invoices";
import { computeSettlement } from "@/lib/payments";
import { formatCurrency } from "@/lib/utils";
import { statusConfig, PAYMENT_TYPE_LABELS } from "@/lib/constants";
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
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";
import { ClientActions } from "@/components/client-actions";
import { PaymentMultiDialog } from "@/components/payment-multi-dialog";
import { FileText, Plus, Wallet } from "lucide-react";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);

  if (!client) notFound();

  const invoices = await getClientInvoices(id);

  // Invoices with remaining balance > 0 (for multi-payment dialog)
  const invoicesWithBalance = invoices.filter((inv) => calculateRemainingBalance(inv) > 0);

  const totalRevenue = invoices.reduce((sum, inv) => sum + calculateTotal(inv), 0);

  const paidInvoices = invoices.filter((inv) => inv.status === "paid");
  const paidRevenue = paidInvoices.reduce((sum, inv) => sum + calculateTotal(inv), 0);

  const outstandingInvoices = invoices.filter((inv) => {
    const eff = getEffectiveStatus(inv);
    return eff === "unpaid" || eff === "delayed" || eff === "partially_paid";
  });
  const outstandingAmount = outstandingInvoices.reduce(
    (sum, inv) => sum + calculateRemainingBalance(inv),
    0
  );

  const creditLimit = client.credit_limit || 0;
  const creditUsagePercent =
    creditLimit > 0 ? Math.min((outstandingAmount / creditLimit) * 100, 100) : 0;

  // Build payment rows from loaded invoices (newest first)
  const paymentRows = invoices
    .flatMap((inv) => {
      const invTotal = calculateTotal(inv);
      const allPayments = inv.payments || [];
      return allPayments.map((p) => ({
        id: p.id,
        amount: p.amount,
        payment_date: p.payment_date,
        payment_type: p.payment_type,
        reference: p.reference ?? null,
        created_at: p.created_at,
        invoice_number: inv.invoice_number,
        invoice_id: inv.id,
        currency: inv.currency,
        settlement: computeSettlement(p.id, allPayments, invTotal),
      }));
    })
    .sort((a, b) => {
      const d = new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime();
      return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          {client.company && <p className="mt-1 text-muted-foreground">{client.company}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {invoicesWithBalance.length > 0 && (
            <PaymentMultiDialog invoices={invoicesWithBalance} />
          )}
          <ClientActions client={client} />
        </div>
      </div>

      {/* Client Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Client Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Name
              </p>
              <p className="mt-1 font-medium">{client.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email
              </p>
              <p className="mt-1 font-medium">{client.email || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Phone
              </p>
              <p className="mt-1 font-medium">{client.phone || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Company
              </p>
              <p className="mt-1 font-medium">{client.company || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Credit Limit
              </p>
              <p className="mt-1 font-medium">
                {creditLimit > 0 ? formatCurrency(creditLimit) : "Unlimited"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Address
              </p>
              <p className="mt-1 font-medium">{client.address || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {client.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{client.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total Invoices
            </p>
            <p className="mt-1 text-2xl font-bold">{invoices.length}</p>
            <p className="text-sm text-muted-foreground">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Paid
            </p>
            <p className="mt-1 text-2xl font-bold text-green-600">{paidInvoices.length}</p>
            <p className="text-sm text-muted-foreground">{formatCurrency(paidRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Outstanding
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-600">
              {outstandingInvoices.length}
            </p>
            <p className="text-sm text-muted-foreground">{formatCurrency(outstandingAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Credit Limit */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Credit Limit
            </p>
            <p className="text-sm font-medium">
              {creditLimit > 0 ? formatCurrency(creditLimit) : "Unlimited"}
            </p>
          </div>
          {creditLimit > 0 ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatCurrency(outstandingAmount)} used of {formatCurrency(creditLimit)}
                </span>
                <span
                  className={
                    creditUsagePercent >= 100
                      ? "font-semibold text-red-600"
                      : creditUsagePercent >= 80
                        ? "font-semibold text-amber-600"
                        : "text-muted-foreground"
                  }
                >
                  {creditUsagePercent.toFixed(0)}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    creditUsagePercent >= 100
                      ? "bg-red-500"
                      : creditUsagePercent >= 80
                        ? "bg-amber-500"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(creditUsagePercent, 100)}%` }}
                />
              </div>
              {creditUsagePercent >= 100 && (
                <p className="text-xs font-medium text-red-600">
                  Credit limit exceeded — new invoices will be blocked.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Remaining: {formatCurrency(Math.max(creditLimit - outstandingAmount, 0))}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No credit limit set. This client can have unlimited outstanding invoices.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invoices</h2>
          <Link href="/invoices/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          </Link>
        </div>

        {invoices.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <FileText className="mx-auto mb-2 h-10 w-10 opacity-40" />
              <p>No invoices for this client yet</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="hidden md:table-cell">Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const effectiveStatus = getEffectiveStatus(inv);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-medium hover:underline"
                        >
                          {inv.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {format(new Date(inv.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {format(new Date(inv.due_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(calculateTotal(inv), inv.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[effectiveStatus].variant}>
                          {statusConfig[effectiveStatus].label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Payment History */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Payment History</h2>
          <span className="text-sm text-muted-foreground">
            {paymentRows.length} payment{paymentRows.length !== 1 ? "s" : ""}
          </span>
        </div>

        {paymentRows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Wallet className="mx-auto mb-2 h-10 w-10 opacity-40" />
              <p>No payments recorded yet</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      {format(new Date(p.payment_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <Link href={`/invoices/${p.invoice_id}`} className="text-sm font-medium hover:underline">
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
