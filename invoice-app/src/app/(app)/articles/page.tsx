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
import {
  Plus,
  Search,
  Package,
  ArrowUpDown,
  AlertTriangle,
  XCircle,
  Trash2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Article, ArticleType } from "@/lib/types";

type FilterType = "all" | "product" | "service";
type SortField = "name" | "sku" | "type" | "unit_price" | "stock_quantity";

type DeleteTarget = {
  ids: string[];
  label: string;
  isBulk: boolean;
};

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
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
      .from("articles")
      .select("*")
      .order("name", { ascending: true });
    setArticles(data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let list = [...articles];

    if (filterType !== "all") {
      list = list.filter((a) => a.type === filterType);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.sku.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";

      if (sortField === "stock_quantity") {
        va = a.stock_quantity ?? -1;
        vb = b.stock_quantity ?? -1;
      } else if (sortField === "unit_price") {
        va = a.unit_price;
        vb = b.unit_price;
      } else {
        va = a[sortField] as string;
        vb = b[sortField] as string;
      }

      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [articles, search, filterType, sortField, sortDir]);

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
    filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)));
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

    await supabase.from("articles").delete().in("id", deleteTarget.ids);

    setArticles((prev) => prev.filter((a) => !deleteTarget.ids.includes(a.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      deleteTarget.ids.forEach((id) => next.delete(id));
      return next;
    });

    setDeleting(false);
    setDeleteTarget(null);
  }

  const stockAlerts = articles.filter(
    (a) =>
      a.type === "product" &&
      a.is_active &&
      a.stock_quantity !== null &&
      a.stock_quantity <= a.min_stock_alert
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading articles...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Articles</h1>
          <p className="text-muted-foreground">{articles.length} total articles</p>
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
                  label: `${selectedIds.size} article${selectedIds.size > 1 ? "s" : ""}`,
                  isBulk: true,
                })
              }
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selectedIds.size})
            </Button>
          )}
          <Link href="/articles/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Article
            </Button>
          </Link>
        </div>
      </div>

      {/* Stock alerts banner */}
      {stockAlerts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {stockAlerts.length} article{stockAlerts.length > 1 ? "s" : ""} with low stock
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "product", "service"] as FilterType[]).map((type) => (
            <Button
              key={type}
              variant={filterType === type ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFilterType(type)}
            >
              {type === "all" ? "All" : type === "product" ? "Products" : "Services"}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Package className="mx-auto mb-2 h-10 w-10 opacity-40" />
            <p>No articles found</p>
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
                <TableHead className="cursor-pointer" onClick={() => toggleSort("sku")}>
                  <span className="flex items-center gap-1">
                    SKU <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                  <span className="flex items-center gap-1">
                    Name <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead
                  className="hidden cursor-pointer sm:table-cell"
                  onClick={() => toggleSort("type")}
                >
                  <span className="flex items-center gap-1">
                    Type <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => toggleSort("unit_price")}
                >
                  <span className="flex items-center justify-end gap-1">
                    Price <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="hidden md:table-cell text-right">Tax</TableHead>
                <TableHead
                  className="hidden cursor-pointer md:table-cell text-right"
                  onClick={() => toggleSort("stock_quantity")}
                >
                  <span className="flex items-center justify-end gap-1">
                    Stock <ArrowUpDown className="h-3 w-3" />
                  </span>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((article) => {
                const isRupture =
                  article.type === "product" && article.stock_quantity === 0;
                const isLowStock =
                  article.type === "product" &&
                  article.stock_quantity !== null &&
                  article.min_stock_alert > 0 &&
                  article.stock_quantity > 0 &&
                  article.stock_quantity <= article.min_stock_alert;
                const isSelected = selectedIds.has(article.id);

                return (
                  <TableRow
                    key={article.id}
                    className={!article.is_active ? "opacity-50" : ""}
                    data-state={isSelected ? "selected" : undefined}
                  >
                    <TableCell className="px-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(article.id)}
                        aria-label={`Select ${article.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{article.sku}</TableCell>
                    <TableCell>
                      <Link
                        href={`/articles/${article.id}`}
                        className="font-medium hover:underline"
                      >
                        {article.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={article.type === "product" ? "outline" : "secondary"}>
                        {article.type === "product" ? "Product" : "Service"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(article.unit_price)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      {article.tax_rate}%
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      {article.type === "product" ? (
                        <span className="flex items-center justify-end gap-1">
                          {isRupture && <XCircle className="h-3 w-3 text-red-500" />}
                          {isLowStock && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                          <span
                            className={
                              isRupture
                                ? "text-red-600 font-medium"
                                : isLowStock
                                  ? "text-amber-600"
                                  : ""
                            }
                          >
                            {article.stock_quantity}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant={article.is_active ? "default" : "outline"}>
                        {article.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          setDeleteTarget({
                            ids: [article.id],
                            label: article.name,
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
              {deleteTarget?.isBulk ? "Delete Articles" : "Delete Article"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.isBulk
                ? `Are you sure you want to delete ${deleteTarget.label}? This action cannot be undone.`
                : `Are you sure you want to delete "${deleteTarget?.label}"? This action cannot be undone.`}
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
