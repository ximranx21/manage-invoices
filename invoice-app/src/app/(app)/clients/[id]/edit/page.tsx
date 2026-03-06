import { getClient } from "@/lib/clients";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);

  if (!client) notFound();

  return <ClientForm client={client} />;
}
