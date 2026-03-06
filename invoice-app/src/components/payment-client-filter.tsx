"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client } from "@/lib/types";

interface PaymentClientFilterProps {
  clients: Client[];
  selectedClientId?: string;
}

export function PaymentClientFilter({ clients, selectedClientId }: PaymentClientFilterProps) {
  const router = useRouter();

  function handleChange(value: string) {
    if (value === "all") {
      router.push("/payments");
    } else {
      router.push(`/payments?client=${value}`);
    }
  }

  return (
    <Select value={selectedClientId ?? "all"} onValueChange={handleChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="All clients" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All clients</SelectItem>
        {clients.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
