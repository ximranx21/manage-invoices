import { getQuote } from "@/lib/quotes";
import { notFound } from "next/navigation";
import { QuoteForm } from "@/components/quote-form";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();

  return <QuoteForm quote={quote} />;
}
