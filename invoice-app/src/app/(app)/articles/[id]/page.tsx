import { getArticle } from "@/lib/articles";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArticleActions } from "@/components/article-actions";
import { formatCurrency } from "@/lib/utils";
import { Package, Wrench, AlertTriangle, XCircle } from "lucide-react";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticle(id);

  if (!article) notFound();

  const isProduct = article.type === "product";
  const isRupture = isProduct && article.stock_quantity === 0;
  const isLowStock =
    isProduct &&
    article.stock_quantity !== null &&
    article.min_stock_alert > 0 &&
    article.stock_quantity > 0 &&
    article.stock_quantity <= article.min_stock_alert;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{article.name}</h1>
            <Badge variant={isProduct ? "outline" : "secondary"}>
              {isProduct ? "Product" : "Service"}
            </Badge>
            {!article.is_active && (
              <Badge variant="destructive">Inactive</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground font-mono">{article.sku}</p>
        </div>
        <ArticleActions article={article} />
      </div>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle>Article Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Name
              </p>
              <p className="mt-1 font-medium">{article.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                SKU
              </p>
              <p className="mt-1 font-medium font-mono">{article.sku}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Type
              </p>
              <p className="mt-1 font-medium flex items-center gap-1">
                {isProduct ? <Package className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                {isProduct ? "Product" : "Service"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Unit Price
              </p>
              <p className="mt-1 text-xl font-bold">{formatCurrency(article.unit_price)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tax Rate (TVA)
              </p>
              <p className="mt-1 font-medium">{article.tax_rate}%</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <p className="mt-1 font-medium">{article.is_active ? "Active" : "Inactive"}</p>
            </div>
          </div>
          {article.description && (
            <div className="mt-4 border-t pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Description
              </p>
              <p className="mt-1">{article.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Management (products only) */}
      {isProduct && (
        <Card className={isRupture ? "border-red-300" : isLowStock ? "border-amber-300" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Stock Management
              {isRupture && <XCircle className="h-5 w-5 text-red-500" />}
              {isLowStock && <AlertTriangle className="h-5 w-5 text-amber-500" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Current Stock
                </p>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    isRupture ? "text-red-600" : isLowStock ? "text-amber-600" : "text-green-600"
                  }`}
                >
                  {article.stock_quantity ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Min Alert Threshold
                </p>
                <p className="mt-1 text-2xl font-bold">{article.min_stock_alert}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </p>
                <div className="mt-1">
                  {isRupture ? (
                    <Badge variant="destructive" className="text-sm">Out of Stock</Badge>
                  ) : isLowStock ? (
                    <Badge className="bg-amber-500 text-sm">Low Stock</Badge>
                  ) : (
                    <Badge variant="default" className="text-sm">In Stock</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {article.min_stock_alert > 0 && (
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isRupture
                        ? "bg-red-500"
                        : isLowStock
                          ? "bg-amber-500"
                          : "bg-green-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        ((article.stock_quantity ?? 0) / Math.max(article.min_stock_alert * 3, 1)) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                {isRupture && (
                  <p className="text-xs font-medium text-red-600">
                    Out of stock — invoices with this product will be blocked.
                  </p>
                )}
                {isLowStock && (
                  <p className="text-xs font-medium text-amber-600">
                    Low stock alert — stock is at or below the minimum threshold ({article.min_stock_alert}).
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
