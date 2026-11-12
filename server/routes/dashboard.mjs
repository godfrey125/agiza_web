import express from 'express'
import {
  dbAll, dbGet, dbRun, fillSeries, nowIso, percentChange, rangeFromQuery, requireAuth,
  requirePermission, round, startOfDay, addDays, searchTerm,
} from '../lib/core.mjs'

const router = express.Router()
router.use(requireAuth)

async function summaryFor(startIso, endIso) {
  const row = (await dbGet(
    `SELECT COUNT(*) AS orders,
            SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled,
            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
            COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END), 0) AS revenue
     FROM orders WHERE created_at >= ? AND created_at <= ?`,
    [startIso, endIso],
  )) || {}
  const customers = (await dbGet(
    'SELECT COUNT(*) AS count FROM customers WHERE created_at >= ? AND created_at <= ?',
    [startIso, endIso],
  ))?.count || 0
  const validOrders = Number(row.orders || 0) - Number(row.cancelled || 0)
  return {
    revenue: round(row.revenue || 0),
    orders: Number(row.orders || 0),
    completed: Number(row.completed || 0),
    cancelled: Number(row.cancelled || 0),
    newCustomers: Number(customers),
    avgOrderValue: validOrders ? round(Number(row.revenue || 0) / validOrders) : 0,
  }
}

async function trendFor(startIso, endIso, start, end) {
  const rows = await dbAll(
    `SELECT substr(created_at, 1, 10) AS date,
            COUNT(*) AS orders,
            round2(SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END), 2) AS revenue
     FROM orders WHERE created_at >= ? AND created_at <= ?
     GROUP BY substr(created_at, 1, 10) ORDER BY date ASC`,
    [startIso, endIso],
  )
  return fillSeries(rows, start, end, ['revenue', 'orders'])
}

async function statusFor(startIso, endIso) {
  return dbAll(
    `SELECT status, COUNT(*) AS count FROM orders
     WHERE created_at >= ? AND created_at <= ? GROUP BY status ORDER BY count DESC`,
    [startIso, endIso],
  )
}

