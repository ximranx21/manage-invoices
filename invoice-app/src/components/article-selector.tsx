"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Check, ChevronsUpDown, Package, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { Article } from "@/lib/types";

interface ArticleSelectorProps {
  value?: string | null;
  onSelect: (article: Article) => void;
}

export function ArticleSelector({ value, onSelect }: ArticleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const supabase = createClient();

  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    const { data } = await supabase
      .from("articles")
      .select("*")
      .eq("is_active", true)
      .order("type", { ascending: true })
      .order("name", { ascending: true });
    setArticles(data || []);
  }

  const products = articles.filter((a) => a.type === "product");
  const services = articles.filter((a) => a.type === "service");
  const selected = value ? articles.find((a) => a.id === value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-xs h-8"
          type="button"
        >
          {selected ? (
            <span className="flex items-center gap-1 truncate font-mono">
              {selected.type === "product"
                ? <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
                : <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />}
              <span className="truncate">{selected.sku}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select article...</span>
          )}
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search articles..." />
          <CommandList>
            <CommandEmpty>No articles found.</CommandEmpty>
            {products.length > 0 && (
              <CommandGroup heading="Products">
                {products.map((article) => (
                  <CommandItem
                    key={article.id}
                    value={`${article.name} ${article.sku}`}
                    onSelect={() => {
                      onSelect(article);
                      setOpen(false);
                    }}
                  >
                    <Package className="mr-2 h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{article.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{article.sku}</span>
                        <span>{formatCurrency(article.unit_price)}</span>
                        {article.stock_quantity !== null && (
                          <span
                            className={cn(
                              article.stock_quantity === 0
                                ? "text-red-600 font-medium"
                                : article.stock_quantity <= article.min_stock_alert
                                  ? "text-amber-600"
                                  : ""
                            )}
                          >
                            Stock: {article.stock_quantity}
                          </span>
                        )}
                      </div>
                    </div>
                    {value === article.id && (
                      <Check className="ml-2 h-3 w-3 shrink-0 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {services.length > 0 && (
              <CommandGroup heading="Services">
                {services.map((article) => (
                  <CommandItem
                    key={article.id}
                    value={`${article.name} ${article.sku}`}
                    onSelect={() => {
                      onSelect(article);
                      setOpen(false);
                    }}
                  >
                    <Wrench className="mr-2 h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{article.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{article.sku}</span>
                        <span>{formatCurrency(article.unit_price)}</span>
                      </div>
                    </div>
                    {value === article.id && (
                      <Check className="ml-2 h-3 w-3 shrink-0 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
