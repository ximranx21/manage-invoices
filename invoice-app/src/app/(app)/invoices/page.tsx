"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Search, FileText, ArrowUpDown, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { statusConfig } from "@/lib/constants";
import type { Invoice, InvoiceStatus } from "@/lib/types";

function invoiceTotal(inv: Invoice): number {
  return (inv.invoice_items || []).reduce(
    (sum, it) => sum + it.quantity * it.price * (1 + (it.tax_rate || 0) / 100),
    0
  );
}

function getEffectiveStatus(inv: Invoice): InvoiceStatus {
  if (
    (inv.status === "unpaid" || inv.status === "partially_paid") &&
    inv.due_date &&
    new Date(inv.due_date) < new Date()
  ) {
    return "delayed";
  }
  return inv.status;
}

const filters: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "delayed", label: "Delayed" },
];

type SortField = "invoice_number" | "client" | "date" | "due_date" | "amount" | "status";

type DeleteTarget = {
  ids: string[];
  label: string;
  isBulk: boolean;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .order("created_at", { ascending: false });
    setInvoices(data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let list = [...invoices];

    if (filter !== "all") {
      list = list.filter((i) => getEffectiveStatus(i) === filter);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.invoice_number.toLowerCase().includes(q) ||
          i.client.toLowerCase().includes(q) ||
          i.email.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let va: string | number = a[sortField as keyof Invoice] as string;
      let vb: string | number = b[sortField as keyof Invoice] as string;
      if (sortField === "amount") {
        va = invoiceTotal(a);
        vb = invoiceTotal(b);
      }
      if (sortField === "status") {
        va = getEffectiveStatus(a);
        vb = getEffectiveStatus(b);
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [invoices, filter, search, sortField, sortDir]);

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
    filtered.length > 0 && filtered.every((inv) => selectedIds.has(inv.id));
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((inv) => inv.id)));
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
  async function restoreStock(ids: string[]) {
    const affected = invoices.filter((inv) => ids.includes(inv.id));
    const itemsWithArticle = affected
      .flatMap((inv) => inv.invoice_items || [])
      .filter((item) => item.article_id);

    if (itemsWithArticle.length === 0) return;

    // Aggregate qty per article
    const qtyMap = new Map<string, number>();
    for (const item of itemsWithArticle) {
      qtyMap.set(item.article_id!, (qtyMap.get(item.article_id!) || 0) + item.quantity);
    }

    // Restore stock only for product-type articles
    for (const [articleId, qty] of qtyMap.entries()) {
      const { data: article } = await supabase
        .from("articles")
        .select("type, stock_quantity")
        .eq("id", articleId)
        .single();

      if (article && article.type === "product" && article.stock_quantity !== null) {
        await supabase
          .from("articles")
          .update({ stock_quantity: article.stock_quantity + qty })
          .eq("id", articleId);
      }
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    await restoreStock(deleteTarget.ids);
    await supabase.from("invoices").delete().in("id", deleteTarget.ids);

    // Update local state
    setInvoices((prev) => prev.filter((inv) => !deleteTarget.ids.includes(inv.id)));
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
        <div className="text-muted-foreground">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">{invoices.length} total invoices</p>
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
                  label: `${selectedIds.size} invoice${selectedIds.size > 1 ? "s" : ""}`,
                  isBulk: true,
                })
              }
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selectedIds.size})
            </Button>
          )}
          <Link href="/invoices/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {filters.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <FileText className="mx-auto mb-2 h-10 w-10 opacity-40" />
            <p>No invoices found</p>
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
                <TableHead
                  className="cursor-pointer"
                  onClick={() => toggleSort("invoice_number")}
                >
                  <span className="flex items-center gap-1">
                    Invoice <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("client")}>
                  <span className="flex items-center gap-1">
                    Client <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead
                  className="hidden cursor-pointer sm:table-cell"
                  onClick={() => toggleSort("date")}
                >
                  <span className="flex items-center gap-1">
                    Date <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead
                  className="hidden cursor-pointer md:table-cell"
                  onClick={() => toggleSort("due_date")}
                >
                  <span className="flex items-center gap-1">
                    Due Date <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => toggleSort("amount")}
                >
                  <span className="flex items-center justify-end gap-1">
                    Amount <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1">
                    Status <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => {
                const es = getEffectiveStatus(inv);
                const sc = statusConfig[es];
                const isSelected = selectedIds.has(inv.id);
                return (
                  <TableRow key={inv.id} data-state={isSelected ? "selected" : undefined}>
                    <TableCell className="px-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(inv.id)}
                        aria-label={`Select ${inv.invoice_number}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-medium hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.client}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {format(new Date(inv.date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {format(new Date(inv.due_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoiceTotal(inv), inv.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          setDeleteTarget({
                            ids: [inv.id],
                            label: inv.invoice_number,
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
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.isBulk ? "Delete Invoices" : "Delete Invoice"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.isBulk
                ? `Are you sure you want to delete ${deleteTarget.label}? This action cannot be undone. Stock will be restored for any linked products.`
                : `Are you sure you want to delete invoice ${deleteTarget?.label}? This action cannot be undone. Stock will be restored for any linked products.`}
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