router.get('/dashboard', requirePermission('dashboard.view'), async (req, res) => {
  const range = rangeFromQuery(req.query)
  const summary = await summaryFor(range.startIso, range.endIso)
  const previous = await summaryFor(range.prevStartIso, range.prevEndIso)
  const series = await trendFor(range.startIso, range.endIso, range.start, range.end)

  const categories = await dbAll(
    `SELECT COALESCE(c.name, 'Other') AS name, round2(SUM(oi.quantity), 2) AS value,
            round2(SUM(oi.subtotal), 2) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
     LEFT JOIN categories c ON c.id = mi.category_id
     WHERE o.created_at >= ? AND o.created_at <= ? AND o.status != 'CANCELLED'
     GROUP BY c.id ORDER BY value DESC`,
    [range.startIso, range.endIso],
  )

  const topDishes = await dbAll(
    `SELECT mi.id, mi.name, mi.image_url AS imageUrl, mi.price,
            SUM(oi.quantity) AS orders, round2(SUM(oi.subtotal), 2) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE o.created_at >= ? AND o.created_at <= ? AND o.status != 'CANCELLED'
     GROUP BY mi.id ORDER BY orders DESC, revenue DESC LIMIT 5`,
    [range.startIso, range.endIso],
  )

  const statusRows = await statusFor(range.startIso, range.endIso)
  const statusTotal = statusRows.reduce((sum, row) => sum + Number(row.count), 0)
  const status = statusRows.map((row) => ({
    status: row.status,
    count: Number(row.count),
    percent: statusTotal ? Math.round((Number(row.count) / statusTotal) * 1000) / 10 : 0,
  }))

  const peak = await dbGet(
    `SELECT strftime('%H', created_at) AS hour, COUNT(*) AS count
     FROM orders WHERE created_at >= ? AND created_at <= ?
     GROUP BY hour ORDER BY count DESC LIMIT 1`,
    [range.startIso, range.endIso],
  )
  const bestCategory = categories[0] || { name: '—', revenue: 0 }

  const todayStart = startOfDay(new Date()).toISOString()
  const todayEnd = nowIso()
  const yesterdayStart = startOfDay(addDays(new Date(), -1)).toISOString()
  const yesterdayEnd = new Date(new Date(yesterdayStart).getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
  const today = await summaryFor(todayStart, todayEnd)
  const yesterday = await summaryFor(yesterdayStart, yesterdayEnd)

  res.json({
    range: { label: range.label, start: range.startIso, end: range.endIso, key: range.range },
    summary: {
      revenue: { value: summary.revenue, change: percentChange(summary.revenue, previous.revenue) },
      orders: { value: summary.orders, change: percentChange(summary.orders, previous.orders) },
      newCustomers: { value: summary.newCustomers, change: percentChange(summary.newCustomers, previous.newCustomers) },
      avgOrderValue: { value: summary.avgOrderValue, change: percentChange(summary.avgOrderValue, previous.avgOrderValue) },
      completed: summary.completed,
      cancelled: summary.cancelled,
      validOrders: summary.orders - summary.cancelled,
    },
    series,
    categories: categories.map((category) => ({
      ...category,
      value: Number(category.value),
      revenue: Number(category.revenue),
    })),
    topDishes: topDishes.map((dish) => ({
      ...dish,
      id: Number(dish.id),
      orders: Number(dish.orders),
      revenue: Number(dish.revenue),
    })),
    status,
    insights: {
      peakHour: peak ? { hour: Number(peak.hour), orders: Number(peak.count) } : null,
      bestCategory,
      bestDish: topDishes[0] || null,
      revenueGrowth: percentChange(summary.revenue, previous.revenue),
      today,
      yesterday,
    },
  })
})

router.get('/search', async (req, res) => {
  const term = String(req.query.q || '').trim()
  if (term.length < 2) return res.json({ results: [] })
  const like = searchTerm(term)
  const results = []

  ;(await dbAll(
    `SELECT id, name, price, image_url AS imageUrl FROM menu_items
     WHERE name ILIKE ? OR description ILIKE ? OR ingredients ILIKE ? ORDER BY name LIMIT 5`,
    [like, like, like],
  )).forEach((row) => results.push({
    type: 'Menu item', id: row.id, title: row.name, subtitle: `TSh ${Number(row.price).toLocaleString('en-GB')}`,
    imageUrl: row.imageUrl, path: `/menu/${row.id}`,
  }))

  ;(await dbAll(
    `SELECT o.id, o.order_number AS orderNumber, o.total, o.status, c.name AS customerName
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.order_number ILIKE ? OR c.name ILIKE ? ORDER BY o.created_at DESC LIMIT 5`,
    [like, like],
  )).forEach((row) => results.push({
    type: 'Order', id: row.id, title: row.orderNumber,
    subtitle: `${row.customerName || 'Walk-in'} · TSh ${Number(row.total).toLocaleString('en-GB')}`,
    path: `/orders/${row.id}`, meta: row.status,
  }))

  ;(await dbAll(
    `SELECT id, name, phone, email, image_url AS imageUrl FROM customers
     WHERE name ILIKE ? OR phone ILIKE ? OR email ILIKE ? ORDER BY name LIMIT 5`,
    [like, like, like],
  )).forEach((row) => results.push({
    type: 'Customer', id: row.id, title: row.name, subtitle: row.phone || row.email,
    imageUrl: row.imageUrl, path: `/customers/${row.id}`,
  }))

  ;(await dbAll(
    `SELECT id, name, status FROM categories WHERE name ILIKE ? OR description ILIKE ? ORDER BY name LIMIT 3`,
    [like, like],
  )).forEach((row) => results.push({
    type: 'Category', id: row.id, title: row.name, subtitle: row.status, path: `/categories/${row.id}`,
  }))

  res.json({ results: results.slice(0, 16) })
})

router.get('/notifications', async (req, res) => {
  const rows = await dbAll('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50')
  const unread = (await dbGet('SELECT COUNT(*) AS count FROM notifications WHERE read = 0'))?.count || 0
  res.json({
    notifications: rows.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      type: row.type,
      read: Boolean(row.read),
      createdAt: row.created_at,
    })),
    unread: Number(unread),
  })
})

