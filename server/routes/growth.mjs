import express from 'express'
import PDFDocument from 'pdfkit'
import {
  audit, dbAll, dbGet, dbRun, escapeHtml, getReportDateRange, notify, nowIso,
  orderAmounts, pagination, requireAuth, requirePermission, round, safeJson,
  searchTerm, toCsv,
} from '../lib/core.mjs'

const router = express.Router()
router.use(requireAuth)

router.get('/marketing', requirePermission('marketing.view'), async (req, res) => {
  const promotions = await dbAll('SELECT * FROM promotions ORDER BY active DESC, created_at DESC')
  const coupons = await dbAll('SELECT * FROM coupons ORDER BY active DESC, created_at DESC')
  const campaigns = await dbAll('SELECT * FROM campaigns ORDER BY created_at DESC')
  const customers = (await dbGet('SELECT COUNT(*) AS count FROM customers'))?.count || 0
  const vip = (await dbGet(
    `SELECT COUNT(*) AS count FROM (
       SELECT c.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status != 'CANCELLED'
       GROUP BY c.id HAVING COUNT(o.id) >= 6 OR SUM(o.total) >= 100000
     ) audience`,
  ))?.count || 0
  const inactive = (await dbGet(
    `SELECT COUNT(*) AS count FROM customers c WHERE NOT EXISTS (
       SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.created_at >= ?
     )`,
    [new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()],
  ))?.count || 0
  res.json({
    promotions: promotions.map((row) => ({
      ...row, id: Number(row.id), value: Number(row.value), minOrder: Number(row.min_order),
      scopeId: row.scope_id ? Number(row.scope_id) : null, active: Boolean(row.active),
      startDate: row.start_date, endDate: row.end_date,
    })),
    coupons: coupons.map((row) => ({
      ...row, id: Number(row.id), value: Number(row.value), usageLimit: Number(row.usage_limit),
      usedCount: Number(row.used_count), minPurchase: Number(row.min_purchase), active: Boolean(row.active),
      discountType: row.discount_type, expiryDate: row.expiry_date,
    })),
    campaigns: campaigns.map((row) => ({
      ...row, id: Number(row.id), reached: Number(row.reached), clicks: Number(row.clicks),
      conversions: Number(row.conversions), startDate: row.start_date, endDate: row.end_date,
    })),
    summary: {
      activePromotions: promotions.filter((row) => row.active).length,
      totalPromotions: promotions.length,
      activeCoupons: coupons.filter((row) => row.active).length,
      couponRedemptions: coupons.reduce((sum, row) => sum + Number(row.used_count), 0),
      campaigns: campaigns.length,
      audience: { all: Number(customers), vip: Number(vip), inactive: Number(inactive) },
      customersReached: null,
      deliveryConnected: Boolean(process.env.EMAIL_PROVIDER_API_KEY || process.env.SMS_PROVIDER_API_KEY),
      deliveryNote: 'No email or SMS provider is connected, so delivery and reach are not reported.',
    },
  })
})

export function validatePromotion(body, existing = {}) {
  const name = String(body.name ?? existing.name ?? '').trim()
  if (!name) return { error: 'Promotion name is required.' }
  const value = Number(body.value ?? existing.value)
  if (!Number.isFinite(value) || value <= 0) return { error: 'Discount value must be greater than zero.' }
  const type = String(body.type ?? existing.type ?? 'PERCENTAGE').toUpperCase()
  if (type === 'PERCENTAGE' && value > 100) return { error: 'Percentage discounts cannot exceed 100%.' }
  if (!body.startDate && !existing.start_date) return { error: 'Start date is required.' }
  if (!body.endDate && !existing.end_date) return { error: 'End date is required.' }
  return {
    values: {
      name, type,
      value: round(value),
      scope: String(body.scope ?? existing.scope ?? 'ALL_ORDERS').toUpperCase(),
      scopeId: body.scopeId !== undefined ? body.scopeId || null : existing.scope_id || null,
      minOrder: Math.max(0, Number(body.minOrder ?? existing.min_order) || 0),
      startDate: String(body.startDate ?? existing.start_date).slice(0, 10),
      endDate: String(body.endDate ?? existing.end_date).slice(0, 10),
      active: body.active !== undefined ? (body.active ? 1 : 0) : (existing.active ?? 1),
    },
  }
}

