"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Users, ArrowUpDown, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { Client } from "@/lib/types";

type SortField = "name" | "email" | "company" | "created_at";

type DeleteTarget = {
  ids: string[];
  label: string;
  isBulk: boolean;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("name", { ascending: true });
    setClients(data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let list = [...clients];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const va = a[sortField] as string;
      const vb = b[sortField] as string;
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [clients, search, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // ── Selection ───────────────────────────────────
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Delete ──────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    await supabase.from("clients").delete().in("id", deleteTarget.ids);

    setClients((prev) => prev.filter((c) => !deleteTarget.ids.includes(c.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      deleteTarget.ids.forEach((id) => next.delete(id));
      return next;
    });

    setDeleting(false);
    setDeleteTarget(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">{clients.length} total clients</p>
        </div>
        <div className="flex items-center gap-2">
          {someSelected && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() =>
                setDeleteTarget({
                  ids: Array.from(selectedIds),
                  label: `${selectedIds.size} client${selectedIds.size > 1 ? "s" : ""}`,
                  isBulk: true,
                })
              }
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selectedIds.size})
            </Button>
          )}
          <Link href="/clients/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Client
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 h-10 w-10 opacity-40" />
            <p>No clients found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-4">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                  <span className="flex items-center gap-1">
                    Name <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("email")}>
                  <span className="flex items-center gap-1">
                    Email <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead
                  className="hidden cursor-pointer sm:table-cell"
                  onClick={() => toggleSort("company")}
                >
                  <span className="flex items-center gap-1">
                    Company <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead
                  className="hidden cursor-pointer lg:table-cell"
                  onClick={() => toggleSort("created_at")}
                >
                  <span className="flex items-center gap-1">
                    Created <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => {
                const isSelected = selectedIds.has(client.id);
                return (
                  <TableRow key={client.id} data-state={isSelected ? "selected" : undefined}>
                    <TableCell className="px-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(client.id)}
                        aria-label={`Select ${client.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-medium hover:underline"
                      >
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell>{client.email || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {client.company || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {client.phone || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {format(new Date(client.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          setDeleteTarget({
                            ids: [client.id],
                            label: client.name,
                            isBulk: false,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.isBulk ? "Delete Clients" : "Delete Client"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.isBulk
                ? `Are you sure you want to delete ${deleteTarget.label}? Their invoices will be kept but unlinked.`
                : `Are you sure you want to delete "${deleteTarget?.label}"? Their invoices will be kept but unlinked.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
