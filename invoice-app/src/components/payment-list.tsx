import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_TYPE_LABELS } from "@/lib/constants";
import type { Payment, Currency, PaymentType } from "@/lib/types";

interface PaymentListProps {
  payments: Payment[];
  currency: Currency;
}

export function PaymentList({ payments, currency }: PaymentListProps) {
  const fmt = (amount: number) => formatCurrency(amount, currency);

  if (payments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No payments recorded yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead className="hidden sm:table-cell">Type</TableHead>
          <TableHead className="hidden md:table-cell">Reference</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>
              {format(new Date(payment.payment_date), "MMM d, yyyy")}
            </TableCell>
            <TableCell className="font-medium">{fmt(payment.amount)}</TableCell>
            <TableCell className="hidden sm:table-cell">
              <Badge variant="outline">
                {PAYMENT_TYPE_LABELS[payment.payment_type as PaymentType] ||
                  payment.payment_type}
              </Badge>
            </TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground">
              {payment.reference || "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