router.post('/promotions', requirePermission('marketing.manage'), async (req, res) => {
  const result = validatePromotion(req.body || {})
  if (result.error) return res.status(400).json({ error: result.error })
  const v = result.values
  const insert = await dbRun(
    `INSERT INTO promotions (name, type, value, scope, scope_id, min_order, start_date, end_date, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [v.name, v.type, v.value, v.scope, v.scopeId, v.minOrder, v.startDate, v.endDate, v.active, nowIso()],
  )
  audit(req.user.id, 'PROMOTION_CREATED', 'PROMOTION', insert.lastInsertRowid, `Created promotion ${v.name}`)
  res.status(201).json({ id: Number(insert.lastInsertRowid), message: 'Promotion created.' })
})

router.put('/promotions/:id', requirePermission('marketing.manage'), async (req, res) => {
  const existing = await dbGet('SELECT * FROM promotions WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Promotion not found.' })
  const result = validatePromotion(req.body || {}, existing)
  if (result.error) return res.status(400).json({ error: result.error })
  const v = result.values
  await dbRun(
    `UPDATE promotions SET name = ?, type = ?, value = ?, scope = ?, scope_id = ?, min_order = ?, start_date = ?, end_date = ?, active = ? WHERE id = ?`,
    [v.name, v.type, v.value, v.scope, v.scopeId, v.minOrder, v.startDate, v.endDate, v.active, req.params.id],
  )
  audit(req.user.id, 'PROMOTION_UPDATED', 'PROMOTION', req.params.id, `Updated promotion ${v.name}`)
  res.json({ message: 'Promotion updated.' })
})

router.delete('/promotions/:id', requirePermission('marketing.manage'), async (req, res) => {
  const existing = await dbGet('SELECT id, name FROM promotions WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Promotion not found.' })
  await dbRun('DELETE FROM promotions WHERE id = ?', [req.params.id])
  audit(req.user.id, 'PROMOTION_DELETED', 'PROMOTION', req.params.id, `Deleted promotion ${existing.name}`)
  res.json({ message: 'Promotion deleted.' })
})

export async function validateCoupon(body, existing = {}) {
  const name = String(body.name ?? existing.name ?? '').trim()
  const code = String(body.code ?? existing.code ?? '').trim().toUpperCase().replace(/\s+/g, '')
  if (!name) return { error: 'Coupon name is required.' }
  if (!/^[A-Z0-9_-]{4,24}$/.test(code)) return { error: 'Use a 4–24 character coupon code (letters, numbers, - or _).' }
  const duplicate = await dbGet('SELECT id FROM coupons WHERE upper(code) = ? AND id != ?', [code, existing.id || 0])
  if (duplicate) return { error: 'That coupon code already exists.' }
  const value = Number(body.value ?? existing.value)
  if (!Number.isFinite(value) || value <= 0) return { error: 'Discount value must be greater than zero.' }
  const type = String(body.discountType ?? existing.discount_type ?? 'PERCENTAGE').toUpperCase()
  if (type === 'PERCENTAGE' && value > 100) return { error: 'Percentage discounts cannot exceed 100%.' }
  if (!body.expiryDate && !existing.expiry_date) return { error: 'Expiry date is required.' }
  return {
    values: {
      name, code, type, value: round(value),
      expiryDate: String(body.expiryDate ?? existing.expiry_date).slice(0, 10),
      usageLimit: Math.max(1, Number(body.usageLimit ?? existing.usage_limit) || 1),
      minPurchase: Math.max(0, Number(body.minPurchase ?? existing.min_purchase) || 0),
      active: body.active !== undefined ? (body.active ? 1 : 0) : (existing.active ?? 1),
    },
  }
}

router.post('/coupons', requirePermission('marketing.manage'), async (req, res) => {
  const result = await validateCoupon(req.body || {})
  if (result.error) return res.status(400).json({ error: result.error })
  const v = result.values
  const insert = await dbRun(
    `INSERT INTO coupons (name, code, discount_type, value, expiry_date, usage_limit, used_count, min_purchase, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [v.name, v.code, v.type, v.value, v.expiryDate, v.usageLimit, v.minPurchase, v.active, nowIso()],
  )
  audit(req.user.id, 'COUPON_CREATED', 'COUPON', insert.lastInsertRowid, `Created coupon ${v.code}`)
  res.status(201).json({ id: Number(insert.lastInsertRowid), message: 'Coupon created.' })
})

router.put('/coupons/:id', requirePermission('marketing.manage'), async (req, res) => {
  const existing = await dbGet('SELECT * FROM coupons WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Coupon not found.' })
  const result = await validateCoupon(req.body || {}, existing)
  if (result.error) return res.status(400).json({ error: result.error })
  const v = result.values
  await dbRun(
    `UPDATE coupons SET name = ?, code = ?, discount_type = ?, value = ?, expiry_date = ?, usage_limit = ?, min_purchase = ?, active = ? WHERE id = ?`,
    [v.name, v.code, v.type, v.value, v.expiryDate, v.usageLimit, v.minPurchase, v.active, req.params.id],
  )
  audit(req.user.id, 'COUPON_UPDATED', 'COUPON', req.params.id, `Updated coupon ${v.code}`)
  res.json({ message: 'Coupon updated.' })
})

