import { getAllPaymentsWithDetails } from "@/lib/payments";
import { getClients } from "@/lib/clients";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { PaymentClientFilter } from "@/components/payment-client-filter";
import { PaymentTable } from "@/components/payment-table";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: clientId } = await searchParams;

  const [payments, clients] = await Promise.all([
    getAllPaymentsWithDetails(clientId),
    getClients(),
  ]);

  const selectedClient = clientId ? clients.find((c) => c.id === clientId) : null;

  // Group total by currency
  const totalByCurrency = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.currency] = (acc[p.currency] || 0) + p.amount;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          {selectedClient && (
            <p className="mt-1 text-muted-foreground">
              Filtered by:{" "}
              <Link href={`/clients/${selectedClient.id}`} className="font-medium hover:underline">
                {selectedClient.name}
              </Link>
            </p>
          )}
        </div>
        <PaymentClientFilter clients={clients} selectedClientId={clientId} />
      </div>

      {/* Summary */}
      {payments.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(totalByCurrency).map(([currency, total]) => (
            <Card key={currency} className="flex-1 min-w-[150px]">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total {currency}
                </p>
                <p className="mt-1 text-xl font-bold">
                  {formatCurrency(total, currency as any)}
                </p>
              </CardContent>
            </Card>
          ))}
          <Card className="flex-1 min-w-[150px]">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Transactions
              </p>
              <p className="mt-1 text-xl font-bold">{payments.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Wallet className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p className="font-medium">No payments found</p>
            {selectedClient && (
              <p className="mt-1 text-sm">No payments recorded for {selectedClient.name}.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <PaymentTable payments={payments} showClient={!selectedClient} />
        </Card>
      )}
    </div>
  );
}
