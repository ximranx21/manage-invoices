"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Client, ClientFormData } from "@/lib/types";

interface ClientFormProps {
  client?: Client;
}

export function ClientForm({ client }: ClientFormProps) {
  const isEdit = !!client;
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<ClientFormData>({
    name: client?.name || "",
    email: client?.email || "",
    phone: client?.phone || "",
    company: client?.company || "",
    address: client?.address || "",
    notes: client?.notes || "",
    credit_limit: client?.credit_limit || 0,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: keyof ClientFormData, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Please enter a client name.");
      return;
    }

    setSaving(true);

    try {
      if (isEdit) {
        const { error: updateError } = await supabase
          .from("clients")
          .update({
            name: form.name,
            email: form.email,
            phone: form.phone,
            company: form.company,
            address: form.address,
            notes: form.notes,
            credit_limit: form.credit_limit,
          })
          .eq("id", client.id);

        if (updateError) throw updateError;
        router.push(`/clients/${client.id}`);
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: newClient, error: insertError } = await supabase
          .from("clients")
          .insert({
            user_id: user.id,
            name: form.name,
            email: form.email,
            phone: form.phone,
            company: form.company,
            address: form.address,
            notes: form.notes,
            credit_limit: form.credit_limit,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        router.push(`/clients/${newClient.id}`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={isEdit ? `/clients/${client.id}` : "/clients"}>
          <Button variant="ghost" size="sm" type="button" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Client" : "New Client"}</h1>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Client name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="client@example.com"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+212 6XX-XXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={form.company}
                onChange={(e) => updateField("company", e.target.value)}
                placeholder="Company name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Full address"
            />
          </div>
        </CardContent>
      </Card>

      {/* Credit Limit */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Limit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="credit_limit">Maximum Outstanding Amount ($)</Label>
          <Input
            id="credit_limit"
            type="number"
            min={0}
            step="0.01"
            value={form.credit_limit}
            onChange={(e) => updateField("credit_limit", parseFloat(e.target.value) || 0)}
            placeholder="0 = Unlimited"
          />
          <p className="text-xs text-muted-foreground">
            Set the maximum total of unpaid and delayed invoices for this client. Set to 0 for unlimited.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Additional notes about this client..."
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href={isEdit ? `/clients/${client.id}` : "/clients"}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : isEdit ? "Update Client" : "Create Client"}
        </Button>
      </div>
    </form>
  );
}