router.delete('/coupons/:id', requirePermission('marketing.manage'), async (req, res) => {
  const existing = await dbGet('SELECT id, code FROM coupons WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Coupon not found.' })
  await dbRun('DELETE FROM coupons WHERE id = ?', [req.params.id])
  audit(req.user.id, 'COUPON_DELETED', 'COUPON', req.params.id, `Deleted coupon ${existing.code}`)
  res.json({ message: 'Coupon deleted.' })
})

router.post('/coupons/validate', requirePermission('orders.manage'), async (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase()
  const subtotal = Math.max(0, Number(req.body?.subtotal) || 0)
  const coupon = await dbGet('SELECT * FROM coupons WHERE upper(code) = ?', [code])
  if (!coupon) return res.status(404).json({ error: 'Coupon code not found.' })
  if (!coupon.active) return res.status(400).json({ error: 'This coupon is not active.' })
  if (new Date(coupon.expiry_date) < new Date()) return res.status(400).json({ error: 'This coupon has expired.' })
  if (Number(coupon.used_count) >= Number(coupon.usage_limit)) return res.status(400).json({ error: 'This coupon has reached its usage limit.' })
  if (subtotal < Number(coupon.min_purchase)) return res.status(400).json({ error: `Minimum order of TSh ${Math.round(Number(coupon.min_purchase)).toLocaleString('en-GB')} required.` })
  const discount = coupon.discount_type === 'PERCENTAGE'
    ? round((subtotal * Number(coupon.value)) / 100)
    : Number(coupon.value)
  res.json({
    coupon: { id: coupon.id, name: coupon.name, code: coupon.code, value: Number(coupon.value), type: coupon.discount_type },
    discount: Math.min(subtotal, round(discount)),
  })
})

export function validateCampaign(body, existing = {}) {
  const name = String(body.name ?? existing.name ?? '').trim()
  if (!name) return { error: 'Campaign name is required.' }
  if (!body.startDate && !existing.start_date) return { error: 'Start date is required.' }
  if (!body.endDate && !existing.end_date) return { error: 'End date is required.' }
  return {
    values: {
      name,
      audience: String(body.audience ?? existing.audience ?? 'All customers'),
      type: String(body.type ?? existing.type ?? 'EMAIL').toUpperCase(),
      startDate: String(body.startDate ?? existing.start_date).slice(0, 10),
      endDate: String(body.endDate ?? existing.end_date).slice(0, 10),
      status: String(body.status ?? existing.status ?? 'DRAFT').toUpperCase(),
    },
  }
}

router.post('/campaigns', requirePermission('marketing.manage'), async (req, res) => {
  const result = validateCampaign(req.body || {})
  if (result.error) return res.status(400).json({ error: result.error })
  const v = result.values
  const insert = await dbRun(
    'INSERT INTO campaigns (name, audience, type, start_date, end_date, status, reached, clicks, conversions, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?)',
    [v.name, v.audience, v.type, v.startDate, v.endDate, v.status, nowIso()],
  )
  audit(req.user.id, 'CAMPAIGN_CREATED', 'CAMPAIGN', insert.lastInsertRowid, `Created campaign ${v.name}`)
  res.status(201).json({ id: Number(insert.lastInsertRowid), message: 'Campaign created. Connect a delivery provider before sending.' })
})

router.put('/campaigns/:id', requirePermission('marketing.manage'), async (req, res) => {
  const existing = await dbGet('SELECT * FROM campaigns WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Campaign not found.' })
  const result = validateCampaign(req.body || {}, existing)
  if (result.error) return res.status(400).json({ error: result.error })
  const v = result.values
  await dbRun(
    'UPDATE campaigns SET name = ?, audience = ?, type = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?',
    [v.name, v.audience, v.type, v.startDate, v.endDate, v.status, req.params.id],
  )
  audit(req.user.id, 'CAMPAIGN_UPDATED', 'CAMPAIGN', req.params.id, `Updated campaign ${v.name}`)
  res.json({ message: 'Campaign updated.' })
})

