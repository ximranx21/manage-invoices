import { getInvoices, calculateStats, calculateTotal, getEffectiveStatus } from "@/lib/invoices";
import { getArticles, getStockAlerts } from "@/lib/articles";
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
import { FileText, Clock, CheckCircle, AlertTriangle, DollarSign, CreditCard, Package, XCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { statusConfig } from "@/lib/constants";

export default async function DashboardPage() {
  const [invoices, articles] = await Promise.all([getInvoices(), getArticles()]);
  const stats = calculateStats(invoices);
  const recentInvoices = invoices.slice(0, 5);
  const stockAlerts = getStockAlerts(articles);

  const statCards = [
    { title: "Total Invoices", value: stats.total, amount: stats.total, icon: FileText, color: "text-blue-600" },
    { title: "Unpaid", value: stats.unpaid, amount: stats.unpaid, icon: Clock, color: "text-amber-600" },
    { title: "Partially Paid", value: stats.partially_paid, amount: stats.partially_paid, icon: CreditCard, color: "text-blue-500" },
    { title: "Paid", value: stats.paid, amount: stats.paid, icon: CheckCircle, color: "text-green-600" },
    { title: "Delayed", value: stats.delayed, amount: stats.delayed, icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your business</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Revenue (Paid)
          </CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {stats.paid} paid invoices
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.unpaid + stats.delayed + stats.partially_paid} outstanding
          </p>
        </CardContent>
      </Card>

      {/* Stock Alerts */}
      {stockAlerts.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Stock Alerts ({stockAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stockAlerts.map((alert) => (
                <div key={alert.article.id} className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    {alert.alertType === "rupture" ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <Link href={`/articles/${alert.article.id}`} className="font-medium hover:underline">
                      {alert.article.name}
                    </Link>
                    <span className="text-xs text-muted-foreground font-mono">{alert.article.sku}</span>
                  </div>
                  <Badge variant={alert.alertType === "rupture" ? "destructive" : "outline"}>
                    {alert.alertType === "rupture" ? "Out of Stock" : `Low: ${alert.article.stock_quantity}`}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Invoices */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Invoices</h2>
          <Link href="/invoices" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {recentInvoices.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <FileText className="mx-auto mb-2 h-10 w-10 opacity-40" />
              <p>No invoices yet. Create your first invoice!</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="hidden md:table-cell">Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInvoices.map((inv) => {
                  const es = getEffectiveStatus(inv);
                  const sc = statusConfig[es];
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link href={`/invoices/${inv.id}`} className="font-medium hover:underline">
                          {inv.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{inv.client}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {format(new Date(inv.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {format(new Date(inv.due_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(calculateTotal(inv), inv.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
