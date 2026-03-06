import { getInvoice } from "@/lib/invoices";
import { notFound } from "next/navigation";
import { InvoiceForm } from "@/components/invoice-form";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) notFound();

  return <InvoiceForm invoice={invoice} />;
}