router.delete('/campaigns/:id', requirePermission('marketing.manage'), async (req, res) => {
  const existing = await dbGet('SELECT id, name FROM campaigns WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Campaign not found.' })
  await dbRun('DELETE FROM campaigns WHERE id = ?', [req.params.id])
  audit(req.user.id, 'CAMPAIGN_DELETED', 'CAMPAIGN', req.params.id, `Deleted campaign ${existing.name}`)
  res.json({ message: 'Campaign deleted.' })
})

router.get('/reviews/analytics', requirePermission('reviews.view'), async (req, res) => {
  const distribution = await dbAll('SELECT rating, COUNT(*) AS count FROM reviews GROUP BY rating ORDER BY rating DESC')
  const summary = await dbGet(
    `SELECT COUNT(*) AS total, round2(AVG(rating), 2) AS average,
            SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five,
            SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) AS negative,
            SUM(CASE WHEN response = '' THEN 1 ELSE 0 END) AS unanswered
     FROM reviews`,
  )
  const trend = await dbAll(
    `SELECT substr(created_at, 1, 7) AS month, round2(AVG(rating), 2) AS average, COUNT(*) AS count
     FROM reviews GROUP BY month ORDER BY month`,
  )
  const products = await dbAll(
    `SELECT mi.id, mi.name, COUNT(r.id) AS reviews, round2(AVG(r.rating), 2) AS average
     FROM reviews r JOIN menu_items mi ON mi.id = r.menu_item_id
     GROUP BY mi.id ORDER BY reviews DESC LIMIT 6`,
  )
  res.json({
    summary: {
      total: Number(summary?.total || 0),
      average: Number(summary?.average || 0),
      five: Number(summary?.five || 0),
      negative: Number(summary?.negative || 0),
      unanswered: Number(summary?.unanswered || 0),
    },
    distribution: distribution.map((row) => ({ rating: Number(row.rating), count: Number(row.count) })),
    trend: trend.map((row) => ({ month: row.month, average: Number(row.average), count: Number(row.count) })),
    products: products.map((row) => ({ ...row, id: Number(row.id), reviews: Number(row.reviews), average: Number(row.average) })),
  })
})