router.patch('/notifications/:id/read', async (req, res) => {
  const result = await dbGet('SELECT id FROM notifications WHERE id = ?', [req.params.id])
  if (!result) return res.status(404).json({ error: 'Notification not found.' })
  await dbRun('UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

router.post('/notifications/read-all', async (req, res) => {
  await dbRun('UPDATE notifications SET read = 1 WHERE read = 0')
  res.json({ ok: true })
})

async function analyticsProfit(startIso, endIso) {
  const sales = (await dbGet(
    `SELECT COALESCE(SUM(oi.subtotal), 0) AS revenue,
            COALESCE(SUM(COALESCE(mi.cost_price, 0) * oi.quantity), 0) AS cogs
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE o.created_at >= ? AND o.created_at <= ? AND o.status != 'CANCELLED'`,
    [startIso, endIso],
  )) || { revenue: 0, cogs: 0 }
  const expenses = (await dbGet(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
     WHERE expense_date >= ? AND expense_date <= ? AND category != 'COGS'`,
    [startIso, endIso],
  ))?.total || 0
  const revenue = round(sales.revenue)
  const cogs = round(sales.cogs)
  const operatingExpenses = round(expenses)
  const grossProfit = round(revenue - cogs)
  const netProfit = round(grossProfit - operatingExpenses)
  return {
    revenue, cogs, operatingExpenses, grossProfit, netProfit,
    margin: revenue ? round((netProfit / revenue) * 100) : 0,
  }
}

async function recipeUsage(startIso, endIso) {
  const rows = await dbAll(
    `SELECT mi.recipe_json AS recipeJson, SUM(oi.quantity) AS sold
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE o.status = 'COMPLETED' AND o.created_at >= ? AND o.created_at <= ?
     GROUP BY mi.id`,
    [startIso, endIso],
  )
  const usage = new Map()
  rows.forEach((row) => {
    let recipe = []
    try { recipe = JSON.parse(row.recipeJson || '[]') } catch { recipe = [] }
    recipe.forEach((ingredient) => {
      const id = Number(ingredient.inventoryId)
      usage.set(id, (usage.get(id) || 0) + Number(ingredient.quantity) * Number(row.sold))
    })
  })
  const inventory = await dbAll('SELECT id, name, unit, unit_cost AS unitCost, quantity FROM inventory_items')
  const byId = new Map(inventory.map((item) => [Number(item.id), item]))
  return [...usage.entries()]
    .map(([id, quantity]) => {
      const item = byId.get(id)
      if (!item) return null
      return {
        id, name: item.name, unit: item.unit,
        quantity: round(quantity), cost: round(quantity * item.unitCost),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)
}

router.get('/analytics', requirePermission('analytics.view'), async (req, res) => {
  const range = rangeFromQuery(req.query)
  const summary = await summaryFor(range.startIso, range.endIso)
  const previous = await summaryFor(range.prevStartIso, range.prevEndIso)
  const profit = await analyticsProfit(range.startIso, range.endIso)
  const profitPrevious = await analyticsProfit(range.prevStartIso, range.prevEndIso)
  const series = await trendFor(range.startIso, range.endIso, range.start, range.end)

  const categories = await dbAll(
    `SELECT COALESCE(c.name, 'Other') AS name, round2(SUM(oi.subtotal), 2) AS revenue,
            SUM(oi.quantity) AS quantity
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
     LEFT JOIN categories c ON c.id = mi.category_id
     WHERE o.created_at >= ? AND o.created_at <= ? AND o.status != 'CANCELLED'
     GROUP BY c.id ORDER BY revenue DESC`,
    [range.startIso, range.endIso],
  )

  const products = await dbAll(
    `SELECT mi.id, mi.name, mi.image_url AS imageUrl, mi.price,
            SUM(oi.quantity) AS quantity, round2(SUM(oi.subtotal), 2) AS revenue,
            round2(COALESCE(SUM(COALESCE(mi.cost_price, 0) * oi.quantity), 0), 2) AS cost
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE o.created_at >= ? AND o.created_at <= ? AND o.status != 'CANCELLED'
     GROUP BY mi.id ORDER BY revenue DESC`,
    [range.startIso, range.endIso],
  )
  const soldIds = new Set(products.map((product) => Number(product.id)))
  ;(await dbAll('SELECT id, name, image_url AS imageUrl, price FROM menu_items')).forEach((item) => {
    if (!soldIds.has(Number(item.id))) products.push({ ...item, quantity: 0, revenue: 0, cost: 0 })
  })
  products.sort((a, b) => Number(a.quantity) - Number(b.quantity))

  const byHour = await dbAll(
    `SELECT CAST(strftime('%H', o.created_at) AS INTEGER) AS hour,
            COUNT(*) AS orders, round2(SUM(o.total), 2) AS revenue
     FROM orders o WHERE o.created_at >= ? AND o.created_at <= ? AND o.status != 'CANCELLED'
     GROUP BY hour ORDER BY hour ASC`,
    [range.startIso, range.endIso],
  )
  const byWeekday = await dbAll(
    `SELECT CAST(strftime('%w', o.created_at) AS INTEGER) AS weekday,
            COUNT(*) AS orders, round2(SUM(o.total), 2) AS revenue
     FROM orders o WHERE o.created_at >= ? AND o.created_at <= ? AND o.status != 'CANCELLED'
     GROUP BY weekday ORDER BY weekday ASC`,
    [range.startIso, range.endIso],
  )

  const customersTotal = (await dbGet('SELECT COUNT(*) AS count FROM customers'))?.count || 0
  const customersInRange = (await dbGet(
    'SELECT COUNT(*) AS count FROM customers WHERE created_at >= ? AND created_at <= ?',
    [range.startIso, range.endIso],
  ))?.count || 0
  const customersPrevious = (await dbGet(
    'SELECT COUNT(*) AS count FROM customers WHERE created_at >= ? AND created_at <= ?',
    [range.prevStartIso, range.prevEndIso],
  ))?.count || 0
  const returning = (await dbGet(
    `SELECT COUNT(*) AS count FROM (
       SELECT customer_id FROM orders WHERE status != 'CANCELLED' GROUP BY customer_id HAVING COUNT(*) > 1
     )`,
  ))?.count || 0
  const topCustomers = await dbAll(
    `SELECT c.id, c.name, c.image_url AS imageUrl, COUNT(o.id) AS orders, round2(SUM(o.total), 2) AS spend
     FROM customers c JOIN orders o ON o.customer_id = c.id
     WHERE o.status != 'CANCELLED' AND o.created_at >= ? AND o.created_at <= ?
     GROUP BY c.id ORDER BY spend DESC LIMIT 6`,
    [range.startIso, range.endIso],
  )

  const newCustomerSeries = fillSeries(
    await dbAll(
      `SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS customers
       FROM customers WHERE created_at >= ? AND created_at <= ?
       GROUP BY date ORDER BY date`,
      [range.startIso, range.endIso],
    ),
    range.start, range.end, ['customers'],
  )

  const inventory = (await dbGet(
    `SELECT COUNT(*) AS items, COALESCE(SUM(quantity * unit_cost), 0) AS value,
            SUM(CASE WHEN quantity <= 0 THEN 1 ELSE 0 END) AS outOfStock,
            SUM(CASE WHEN quantity > 0 AND quantity <= min_stock THEN 1 ELSE 0 END) AS lowStock
     FROM inventory_items`,
  )) || { items: 0, value: 0, outOfStock: 0, lowStock: 0 }

  const expenses = await dbAll(
    `SELECT category, round2(SUM(amount), 2) AS amount FROM expenses
     WHERE expense_date >= ? AND expense_date <= ? GROUP BY category ORDER BY amount DESC`,
    [range.startIso, range.endIso],
  )

  res.json({
    range: { label: range.label, start: range.startIso, end: range.endIso, key: range.range },
    summary: {
      revenue: { value: summary.revenue, change: percentChange(summary.revenue, previous.revenue) },
      orders: { value: summary.orders, change: percentChange(summary.orders, previous.orders) },
      avgOrderValue: { value: summary.avgOrderValue, change: percentChange(summary.avgOrderValue, previous.avgOrderValue) },
      grossProfit: { value: profit.grossProfit, change: percentChange(profit.grossProfit, profitPrevious.grossProfit) },
      netProfit: { value: profit.netProfit, change: percentChange(profit.netProfit, profitPrevious.netProfit) },
      customerGrowth: { value: customersInRange, change: percentChange(customersInRange, customersPrevious) },
      margin: profit.margin,
    },
    profit,
    series,
    newCustomerSeries,
    categories,
    products: products.map((product) => ({
      ...product, quantity: Number(product.quantity), revenue: Number(product.revenue), cost: Number(product.cost),
    })),
    topProducts: [...products].sort((a, b) => Number(b.revenue) - Number(a.revenue)).slice(0, 6),
    byHour,
    byWeekday,
    customers: {
      total: Number(customersTotal),
      newInRange: Number(customersInRange),
      returning: Number(returning),
      retention: customersTotal ? round((Number(returning) / Number(customersTotal)) * 100) : 0,
      topCustomers: topCustomers.map((row) => ({ ...row, orders: Number(row.orders), spend: Number(row.spend) })),
    },
    inventory: {
      items: Number(inventory.items),
      value: round(inventory.value),
      outOfStock: Number(inventory.outOfStock),
      lowStock: Number(inventory.lowStock),
      usage: await recipeUsage(range.startIso, range.endIso),
    },
    expenses,
  })
})

router.get('/audit', requirePermission('audit.view'), async (req, res) => {
  const term = String(req.query.q || '').trim()
  const action = String(req.query.action || '').trim()
  const limit = Math.min(200, Number(req.query.limit) || 80)
  const clauses = []
  const params = []
  if (term) {
    clauses.push('(a.action ILIKE ? OR a.entity_type ILIKE ? OR a.details ILIKE ? OR u.name ILIKE ?)')
    const like = `%${term}%`
    params.push(like, like, like, like)
  }
  if (action) {
    clauses.push('a.action = ?')
    params.push(action)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await dbAll(
    `SELECT a.*, u.name AS userName, u.email AS userEmail, u.avatar_url AS userAvatar
     FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     ${where} ORDER BY a.created_at DESC LIMIT ?`,
    [...params, limit],
  )
  res.json({
    logs: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      details: row.details,
      createdAt: row.created_at,
      user: row.userName ? { name: row.userName, email: row.userEmail, avatarUrl: row.userAvatar } : null,
    })),
  })
})

export default router
