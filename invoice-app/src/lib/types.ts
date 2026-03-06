// ── Statuses & Enums ────────────────────────────

export type InvoiceStatus = "unpaid" | "paid" | "delayed" | "partially_paid";

export type Currency = "MAD" | "EUR" | "USD";

export type ArticleType = "product" | "service";

export type PaymentType = "cash" | "bank_transfer" | "check";

// ── Invoice ─────────────────────────────────────

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  price: number;
  article_id: string | null;
  tax_rate: number;
}

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  client: string;
  email: string;
  client_id: string | null;
  date: string;
  due_date: string;
  status: InvoiceStatus;
  notes: string | null;
  currency: Currency;
  created_at: string;
  updated_at: string;
  invoice_items?: InvoiceItem[];
  payments?: Payment[];
}

export interface InvoiceFormData {
  client: string;
  email: string;
  client_id: string | null;
  date: string;
  due_date: string;
  due_date_days: number;
  status: InvoiceStatus;
  notes: string;
  currency: Currency;
  items: {
    description: string;
    quantity: number;
    price: number;
    article_id: string | null;
    tax_rate: number;
  }[];
}

export interface InvoiceStats {
  total: number;
  unpaid: number;
  paid: number;
  delayed: number;
  partially_paid: number;
  totalAmount: number;
  unpaidAmount: number;
  paidAmount: number;
  delayedAmount: number;
  partially_paidAmount: number;
}

// ── Clients ─────────────────────────────────────

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  notes: string;
  credit_limit: number;
  created_at: string;
  updated_at: string;
}

export interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  notes: string;
  credit_limit: number;
}

// ── Articles ────────────────────────────────────

export interface Article {
  id: string;
  user_id: string;
  name: string;
  description: string;
  type: ArticleType;
  sku: string;
  unit_price: number;
  tax_rate: number;
  stock_quantity: number | null;
  min_stock_alert: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArticleFormData {
  name: string;
  description: string;
  type: ArticleType;
  unit_price: number;
  tax_rate: number;
  stock_quantity: number | null;
  min_stock_alert: number;
  is_active: boolean;
}

// ── Payments ────────────────────────────────────

export interface Payment {
  id: string;
  user_id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_type: PaymentType;
  reference: string;
  notes: string;
  created_at: string;
}

export interface PaymentFormData {
  amount: number;
  payment_date: string;
  payment_type: PaymentType;
  reference: string;
  notes: string;
}

// ── Stock Alerts ────────────────────────────────

export interface StockAlert {
  article: Article;
  alertType: "rupture" | "low_stock";
}
