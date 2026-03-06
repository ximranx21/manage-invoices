"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Article, ArticleFormData } from "@/lib/types";

interface ArticleFormProps {
  article?: Article;
}

export function ArticleForm({ article }: ArticleFormProps) {
  const isEdit = !!article;
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<ArticleFormData>({
    name: article?.name || "",
    description: article?.description || "",
    type: article?.type || "product",
    unit_price: article?.unit_price || 0,
    tax_rate: article?.tax_rate || 20,
    stock_quantity: article?.stock_quantity ?? (article ? null : 0),
    min_stock_alert: article?.min_stock_alert || 5,
    is_active: article?.is_active ?? true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: keyof ArticleFormData, value: string | number | boolean | null) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      // If type changes to service, clear stock fields
      if (field === "type" && value === "service") {
        updated.stock_quantity = null;
        updated.min_stock_alert = 0;
      }
      // If type changes to product, set stock defaults
      if (field === "type" && value === "product") {
        updated.stock_quantity = 0;
        updated.min_stock_alert = 5;
      }
      return updated;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Please enter an article name.");
      return;
    }

    if (form.unit_price < 0) {
      setError("Unit price cannot be negative.");
      return;
    }

    setSaving(true);

    try {
      if (isEdit) {
        const { error: updateError } = await supabase
          .from("articles")
          .update({
            name: form.name,
            description: form.description,
            unit_price: form.unit_price,
            tax_rate: form.tax_rate,
            stock_quantity: form.type === "product" ? form.stock_quantity : null,
            min_stock_alert: form.type === "product" ? form.min_stock_alert : 0,
            is_active: form.is_active,
          })
          .eq("id", article.id);

        if (updateError) throw updateError;
        router.push(`/articles/${article.id}`);
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: newArticle, error: insertError } = await supabase
          .from("articles")
          .insert({
            user_id: user.id,
            name: form.name,
            description: form.description,
            type: form.type,
            sku: "",
            unit_price: form.unit_price,
            tax_rate: form.tax_rate,
            stock_quantity: form.type === "product" ? form.stock_quantity : null,
            min_stock_alert: form.type === "product" ? form.min_stock_alert : 0,
            is_active: form.is_active,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        router.push(`/articles/${newArticle.id}`);
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
        <Link href={isEdit ? `/articles/${article.id}` : "/articles"}>
          <Button variant="ghost" size="sm" type="button" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Article" : "New Article"}</h1>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Article Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Article name"
                required
              />
            </div>
            {!isEdit && (
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select value={form.type} onValueChange={(v) => updateField("type", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isEdit && (
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={article.sku} disabled />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Article description..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="unit_price">Unit Price</Label>
              <Input
                id="unit_price"
                type="number"
                min={0}
                step="0.01"
                value={form.unit_price}
                onChange={(e) => updateField("unit_price", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_rate">Tax Rate (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.tax_rate}
                onChange={(e) => updateField("tax_rate", parseFloat(e.target.value) || 0)}
                placeholder="20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {form.type === "product" && (
        <Card>
          <CardHeader>
            <CardTitle>Stock Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stock_quantity">Stock Quantity</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  min={0}
                  value={form.stock_quantity ?? 0}
                  onChange={(e) => updateField("stock_quantity", parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_stock_alert">Min Stock Alert</Label>
                <Input
                  id="min_stock_alert"
                  type="number"
                  min={0}
                  value={form.min_stock_alert}
                  onChange={(e) => updateField("min_stock_alert", parseInt(e.target.value) || 0)}
                  placeholder="5"
                />
                <p className="text-xs text-muted-foreground">
                  Alert when stock falls to this level or below
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <Label htmlFor="is_active" className="text-base font-medium">Active</Label>
            <p className="text-sm text-muted-foreground">
              Inactive articles won&apos;t appear in the invoice form
            </p>
          </div>
          <Switch
            id="is_active"
            checked={form.is_active}
            onCheckedChange={(v) => updateField("is_active", v)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href={isEdit ? `/articles/${article.id}` : "/articles"}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : isEdit ? "Update Article" : "Create Article"}
        </Button>
      </div>
    </form>
  );
}
