"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client } from "@/lib/types";

interface ClientSelectorProps {
  selectedId: string | null;
  onSelect: (client: Client) => void;
}

export function ClientSelector({ selectedId, onSelect }: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const supabase = createClient();

  // New client form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newCreditLimit, setNewCreditLimit] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("name", { ascending: true });
    setClients(data || []);
  }

  function openNewClientDialog() {
    setOpen(false);
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewCompany("");
    setNewAddress("");
    setNewNotes("");
    setNewCreditLimit(0);
    setFormError("");
    setDialogOpen(true);
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!newName.trim()) {
      setFormError("Client name is required.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: newClient, error } = await supabase
        .from("clients")
        .insert({
          user_id: user.id,
          name: newName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim(),
          company: newCompany.trim(),
          address: newAddress.trim(),
          notes: newNotes.trim(),
          credit_limit: newCreditLimit,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local list and auto-select
      setClients((prev) => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
      onSelect(newClient);
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const selected = clients.find((c) => c.id === selectedId);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            type="button"
          >
            {selected ? (
              <span>
                {selected.name}
                {selected.company && (
                  <span className="ml-2 text-muted-foreground">({selected.company})</span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">Select a client...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search clients..." />
            <CommandList>
              <CommandEmpty>
                <div className="py-2 text-center">
                  <p className="text-sm text-muted-foreground">No clients found.</p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="mt-1 gap-1"
                    onClick={openNewClientDialog}
                  >
                    <Plus className="h-3 w-3" /> Add new client
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`${client.name} ${client.company}`}
                    onSelect={() => {
                      onSelect(client);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedId === client.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div>
                      <div className="font-medium">{client.name}</div>
                      {client.company && (
                        <div className="text-xs text-muted-foreground">{client.company}</div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {/* Always show "Add new client" at the bottom */}
              <div className="border-t p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 font-normal"
                  onClick={openNewClientDialog}
                >
                  <Plus className="h-4 w-4" /> Add new client
                </Button>
              </div>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* New Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateClient} className="space-y-4">
            {formError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-name">Name *</Label>
                <Input
                  id="new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Client name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="client@example.com"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-phone">Phone</Label>
                <Input
                  id="new-phone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+212 6XX-XXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-company">Company</Label>
                <Input
                  id="new-company"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="Company name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-address">Address</Label>
              <Input
                id="new-address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Full address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-credit-limit">Credit Limit ($)</Label>
              <Input
                id="new-credit-limit"
                type="number"
                min={0}
                step="0.01"
                value={newCreditLimit}
                onChange={(e) => setNewCreditLimit(parseFloat(e.target.value) || 0)}
                placeholder="0 = Unlimited"
              />
              <p className="text-xs text-muted-foreground">
                0 = unlimited
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-notes">Notes</Label>
              <Textarea
                id="new-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notes..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create Client"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
