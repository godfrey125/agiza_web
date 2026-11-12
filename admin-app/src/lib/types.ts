export interface Role {
  id: string
  name: string
  permissions: string[]
  description?: string
  userCount?: number
  locked?: boolean
}

export interface User {
  id: number
  name: string
  email: string
  phone: string
  avatarUrl: string
  status: string
  role: Role
  twoFactorEnabled: boolean
  createdAt: string
  lastLogin: string | null
}

export interface Metric {
  value: number
  change: number
}

export interface DashboardData {
  range: { label: string; start: string; end: string; key: string }
  summary: {
    revenue: Metric
    orders: Metric
    newCustomers: Metric
    avgOrderValue: Metric
    completed: number
    cancelled: number
    validOrders: number
  }
  series: { date: string; revenue: number; orders: number }[]
  categories: { name: string; value: number; revenue: number }[]
  topDishes: { id: number; name: string; imageUrl: string; price: number; orders: number; revenue: number }[]
  status: { status: string; count: number; percent: number }[]
  insights: {
    peakHour: { hour: number; orders: number } | null
    bestCategory: { name: string; revenue: number }
    bestDish: { id: number; name: string; imageUrl: string; orders: number; revenue: number } | null
    revenueGrowth: number
    today: SummaryShape
    yesterday: SummaryShape
  }
}

export interface SummaryShape {
  revenue: number
  orders: number
  completed: number
  cancelled: number
  newCustomers: number
  avgOrderValue: number
}

export interface MenuItem {
  id: number
  name: string
  description: string
  category_id: number | null
  category_name?: string
  price: number
  costPrice: number
  image_url?: string
  imageUrl?: string
  ingredients: string
  preparationTime: number
  available: boolean
  featured: boolean
  sales: number
  orderCount: number
  profitMargin: number
  recipe: { inventoryId: number; quantity: number }[]
  created_at?: string
  createdAt?: string
}

export interface MenuResponse {
  items: MenuItem[]
  total: number
  page: number
  pageSize: number
  summary: { total: number; available: number; unavailable: number; featured: number }
}

export interface MenuDetail {
  item: MenuItem
  stats: { orders: number; quantity: number; revenue: number; averageOrder: number }
  recentOrders: { id: number; order_number: string; status: string; created_at: string; quantity: number; subtotal: number; customer_name: string }[]
  reviews: { id: number; rating: number; title: string; message: string; created_at: string; customer_name: string }[]
}

export interface Category {
  id: number
  name: string
  description: string
  image_url: string
  status: 'ACTIVE' | 'INACTIVE'
  item_count?: number
  itemCount: number
  availableItems: number
  revenue: number
  created_at: string
}

export interface CategoryResponse {
  items: Category[]
  summary: { total: number; active: number; inactive: number; withoutCategory: number }
}

export interface CategoryDetail {
  category: Category
  stats: { orders: number; revenue: number }
  items: MenuItem[]
}

export interface OrderListItem {
  id: number
  orderNumber: string
  customerName: string
  customerPhone: string
  customerImage: string
  date: string
  itemCount: number
  itemNames: string
  total: number
  paymentMethod: string
  paymentStatus: string
  status: string
}

export interface OrderDetail {
  id: number
  orderNumber: string
  customerId: number | null
  customer: { id?: number; name: string; email: string; phone: string; imageUrl: string }
  staffName: string
  status: string
  paymentMethod: string
  paymentStatus: string
  subtotal: number
  discount: number
  tax: number
  total: number
  notes: string
  createdAt: string
  updatedAt: string
  items: { id: number; menuItemId: number | null; name: string; price: number; quantity: number; subtotal: number; imageUrl: string }[]
  history: { id: number; status: string; note: string; staffName: string; createdAt: string }[]
  allowedStatuses: string[]
}

export interface Customer {
  id: number
  name: string
  email: string
  phone: string
  imageUrl: string
  notes: string
  createdAt: string
  totalOrders: number
  totalSpend: number
  lastOrder: string | null
  firstOrder: string | null
  type: string
  averageOrder: number
  daysSince: number | null
}

export interface CustomerDetail {
  customer: { id: number; name: string; email: string; phone: string; image_url: string; notes: string; created_at: string }
  stats: { orders: number; spend: number; averageOrder: number; lastOrder: string | null }
  orders: { id: number; order_number: string; status: string; total: number; created_at: string }[]
  favorites: { id: number; name: string; imageUrl: string; quantity: number; revenue: number }[]
  reviews: { id: number; rating: number; title: string; message: string; created_at: string }[]
}

export interface InventoryItem {
  id: number
  name: string
  sku: string
  category: string
  quantity: number
  unit: string
  minStock: number
  unitCost: number
  supplierId: number | null
  supplierName: string
  imageUrl: string
  createdAt: string
  value: number
  status: 'OK' | 'LOW' | 'OUT' | 'OVER'
}

export interface InventoryResponse {
  items: InventoryItem[]
  summary: { items: number; available: number; low: number; out: number; over: number; value: number }
  categories: string[]
}

export interface Supplier {
  id: number
  name: string
  contactPerson: string
  phone: string
  email: string
  address: string
  products: string
  createdAt: string
  itemCount: number
  stockValue: number
}

export interface Promotion {
  id: number
  name: string
  type: string
  value: number
  scope: string
  scopeId: number | null
  minOrder: number
  startDate: string
  endDate: string
  active: boolean
  created_at?: string
}

export interface Coupon {
  id: number
  name: string
  code: string
  discountType: string
  value: number
  expiryDate: string
  usageLimit: number
  usedCount: number
  minPurchase: number
  active: boolean
  created_at?: string
}

export interface Campaign {
  id: number
  name: string
  audience: string
  type: string
  startDate: string
  endDate: string
  status: string
  reached: number
  clicks: number
  conversions: number
  created_at?: string
}

export interface Review {
  id: number
  rating: number
  title: string
  message: string
  response: string
  responseAt: string | null
  createdAt: string
  customerName: string
  customerImage: string
  menuItemName: string
  menuItemImage: string
  orderNumber: string
}

export interface ReportRow {
  id: number
  reportType: string
  startDate: string
  endDate: string
  filters: Record<string, string>
  totals: Record<string, number>
  generatedBy?: string
  createdAt: string
}

export interface ReportPreview {
  id: number
  reportType: string
  startDate: string
  endDate: string
  filters: Record<string, string>
  columns: { key: string; label: string; type: string }[]
  rows: Record<string, unknown>[]
  totals: Record<string, number>
  meta?: Record<string, unknown>
}

export interface StaffMember {
  id: number
  name: string
  email: string
  phone: string
  avatarUrl: string
  status: string
  createdAt: string
  lastLogin: string | null
  twoFactorEnabled: boolean
  role: Role
}

export interface AuditLog {
  id: number
  action: string
  entityType: string
  entityId: string
  details: string
  createdAt: string
  user: { name: string; email: string; avatarUrl: string } | null
}

export interface NotificationItem {
  id: number
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}