router.get('/reviews', requirePermission('reviews.view'), async (req, res) => {
  const { page, pageSize, offset } = pagination(req.query, 12)
  const clauses = []
  const params = []
  const term = String(req.query.q || '').trim()
  if (term) {
    clauses.push('(r.title ILIKE ? OR r.message ILIKE ? OR c.name ILIKE ? OR mi.name ILIKE ?)')
    const like = searchTerm(term)
    params.push(like, like, like, like)
  }
  if (req.query.rating && req.query.rating !== 'all') {
    clauses.push('r.rating = ?'); params.push(Number(req.query.rating))
  }
  if (req.query.response === 'unanswered') clauses.push("r.response = ''")
  if (req.query.response === 'answered') clauses.push("r.response != ''")
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const total = (await dbGet(
    `SELECT COUNT(*) AS count FROM reviews r LEFT JOIN customers c ON c.id = r.customer_id LEFT JOIN menu_items mi ON mi.id = r.menu_item_id ${where}`,
    params,
  ))?.count || 0
  const rows = await dbAll(
    `SELECT r.*, c.name AS customer_name, c.image_url AS customer_image,
            mi.name AS menu_item_name, mi.image_url AS menu_item_image, o.order_number
     FROM reviews r
     LEFT JOIN customers c ON c.id = r.customer_id
     LEFT JOIN menu_items mi ON mi.id = r.menu_item_id
     LEFT JOIN orders o ON o.id = r.order_id
     ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  )
  const summary = await dbGet(
    `SELECT COUNT(*) AS total, round2(AVG(rating), 2) AS average,
            SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five,
            SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) AS negative,
            SUM(CASE WHEN response = '' THEN 1 ELSE 0 END) AS unanswered
     FROM reviews`,
  )
  res.json({
    items: rows.map((row) => ({
      id: Number(row.id), rating: Number(row.rating), title: row.title, message: row.message,
      response: row.response, responseAt: row.response_at, createdAt: row.created_at,
      customerName: row.customer_name || 'Guest', customerImage: row.customer_image,
      menuItemName: row.menu_item_name, menuItemImage: row.menu_item_image, orderNumber: row.order_number,
    })),
    total: Number(total), page, pageSize,
    summary: {
      total: Number(summary?.total || 0), average: Number(summary?.average || 0),
      five: Number(summary?.five || 0), negative: Number(summary?.negative || 0),
      unanswered: Number(summary?.unanswered || 0),
    },
  })
})

router.patch('/reviews/:id/response', requirePermission('reviews.manage'), async (req, res) => {
  const existing = await dbGet('SELECT * FROM reviews WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Review not found.' })
  const response = String(req.body?.response || '').trim()
  if (!response) return res.status(400).json({ error: 'Write a response before saving.' })
  if (response.length > 1200) return res.status(400).json({ error: 'Keep responses under 1,200 characters.' })
  await dbRun('UPDATE reviews SET response = ?, response_at = ? WHERE id = ?', [response, nowIso(), req.params.id])
  audit(req.user.id, 'REVIEW_RESPONDED', 'REVIEW', req.params.id, 'Published a response to a customer review')
  res.json({ message: 'Response saved.' })
})

router.delete('/reviews/:id', requirePermission('reviews.manage'), async (req, res) => {
  const existing = await dbGet('SELECT id FROM reviews WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Review not found.' })
  await dbRun('DELETE FROM reviews WHERE id = ?', [req.params.id])
  audit(req.user.id, 'REVIEW_DELETED', 'REVIEW', req.params.id, 'Deleted a customer review')
  res.json({ message: 'Review deleted.' })
})

function orderFilterSql(filters, startIso, endIso) {
  const clauses = ['o.created_at >= ?', 'o.created_at <= ?']
  const params = [startIso, endIso]
  if (filters.status && filters.status !== 'all') {
    clauses.push('o.status = ?')
    params.push(String(filters.status).toUpperCase())
  }
  if (filters.paymentMethod && filters.paymentMethod !== 'all') {
    clauses.push('o.payment_method = ?')
    params.push(filters.paymentMethod)
  }
  if (filters.categoryId && filters.categoryId !== 'all') {
    clauses.push('EXISTS (SELECT 1 FROM order_items oi2 JOIN menu_items mi2 ON mi2.id = oi2.menu_item_id WHERE oi2.order_id = o.id AND mi2.category_id = ?)')
    params.push(Number(filters.categoryId))
  }
  return { where: clauses.join(' AND '), params }
}

async function buildReport(type, filters, startIso, endIso, startDate, endDate) {
  const { where, params } = orderFilterSql(filters, startIso, endIso)
  const columns = []
  let rows = []

  if (type === 'sales' || type === 'revenue') {
    columns.push(
      { key: 'date', label: 'Date', type: 'text' },
      { key: 'orders', label: 'Orders', type: 'number' },
      { key: 'revenue', label: 'Revenue', type: 'currency' },
      { key: 'averageOrder', label: 'Average order', type: 'currency' },
    )
    rows = (await dbAll(
      `SELECT substr(o.created_at, 1, 10) AS date, COUNT(*) AS orders, round2(SUM(o.total), 2) AS revenue
       FROM orders o WHERE ${where} AND o.status != 'CANCELLED'
       GROUP BY date ORDER BY date`,
      params,
    )).map((row) => ({
      ...row, orders: Number(row.orders), revenue: Number(row.revenue),
      averageOrder: Number(row.orders) ? round(Number(row.revenue) / Number(row.orders)) : 0,
    }))
  } else if (type === 'orders') {
    columns.push(
      { key: 'orderNumber', label: 'Order', type: 'text' },
      { key: 'date', label: 'Date', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'payment', label: 'Payment', type: 'text' },
      { key: 'total', label: 'Total', type: 'currency' },
    )
    rows = await dbAll(
      `SELECT o.order_number AS "orderNumber", substr(o.created_at, 1, 10) AS date,
              COALESCE(c.name, 'Walk-in customer') AS customer, o.status,
              o.payment_method || ' · ' || o.payment_status AS payment, round2(o.total, 2) AS total
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
       WHERE ${where} ORDER BY o.created_at DESC LIMIT 1000`,
      params,
    )
  } else if (type === 'menu') {
    columns.push(
      { key: 'name', label: 'Menu item', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'revenue', label: 'Revenue', type: 'currency' },
      { key: 'cost', label: 'Cost', type: 'currency' },
      { key: 'margin', label: 'Margin', type: 'percent' },
    )
    rows = (await dbAll(
      `SELECT mi.name, c.name AS category, SUM(oi.quantity) AS quantity,
              round2(SUM(oi.subtotal), 2) AS revenue,
              round2(SUM(COALESCE(mi.cost_price, 0) * oi.quantity), 2) AS cost
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN categories c ON c.id = mi.category_id
       WHERE ${where} AND o.status != 'CANCELLED'
       GROUP BY mi.id, mi.name, c.name ORDER BY revenue DESC`,
      params,
    )).map((row) => ({
      ...row, quantity: Number(row.quantity), revenue: Number(row.revenue), cost: Number(row.cost),
      margin: Number(row.revenue) ? round(((Number(row.revenue) - Number(row.cost)) / Number(row.revenue)) * 100) : 0,
    }))
  } else if (type === 'customers') {
    columns.push(
      { key: 'name', label: 'Customer', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'orders', label: 'Orders', type: 'number' },
      { key: 'spend', label: 'Total spend', type: 'currency' },
      { key: 'lastOrder', label: 'Last order', type: 'text' },
    )
    rows = (await dbAll(
      `SELECT c.name, c.phone, COUNT(o.id) AS orders,
              round2(COALESCE(SUM(CASE WHEN o.status != 'CANCELLED' THEN o.total ELSE 0 END), 0), 2) AS spend,
              MAX(o.created_at) AS "lastOrder"
       FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
       GROUP BY c.id, c.name, c.phone HAVING COUNT(o.id) > 0 ORDER BY spend DESC LIMIT 1000`,
    )).map((row) => ({ ...row, orders: Number(row.orders), spend: Number(row.spend) }))
  } else if (type === 'inventory') {
    columns.push(
      { key: 'name', label: 'Item', type: 'text' },
      { key: 'sku', label: 'SKU', type: 'text' },
      { key: 'quantity', label: 'On hand', type: 'number' },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'minStock', label: 'Minimum', type: 'number' },
      { key: 'value', label: 'Stock value', type: 'currency' },
      { key: 'supplier', label: 'Supplier', type: 'text' },
    )
    rows = await dbAll(
      `SELECT i.name, i.sku, i.quantity, i.unit, i.min_stock AS "minStock",
              round2(i.quantity * i.unit_cost, 2) AS value, s.name AS supplier
       FROM inventory_items i LEFT JOIN suppliers s ON s.id = i.supplier_id ORDER BY i.name`,
    )
  } else if (type === 'profit') {
    columns.push(
      { key: 'date', label: 'Date', type: 'text' },
      { key: 'revenue', label: 'Revenue', type: 'currency' },
      { key: 'cogs', label: 'COGS', type: 'currency' },
      { key: 'expenses', label: 'Expenses', type: 'currency' },
      { key: 'net', label: 'Net profit', type: 'currency' },
    )
    const revenue = await dbAll(
      `SELECT substr(o.created_at, 1, 10) AS date, round2(SUM(oi.subtotal), 2) AS revenue,
              round2(SUM(COALESCE(mi.cost_price, 0) * oi.quantity), 2) AS cogs
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE ${where} AND o.status != 'CANCELLED' GROUP BY date ORDER BY date`,
      params,
    )
    const expenses = await dbAll(
      `SELECT expense_date AS date, round2(SUM(amount), 2) AS expenses FROM expenses
       WHERE expense_date >= ? AND expense_date <= ? AND category != 'COGS' GROUP BY date`,
      [startDate, endDate],
    )
    const expenseMap = new Map(expenses.map((row) => [row.date, Number(row.expenses)]))
    rows = revenue.map((row) => {
      const revenueValue = Number(row.revenue)
      const cogs = Number(row.cogs)
      const expense = expenseMap.get(row.date) || 0
      return { ...row, revenue: revenueValue, cogs, expenses: expense, net: round(revenueValue - cogs - expense) }
    })
  } else if (type === 'payments') {
    columns.push(
      { key: 'method', label: 'Payment method', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'orders', label: 'Orders', type: 'number' },
      { key: 'amount', label: 'Amount', type: 'currency' },
    )
    rows = (await dbAll(
      `SELECT o.payment_method AS method, o.payment_status AS status, COUNT(*) AS orders, round2(SUM(o.total), 2) AS amount
       FROM orders o WHERE ${where} GROUP BY o.payment_method, o.payment_status ORDER BY amount DESC`,
      params,
    )).map((row) => ({ ...row, orders: Number(row.orders), amount: Number(row.amount) }))
  } else if (type === 'staff') {
    columns.push(
      { key: 'name', label: 'Staff member', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'orders', label: 'Orders handled', type: 'number' },
      { key: 'revenue', label: 'Revenue', type: 'currency' },
    )
    rows = (await dbAll(
      `SELECT u.name, r.name AS role, COUNT(o.id) AS orders, round2(COALESCE(SUM(o.total), 0), 2) AS revenue
       FROM users u JOIN roles r ON r.id = u.role_id
       LEFT JOIN orders o ON o.staff_id = u.id AND o.created_at >= ? AND o.created_at <= ? AND o.status != 'CANCELLED'
       GROUP BY u.id, u.name, r.name ORDER BY orders DESC`,
      [startIso, endIso],
    )).map((row) => ({ ...row, orders: Number(row.orders), revenue: Number(row.revenue) }))
  } else {
    throw new Error('Unknown report type.')
  }

  const totals = {}
  columns.filter((column) => ['number', 'currency', 'percent'].includes(column.type)).forEach((column) => {
    totals[column.key] = round(rows.reduce((sum, row) => sum + (Number(row[column.key]) || 0), 0))
  })
  return {
    columns,
    rows,
    totals,
    meta: {
      type,
      startDate,
      endDate,
      filters,
      generatedAt: nowIso(),
      rowCount: rows.length,
    },
  }
}

router.get('/reports/options', requirePermission('reports.view'), async (req, res) => {
  const categories = await dbAll('SELECT id, name FROM categories ORDER BY name')
  res.json({
    categories: categories.map((row) => ({ id: Number(row.id), name: row.name })),
    paymentMethods: ['Cash', 'Card', 'M-Pesa', 'Airtel Money', 'Bank Transfer'],
    orderStatuses: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'],
    types: [
      { value: 'sales', label: 'Sales report' },
      { value: 'revenue', label: 'Revenue report' },
      { value: 'orders', label: 'Orders report' },
      { value: 'menu', label: 'Menu performance' },
      { value: 'customers', label: 'Customer report' },
      { value: 'inventory', label: 'Inventory report' },
      { value: 'profit', label: 'Profit & loss' },
      { value: 'payments', label: 'Payment report' },
      { value: 'staff', label: 'Staff performance' },
    ],
  })
})

router.get('/reports', requirePermission('reports.view'), async (req, res) => {
  const rows = await dbAll(
    `SELECT r.*, u.name AS generated_by_name FROM reports r
     LEFT JOIN users u ON u.id = r.generated_by ORDER BY r.created_at DESC LIMIT 80`,
  )
  res.json({
    reports: rows.map((row) => ({
      id: Number(row.id), reportType: row.report_type, startDate: row.start_date, endDate: row.end_date,
      filters: safeJson(row.filters_json, {}), totals: safeJson(row.totals_json, {}),
      generatedBy: row.generated_by_name, createdAt: row.created_at,
    })),
  })
})

router.post('/reports/generate', requirePermission('reports.generate'), async (req, res) => {
  const type = String(req.body?.type || 'sales').toLowerCase()
  const { startDate, endDate, startIso, endIso } = getReportDateRange(req.body || {})
  const filters = {
    categoryId: req.body?.categoryId || 'all',
    paymentMethod: req.body?.paymentMethod || 'all',
    status: req.body?.status || 'all',
  }
  let report
  try {
    report = await buildReport(type, filters, startIso, endIso, startDate, endDate)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
  const insert = await dbRun(
    `INSERT INTO reports (report_type, start_date, end_date, filters_json, columns_json, rows_json, totals_json, generated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [type, startDate, endDate, JSON.stringify(filters), JSON.stringify(report.columns),
      JSON.stringify(report.rows), JSON.stringify(report.totals), req.user.id, nowIso()],
  )
  audit(req.user.id, 'REPORT_GENERATED', 'REPORT', insert.lastInsertRowid, `Generated ${type} report`)
  res.status(201).json({
    id: Number(insert.lastInsertRowid),
    report: {
      id: Number(insert.lastInsertRowid), reportType: type, startDate, endDate,
      filters, columns: report.columns, rows: report.rows, totals: report.totals, meta: report.meta,
    },
    message: 'Report generated.',
  })
})

