import { getQuotes, calculateQuoteTotal } from "@/lib/quotes";
import { formatCurrency } from "@/lib/utils";
import { quoteStatusConfig } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import Link from "next/link";
import { FileSearch, Plus } from "lucide-react";
import type { QuoteStatus } from "@/lib/types";

export default async function DevisPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;

  const allQuotes = await getQuotes();

  const quotes = statusFilter
    ? allQuotes.filter((q) => q.status === statusFilter)
    : allQuotes;

  const statusCounts = allQuotes.reduce<Record<string, number>>(
    (acc, q) => {
      acc[q.status] = (acc[q.status] || 0) + 1;
      return acc;
    },
    {}
  );

  const filterTabs: { label: string; value: string | null; count?: number }[] = [
    { label: "All", value: null, count: allQuotes.length },
    { label: "Draft", value: "draft", count: statusCounts["draft"] || 0 },
    { label: "Sent", value: "sent", count: statusCounts["sent"] || 0 },
    { label: "Accepted", value: "accepted", count: statusCounts["accepted"] || 0 },
    { label: "Declined", value: "declined", count: statusCounts["declined"] || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <Link href="/devis/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Quote
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => {
          const href = tab.value ? `/devis?status=${tab.value}` : "/devis";
          const isActive = (statusFilter ?? null) === tab.value;
          return (
            <Link key={tab.label} href={href}>
              <Button
                variant={isActive ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`rounded-full px-1.5 text-xs ${
                      isActive ? "bg-white/20" : "bg-muted"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </Button>
            </Link>
          );
        })}
      </div>

      {/* Table */}
      {quotes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileSearch className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p className="font-medium">No quotes found</p>
            <p className="mt-1 text-sm">
              {statusFilter ? `No ${statusFilter} quotes.` : "Create your first quote."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Expires</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => {
                const total = calculateQuoteTotal(quote);
                const isExpired =
                  quote.status !== "accepted" &&
                  quote.status !== "declined" &&
                  new Date(quote.expiry_date) < new Date();
                return (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <Link
                        href={`/devis/${quote.id}`}
                        className="font-medium hover:underline"
                      >
                        {quote.quote_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{quote.client}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {format(new Date(quote.date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      <span className={isExpired ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {format(new Date(quote.expiry_date), "dd/MM/yyyy")}
                        {isExpired && " (expired)"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(total, quote.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={quoteStatusConfig[quote.status as QuoteStatus].variant}>
                        {quoteStatusConfig[quote.status as QuoteStatus].label}
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
  );
}