async function loadReport(id) {
  const row = await dbGet('SELECT * FROM reports WHERE id = ?', [id])
  if (!row) return null
  return {
    id: Number(row.id), reportType: row.report_type, startDate: row.start_date, endDate: row.end_date,
    filters: safeJson(row.filters_json, {}), columns: safeJson(row.columns_json, []),
    rows: safeJson(row.rows_json, []), totals: safeJson(row.totals_json, {}), createdAt: row.created_at,
  }
}

router.get('/reports/:id', requirePermission('reports.view'), async (req, res) => {
  const report = await loadReport(req.params.id)
  if (!report) return res.status(404).json({ error: 'Report not found.' })
  res.json({ report })
})

function formatReportValue(value, column) {
  if (value === null || value === undefined || value === '') return '—'
  if (column.type === 'currency') return `TSh ${Math.round(Number(value)).toLocaleString('en-GB')}`
  if (column.type === 'percent') return `${Number(value).toFixed(1)}%`
  if (column.type === 'number') return Number(value).toLocaleString('en-GB')
  if (String(value).includes('T') && !Number.isNaN(Date.parse(value))) return new Date(value).toLocaleString('en-GB')
  return String(value)
}

router.get('/reports/:id/export', requirePermission('reports.view'), async (req, res) => {
  const report = await loadReport(req.params.id)
  if (!report) return res.status(404).json({ error: 'Report not found.' })
  const format = String(req.query.format || 'csv').toLowerCase()
  const safeName = `agiza-analytics-${report.reportType}-${report.startDate}-to-${report.endDate}`
  if (format === 'csv') {
    const csv = toCsv(report.columns, report.rows)
    res.header('Content-Type', 'text/csv; charset=utf-8')
    res.header('Content-Disposition', `attachment; filename="${safeName}.csv"`)
    return res.send(csv)
  }
  if (format === 'xls' || format === 'excel') {
    const header = report.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')
    const body = report.rows.map((row) => `<tr>${report.columns.map((column) => `<td>${escapeHtml(formatReportValue(row[column.key], column))}</td>`).join('')}</tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>
      <h2>${escapeHtml(report.reportType)} report</h2>
      <p>${escapeHtml(report.startDate)} to ${escapeHtml(report.endDate)}</p>
      <table border="1"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`
    res.header('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
    res.header('Content-Disposition', `attachment; filename="${safeName}.xls"`)
    return res.send(html)
  }
  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`)
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 })
    doc.pipe(res)
    doc.fontSize(20).fillColor('#F05A32').text('Agiza Admin')
    doc.fontSize(9).fillColor('#777777').text('Platform control center · Generated report')
    doc.moveDown(0.8)
    doc.fontSize(16).fillColor('#252525').text(`${report.reportType[0].toUpperCase()}${report.reportType.slice(1)} report`)
    doc.fontSize(9).fillColor('#777777').text(`${report.startDate} to ${report.endDate}`)
    doc.moveDown(0.8)
    const left = 36
    const right = 806
    const width = right - left
    const widths = report.columns.map(() => width / report.columns.length)
    let y = doc.y
    doc.fontSize(8).fillColor('#777777')
    report.columns.forEach((column, index) => {
      doc.text(column.label, left + widths.slice(0, index).reduce((sum, value) => sum + value, 0) + 4, y, {
        width: widths[index] - 8, align: ['currency', 'number', 'percent'].includes(column.type) ? 'right' : 'left',
      })
    })
    y += 16
    doc.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor('#EEE9E2').stroke()
    report.rows.slice(0, 250).forEach((row) => {
      if (y > 535) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 })
        y = 44
      }
      doc.fontSize(8).fillColor('#252525')
      report.columns.forEach((column, index) => {
        doc.text(formatReportValue(row[column.key], column), left + widths.slice(0, index).reduce((sum, value) => sum + value, 0) + 4, y, {
          width: widths[index] - 8, align: ['currency', 'number', 'percent'].includes(column.type) ? 'right' : 'left',
          ellipsis: true, lineBreak: false,
        })
      })
      y += 16
    })
    if (report.rows.length > 250) {
      doc.fontSize(8).fillColor('#777777').text(`Showing 250 of ${report.rows.length} rows. Export CSV or Excel for the full data set.`, left, y + 8)
    }
    doc.end()
    return
  }
  res.status(400).json({ error: 'Choose CSV, Excel or PDF export.' })
})

export default router
