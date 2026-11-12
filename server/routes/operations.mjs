import express from 'express'
import PDFDocument from 'pdfkit'
import {
  audit, dbAll, dbGet, dbRun, notify, nowIso, orderAmounts, pagination,
  requireAuth, requirePermission, round, searchTerm, toCsv,
} from '../lib/core.mjs'
import { transaction } from '../db.mjs'

const router = express.Router()
router.use(requireAuth)

const STATUS_FLOW = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

async function nextOrderNumber() {
  const max = (await dbGet('SELECT COALESCE(MAX(id), 0) AS id FROM orders'))?.id || 0
  return `FA-${new Date().getFullYear()}-${String(Number(max) + 1).padStart(4, '0')}`
}

async function getOrderRow(id) {
  return dbGet(
    `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
            c.image_url AS customer_image, u.name AS staff_name
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     LEFT JOIN users u ON u.id = o.staff_id
     WHERE o.id = ?`,
    [id],
  )
}

async function getOrderItems(id) {
  return (await dbAll(
    `SELECT oi.*, mi.image_url AS image_url, mi.category_id
     FROM order_items oi LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE oi.order_id = ? ORDER BY oi.id ASC`,
    [id],
  )).map((row) => ({
    id: Number(row.id),
    menuItemId: row.menu_item_id ? Number(row.menu_item_id) : null,
    name: row.name,
    price: Number(row.price),
    quantity: Number(row.quantity),
    subtotal: Number(row.subtotal),
    imageUrl: row.image_url || '',
  }))
}

async function orderDetail(id) {
  const row = await getOrderRow(id)
  if (!row) return null
  const history = await dbAll(
    `SELECT h.*, u.name AS staff_name FROM order_status_history h
     LEFT JOIN users u ON u.id = h.staff_id WHERE h.order_id = ? ORDER BY h.created_at ASC`,
    [id],
  )
  return {
    id: Number(row.id),
    orderNumber: row.order_number,
    customerId: row.customer_id ? Number(row.customer_id) : null,
    customer: row.customer_id ? {
      id: Number(row.customer_id), name: row.customer_name, email: row.customer_email,
      phone: row.customer_phone, imageUrl: row.customer_image,
    } : { name: 'Walk-in customer', email: '', phone: '', imageUrl: '' },
    staffName: row.staff_name || '—',
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    tax: Number(row.tax),
    total: Number(row.total),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: await getOrderItems(id),
    history: history.map((entry) => ({
      id: entry.id, status: entry.status, note: entry.note,
      staffName: entry.staff_name, createdAt: entry.created_at,
    })),
    allowedStatuses: STATUS_FLOW[row.status] || [],
  }
}

router.get('/orders', requirePermission('orders.view'), async (req, res) => {
  const { page, pageSize, offset } = pagination(req.query, 15)
  const clauses = []
  const params = []
  const term = String(req.query.q || '').trim()
  if (term) {
    clauses.push('(o.order_number ILIKE ? OR c.name ILIKE ? OR c.phone ILIKE ?)')
    const like = searchTerm(term)
    params.push(like, like, like)
  }
  if (req.query.status && req.query.status !== 'all') {
    const statuses = String(req.query.status).split(',').map((value) => value.trim().toUpperCase()).filter(Boolean)
    if (statuses.length) {
      clauses.push(`o.status IN (${statuses.map(() => '?').join(',')})`)
      params.push(...statuses)
    }
  }
  if (req.query.paymentStatus && req.query.paymentStatus !== 'all') {
    clauses.push('o.payment_status = ?')
    params.push(String(req.query.paymentStatus).toUpperCase())
  }
  if (req.query.from) {
    clauses.push('o.created_at >= ?')
    params.push(`${req.query.from}T00:00:00.000Z`)
  }
  if (req.query.to) {
    clauses.push('o.created_at <= ?')
    params.push(`${req.query.to}T23:59:59.999Z`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const sortMap = {
    newest: 'o.created_at DESC', oldest: 'o.created_at ASC',
    total_desc: 'o.total DESC', total_asc: 'o.total ASC',
  }
  const sort = sortMap[req.query.sort] || sortMap.newest
  const total = (await dbGet(`SELECT COUNT(*) AS count FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ${where}`, params))?.count || 0
  const rows = await dbAll(
    `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.image_url AS customer_image,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
            (SELECT STRING_AGG(name, ' · ') FROM order_items oi WHERE oi.order_id = o.id) AS item_names
     FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
     ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  )
  const summary = await dbGet(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'PREPARING' THEN 1 ELSE 0 END) AS preparing,
            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled,
            COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END), 0) AS revenue
     FROM orders`,
  )
  res.json({
    items: rows.map((row) => ({
      id: Number(row.id),
      orderNumber: row.order_number,
      customerName: row.customer_name || 'Walk-in customer',
      customerPhone: row.customer_phone || '',
      customerImage: row.customer_image || '',
      date: row.created_at,
      itemCount: Number(row.item_count),
      itemNames: row.item_names || '',
      total: Number(row.total),
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      status: row.status,
    })),
    total: Number(total), page, pageSize,
    summary: {
      total: Number(summary?.total || 0), pending: Number(summary?.pending || 0),
      preparing: Number(summary?.preparing || 0), completed: Number(summary?.completed || 0),
      cancelled: Number(summary?.cancelled || 0), revenue: round(summary?.revenue || 0),
    },
  })
})

router.get('/orders/:id', requirePermission('orders.view'), async (req, res) => {
  const order = await orderDetail(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found.' })
  res.json({ order })
})

async function resolveCustomer(body, req) {
  if (body.customerId) {
    const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [body.customerId])
    if (!customer) return { error: 'The selected customer could not be found.' }
    return { customer }
  }
  const name = String(body.customerName || '').trim()
  if (!name) return { error: 'Choose an existing customer or enter a customer name.' }
  const phone = String(body.customerPhone || '').trim()
  const email = String(body.customerEmail || '').trim()
  let customer = phone ? await dbGet('SELECT * FROM customers WHERE phone = ?', [phone]) : null
  if (!customer) {
    const insert = await dbRun(
      'INSERT INTO customers (name, email, phone, image_url, type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone, '', 'NEW', 'Created while placing an order', nowIso()],
    )
    customer = await dbGet('SELECT * FROM customers WHERE id = ?', [insert.lastInsertRowid])
    audit(req.user.id, 'CUSTOMER_CREATED', 'CUSTOMER', insert.lastInsertRowid, `Created customer ${name} from order entry`)
  }
  return { customer }
}

async function buildOrderItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return { error: 'Add at least one menu item to the order.' }
  const items = []
  for (const entry of rawItems) {
    const menuItem = await dbGet('SELECT * FROM menu_items WHERE id = ?', [entry.menuItemId || entry.id])
    if (!menuItem) return { error: 'One of the selected menu items no longer exists.' }
    if (!menuItem.available) return { error: `${menuItem.name} is currently unavailable.` }
    const quantity = Math.max(1, Math.floor(Number(entry.quantity) || 1))
    items.push({ id: menuItem.id, name: menuItem.name, price: Number(menuItem.price), quantity, subtotal: round(Number(menuItem.price) * quantity) })
  }
  return { items }
}

async function resolveDiscount(body, subtotal) {
  let discount = Math.max(0, Number(body.discount) || 0)
  let coupon = null
  const code = String(body.couponCode || '').trim().toUpperCase()
  if (code) {
    coupon = await dbGet('SELECT * FROM coupons WHERE upper(code) = ?', [code])
    if (!coupon) return { error: 'Coupon code not found.' }
    if (!coupon.active) return { error: 'This coupon is no longer active.' }
    if (new Date(coupon.expiry_date) < new Date()) return { error: 'This coupon has expired.' }
    if (Number(coupon.used_count) >= Number(coupon.usage_limit)) return { error: 'This coupon has reached its usage limit.' }
    if (subtotal < Number(coupon.min_purchase)) return { error: `This coupon needs a minimum order of TSh ${Math.round(Number(coupon.min_purchase)).toLocaleString('en-GB')}.` }
    discount = coupon.discount_type === 'PERCENTAGE'
      ? round((subtotal * Number(coupon.value)) / 100)
      : round(Number(coupon.value))
  }
  return { discount: Math.min(subtotal, discount), coupon }
}

router.post('/orders', requirePermission('orders.manage'), async (req, res) => {
  const body = req.body || {}
  const customerResult = await resolveCustomer(body, req)
  if (customerResult.error) return res.status(400).json({ error: customerResult.error })
  const itemResult = await buildOrderItems(body.items)
  if (itemResult.error) return res.status(400).json({ error: itemResult.error })
  const items = itemResult.items
  const subtotal = round(items.reduce((sum, item) => sum + item.subtotal, 0))
  const discountResult = await resolveDiscount(body, subtotal)
  if (discountResult.error) return res.status(400).json({ error: discountResult.error })
  const amounts = orderAmounts(items, discountResult.discount, Number(body.taxRate ?? 0.05))
  const number = await nextOrderNumber()
  const status = 'PENDING'
  const paymentStatus = String(body.paymentStatus || 'PENDING').toUpperCase()
  const paymentMethod = String(body.paymentMethod || 'Cash')
  const created = nowIso()
  const result = await transaction(async (db) => {
    const insert = await db.prepare(
      `INSERT INTO orders
        (order_number, customer_id, status, payment_method, payment_status, subtotal, discount, tax, total, staff_id, notes, inventory_consumed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(number, customerResult.customer.id, status, paymentMethod, paymentStatus, amounts.subtotal, amounts.discount, amounts.tax, amounts.total, req.user.id, String(body.notes || ''), created, created)
    const orderId = Number(insert.lastInsertRowid)
    for (const item of items) {
      await db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)')
        .run(orderId, item.id, item.name, item.price, item.quantity, item.subtotal)
    }
    await db.prepare('INSERT INTO order_status_history (order_id, status, note, staff_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(orderId, status, 'Order created', req.user.id, created)
    if (discountResult.coupon) {
      await db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(discountResult.coupon.id)
    }
    return orderId
  })
  audit(req.user.id, 'ORDER_CREATED', 'ORDER', result, `Created order ${number}`)
  notify('New order received', `Order ${number} was created for ${customerResult.customer.name}.`, 'ORDER')
  res.status(201).json({ id: result, orderNumber: number, message: 'Order created.' })
})

router.put('/orders/:id', requirePermission('orders.manage'), async (req, res) => {
  const existing = await getOrderRow(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Order not found.' })
  const body = req.body || {}
  const canEditItems = ['PENDING', 'CONFIRMED'].includes(existing.status)
  let items = await getOrderItems(existing.id)
  if (body.items && !canEditItems) {
    return res.status(400).json({ error: 'Items can only be changed while an order is pending or confirmed.' })
  }
  if (body.items) {
    const itemResult = await buildOrderItems(body.items)
    if (itemResult.error) return res.status(400).json({ error: itemResult.error })
    items = itemResult.items
  }
  const subtotal = round(items.reduce((sum, item) => sum + item.subtotal, 0))
  const fallbackDiscount = Math.min(subtotal, Math.max(0, Number(body.discount ?? existing.discount) || 0))
  const discountResult = body.couponCode
    ? await resolveDiscount(body, subtotal)
    : { discount: fallbackDiscount, coupon: null }
  if (discountResult.error) return res.status(400).json({ error: discountResult.error })
  const amounts = orderAmounts(items, discountResult.discount, Number(body.taxRate ?? 0.05))
  const customerId = body.customerId || existing.customer_id
  const customer = await dbGet('SELECT id FROM customers WHERE id = ?', [customerId])
  if (!customer) return res.status(400).json({ error: 'The selected customer could not be found.' })
  await transaction(async (db) => {
    await db.prepare(
      `UPDATE orders SET customer_id = ?, payment_method = ?, payment_status = ?, subtotal = ?, discount = ?,
       tax = ?, total = ?, notes = ?, updated_at = ? WHERE id = ?`,
    ).run(
      customerId, String(body.paymentMethod || existing.payment_method),
      String(body.paymentStatus || existing.payment_status).toUpperCase(),
      amounts.subtotal, amounts.discount, amounts.tax, amounts.total,
      String(body.notes ?? existing.notes), nowIso(), existing.id,
    )
    if (body.items) {
      await db.prepare('DELETE FROM order_items WHERE order_id = ?').run(existing.id)
      for (const item of items) {
        await db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)')
          .run(existing.id, item.id, item.name, item.price, item.quantity, item.subtotal)
      }
    }
  })
  audit(req.user.id, 'ORDER_UPDATED', 'ORDER', existing.id, `Updated order ${existing.order_number}`)
  res.json({ message: 'Order updated.' })
})

async function consumeOrderInventory(orderId, orderNumber, userId, client = null) {
  const all = client ? (sql, params) => client.prepare(sql).all(...params) : dbAll
  const get = client ? (sql, params) => client.prepare(sql).get(...params) : dbGet
  const run = client ? (sql, params) => client.prepare(sql).run(...params) : dbRun
  const rows = await all(
    `SELECT mi.recipe_json AS recipeJson, oi.quantity AS sold, mi.name AS menuName
     FROM order_items oi JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE oi.order_id = ?`,
    [orderId],
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
  if (!usage.size) return
  const lowStock = []
  for (const [id, required] of usage.entries()) {
    const item = await get('SELECT * FROM inventory_items WHERE id = ?', [id])
    if (!item) continue
    const previous = Number(item.quantity)
    const next = round(previous - required)
    await run('UPDATE inventory_items SET quantity = ? WHERE id = ?', [next, id])
    await run(
      `INSERT INTO stock_movements (inventory_item_id, type, quantity, previous_quantity, new_quantity, reason, staff_id, created_at)
       VALUES (?, 'ORDER_CONSUMPTION', ?, ?, ?, ?, ?, ?)`,
      [id, round(-required), previous, next, `Consumed while completing ${orderNumber}`, userId, nowIso()],
    )
    if (next <= Number(item.min_stock)) lowStock.push(`${item.name} (${next} ${item.unit})`)
  }
  if (lowStock.length) {
    notify('Low stock after order completion', `${lowStock.slice(0, 4).join(', ')}${lowStock.length > 4 ? ` and ${lowStock.length - 4} more` : ''}.`, 'STOCK')
  }
}

router.patch('/orders/:id/status', requirePermission('orders.manage'), async (req, res) => {
  const existing = await getOrderRow(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Order not found.' })
  const nextStatus = String(req.body?.status || '').toUpperCase()
  const allowed = STATUS_FLOW[existing.status] || []
  if (!allowed.includes(nextStatus)) {
    return res.status(400).json({ error: `An order in ${existing.status} cannot move to ${nextStatus || 'that status'}.` })
  }
  await transaction(async (db) => {
    let paymentStatus = existing.payment_status
    if (nextStatus === 'CANCELLED' && existing.payment_status === 'PAID') paymentStatus = 'REFUNDED'
    await db.prepare('UPDATE orders SET status = ?, payment_status = ?, updated_at = ? WHERE id = ?')
      .run(nextStatus, paymentStatus, nowIso(), existing.id)
    await db.prepare('INSERT INTO order_status_history (order_id, status, note, staff_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(existing.id, nextStatus, String(req.body?.note || `Status changed from ${existing.status} to ${nextStatus}`), req.user.id, nowIso())
    if (nextStatus === 'COMPLETED' && !existing.inventory_consumed) {
      await consumeOrderInventory(existing.id, existing.order_number, req.user.id, db)
      await db.prepare('UPDATE orders SET inventory_consumed = 1 WHERE id = ?').run(existing.id)
    }
  })
  audit(req.user.id, 'ORDER_STATUS_CHANGED', 'ORDER', existing.id, `${existing.order_number}: ${existing.status} → ${nextStatus}`)
  notify('Order status updated', `${existing.order_number} moved to ${nextStatus.toLowerCase()}.`, 'ORDER')
  res.json({ message: `Order moved to ${nextStatus.toLowerCase()}.` })
})

router.get('/orders/:id/invoice', requirePermission('orders.view'), async (req, res) => {
  const order = await orderDetail(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found.' })
  if (req.query.format === 'csv') {
    const rows = order.items.map((item) => ({
      Item: item.name, Quantity: item.quantity, Price: item.price.toFixed(2), Subtotal: item.subtotal.toFixed(2),
    }))
    const csv = toCsv(
      [{ key: 'Item', label: 'Item' }, { key: 'Quantity', label: 'Quantity' }, { key: 'Price', label: 'Price' }, { key: 'Subtotal', label: 'Subtotal' }],
      rows,
    )
    res.header('Content-Type', 'text/csv; charset=utf-8')
    res.header('Content-Disposition', `attachment; filename="${order.orderNumber}.csv"`)
    return res.send(csv)
  }
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-receipt.pdf"`)
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.pipe(res)
  doc.fontSize(22).fillColor('#F05A32').text('Agiza Admin')
  doc.fontSize(9).fillColor('#777777').text('Platform control center')
  doc.moveDown(1.5)
  doc.fontSize(16).fillColor('#252525').text(`Receipt ${order.orderNumber}`)
  doc.fontSize(9).fillColor('#777777').text(`Date: ${new Date(order.createdAt).toLocaleString('en-GB')}`)
  doc.text(`Customer: ${order.customer.name || 'Walk-in customer'}`)
  doc.text(`Status: ${order.status}  ·  Payment: ${order.paymentStatus} (${order.paymentMethod})`)
  doc.moveDown(1)
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#EEE9E2').stroke()
  doc.moveDown(0.7)
  const headerY = doc.y
  doc.fontSize(9).fillColor('#777777')
  doc.text('ITEM', 50, headerY)
  doc.text('QTY', 340, headerY, { width: 50, align: 'right' })
  doc.text('PRICE', 410, headerY, { width: 60, align: 'right' })
  doc.text('TOTAL', 490, headerY, { width: 55, align: 'right' })
  doc.moveDown(0.7)
  order.items.forEach((item) => {
    const y = doc.y
    doc.fontSize(9).fillColor('#252525')
    doc.text(item.name, 50, y, { width: 275 })
    doc.text(String(item.quantity), 340, y, { width: 50, align: 'right' })
    doc.text(`TSh ${Math.round(item.price).toLocaleString('en-GB')}`, 410, y, { width: 60, align: 'right' })
    doc.text(`TSh ${Math.round(item.subtotal).toLocaleString('en-GB')}`, 490, y, { width: 55, align: 'right' })
    doc.moveDown(0.7)
  })
  doc.moveDown(0.5)
  doc.moveTo(350, doc.y).lineTo(545, doc.y).strokeColor('#EEE9E2').stroke()
  doc.moveDown(0.5)
  const summaryRows = [
    ['Subtotal', order.subtotal], ['Discount', -order.discount], ['Tax', order.tax], ['Total', order.total],
  ]
  summaryRows.forEach(([label, value]) => {
    const y = doc.y
    doc.fontSize(label === 'Total' ? 11 : 9).fillColor(label === 'Total' ? '#252525' : '#777777')
    doc.text(label, 350, y, { width: 120, align: 'right' })
    doc.fillColor(label === 'Total' ? '#F05A32' : '#252525')
    doc.text(`TSh ${Math.round(Number(value)).toLocaleString('en-GB')}`, 480, y, { width: 65, align: 'right' })
    doc.moveDown(1)
  })
  if (order.notes) {
    doc.moveDown(0.5)
    doc.fontSize(9).fillColor('#777777').text(`Notes: ${order.notes}`, 50)
  }
  doc.end()
})

router.get('/customers', requirePermission('customers.view'), async (req, res) => {
  const term = String(req.query.q || '').trim()
  const params = []
  let where = ''
  if (term) {
    where = 'WHERE (c.name ILIKE ? OR c.email ILIKE ? OR c.phone ILIKE ?)'
    const like = searchTerm(term)
    params.push(like, like, like)
  }
  const rows = (await dbAll(
    `SELECT c.*, COUNT(o.id) AS total_orders,
            COALESCE(SUM(CASE WHEN o.status != 'CANCELLED' THEN o.total ELSE 0 END), 0) AS total_spend,
            MAX(o.created_at) AS last_order,
            MIN(o.created_at) AS first_order
     FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
     ${where} GROUP BY c.id`,
    params,
  )).map((row) => {
    const lastOrder = row.last_order ? new Date(row.last_order) : null
    const daysSince = lastOrder ? Math.floor((Date.now() - lastOrder.getTime()) / (24 * 60 * 60 * 1000)) : null
    let type = 'NEW'
    if (daysSince !== null && daysSince > 45) type = 'INACTIVE'
    else if (Number(row.total_spend) >= 100000 || Number(row.total_orders) >= 8) type = 'VIP'
    else if (Number(row.total_orders) >= 4) type = 'REGULAR'
    else if (Number(row.total_orders) >= 2) type = 'RETURNING'
    return {
      id: Number(row.id), name: row.name, email: row.email, phone: row.phone,
      imageUrl: row.image_url, notes: row.notes, createdAt: row.created_at,
      totalOrders: Number(row.total_orders), totalSpend: round(row.total_spend),
      lastOrder: row.last_order, firstOrder: row.first_order, type,
      averageOrder: Number(row.total_orders) ? round(Number(row.total_spend) / Number(row.total_orders)) : 0,
      daysSince,
    }
  })
  const typeFilter = String(req.query.type || 'all')
  const filtered = typeFilter === 'all' ? rows : rows.filter((row) => row.type === typeFilter)
  const sortMap = {
    newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    name: (a, b) => a.name.localeCompare(b.name),
    spend: (a, b) => b.totalSpend - a.totalSpend,
    orders: (a, b) => b.totalOrders - a.totalOrders,
    last_order: (a, b) => new Date(b.lastOrder || 0).getTime() - new Date(a.lastOrder || 0).getTime(),
  }
  const sort = sortMap[req.query.sort] || sortMap.newest
  filtered.sort(sort)
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 12))
  const items = filtered.slice((page - 1) * pageSize, page * pageSize)
  const summary = {
    total: rows.length,
    new: rows.filter((row) => Math.floor((Date.now() - new Date(row.createdAt).getTime()) / (24 * 60 * 60 * 1000)) <= 30).length,
    returning: rows.filter((row) => ['RETURNING', 'REGULAR', 'VIP'].includes(row.type)).length,
    vip: rows.filter((row) => row.type === 'VIP').length,
    inactive: rows.filter((row) => row.type === 'INACTIVE').length,
  }
  res.json({ items, total: filtered.length, page, pageSize, summary })
})

router.get('/customers/:id', requirePermission('customers.view'), async (req, res) => {
  const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id])
  if (!customer) return res.status(404).json({ error: 'Customer not found.' })
  const stats = await dbGet(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total ELSE 0 END), 0) AS spend,
            MAX(created_at) AS last_order
     FROM orders WHERE customer_id = ?`,
    [req.params.id],
  )
  const orders = await dbAll(
    `SELECT id, order_number, status, total, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20`,
    [req.params.id],
  )
  const favorites = await dbAll(
    `SELECT mi.id, mi.name, mi.image_url AS imageUrl, SUM(oi.quantity) AS quantity,
            round2(SUM(oi.subtotal), 2) AS revenue
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE o.customer_id = ? AND o.status != 'CANCELLED'
     GROUP BY mi.id ORDER BY quantity DESC LIMIT 5`,
    [req.params.id],
  )
  const reviews = await dbAll(
    `SELECT id, rating, title, message, created_at FROM reviews WHERE customer_id = ? ORDER BY created_at DESC LIMIT 5`,
    [req.params.id],
  )
  res.json({
    customer: {
      ...customer, id: Number(customer.id),
    },
    stats: {
      orders: Number(stats.orders), spend: round(stats.spend),
      averageOrder: Number(stats.orders) ? round(Number(stats.spend) / Number(stats.orders)) : 0,
      lastOrder: stats.last_order,
    },
    orders: orders.map((order) => ({ ...order, id: Number(order.id), total: Number(order.total) })),
    favorites: favorites.map((item) => ({ ...item, id: Number(item.id), quantity: Number(item.quantity), revenue: Number(item.revenue) })),
    reviews,
  })
})

export function validateCustomer(body, existing = {}) {
  const name = String(body.name ?? existing.name ?? '').trim()
  if (!name) return { error: 'Customer name is required.' }
  const email = String(body.email ?? existing.email ?? '').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' }
  return {
    values: {
      name, email,
      phone: String(body.phone ?? existing.phone ?? '').trim(),
      imageUrl: String(body.imageUrl ?? existing.image_url ?? '').trim(),
      notes: String(body.notes ?? existing.notes ?? '').trim(),
      type: String(body.type ?? existing.type ?? 'NEW').toUpperCase(),
    },
  }
}

router.post('/customers', requirePermission('customers.manage'), async (req, res) => {
  const result = validateCustomer(req.body || {})
  if (result.error) return res.status(400).json({ error: result.error })
  const v = result.values
  const insert = await dbRun(
    'INSERT INTO customers (name, email, phone, image_url, type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [v.name, v.email, v.phone, v.imageUrl, v.type, v.notes, nowIso()],
  )
  audit(req.user.id, 'CUSTOMER_CREATED', 'CUSTOMER', insert.lastInsertRowid, `Added customer ${v.name}`)
  res.status(201).json({ id: Number(insert.lastInsertRowid), message: 'Customer created.' })
})

router.put('/customers/:id', requirePermission('customers.manage'), async (req, res) => {
  const existing = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Customer not found.' })
  const result = validateCustomer(req.body || {}, existing)
  if (result.error) return res.status(400).json({ error: result.error })
  const v = result.values
  await dbRun('UPDATE customers SET name = ?, email = ?, phone = ?, image_url = ?, type = ?, notes = ? WHERE id = ?', [
    v.name, v.email, v.phone, v.imageUrl, v.type, v.notes, req.params.id,
  ])
  audit(req.user.id, 'CUSTOMER_UPDATED', 'CUSTOMER', req.params.id, `Updated customer ${v.name}`)
  res.json({ message: 'Customer updated.' })
})

router.delete('/customers/:id', requirePermission('customers.manage'), async (req, res) => {
  const existing = await dbGet('SELECT id, name FROM customers WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Customer not found.' })
  await dbRun('DELETE FROM customers WHERE id = ?', [req.params.id])
  audit(req.user.id, 'CUSTOMER_DELETED', 'CUSTOMER', req.params.id, `Deleted customer ${existing.name}`)
  res.json({ message: 'Customer deleted.' })
})

router.get('/customers/export/csv', requirePermission('customers.view'), async (req, res) => {
  const rows = await dbAll(
    `SELECT c.name, c.email, c.phone, COUNT(o.id) AS orders,
            COALESCE(SUM(CASE WHEN o.status != 'CANCELLED' THEN o.total ELSE 0 END), 0) AS spend,
            MAX(o.created_at) AS lastOrder
     FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.id ORDER BY spend DESC`,
  )
  const csv = toCsv(
    [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
      { key: 'orders', label: 'Orders' }, { key: 'spend', label: 'Total spend' }, { key: 'lastOrder', label: 'Last order' }],
    rows,
  )
  res.header('Content-Type', 'text/csv; charset=utf-8')
  res.header('Content-Disposition', 'attachment; filename="customers.csv"')
  res.send(csv)
})

function stockStatus(item) {
  if (Number(item.quantity) <= 0) return 'OUT'
  if (Number(item.quantity) <= Number(item.min_stock)) return 'LOW'
  if (Number(item.min_stock) > 0 && Number(item.quantity) > Number(item.min_stock) * 3) return 'OVER'
  return 'OK'
}

router.get('/inventory', requirePermission('inventory.view'), async (req, res) => {
  const term = String(req.query.q || '').trim()
  const clauses = []
  const params = []
  if (term) {
    clauses.push('(i.name ILIKE ? OR i.sku ILIKE ? OR i.category ILIKE ?)')
    const like = searchTerm(term)
    params.push(like, like, like)
  }
  if (req.query.category && req.query.category !== 'all') {
    clauses.push('i.category = ?'); params.push(req.query.category)
  }
  if (req.query.supplierId) {
    clauses.push('i.supplier_id = ?'); params.push(Number(req.query.supplierId))
  }
  const rows = (await dbAll(
    `SELECT i.*, s.name AS supplier_name FROM inventory_items i
     LEFT JOIN suppliers s ON s.id = i.supplier_id
     ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY i.name ASC`,
    params,
  )).map((row) => ({
    id: Number(row.id), name: row.name, sku: row.sku, category: row.category,
    quantity: Number(row.quantity), unit: row.unit, minStock: Number(row.min_stock),
    unitCost: Number(row.unit_cost), supplierId: row.supplier_id ? Number(row.supplier_id) : null,
    supplierName: row.supplier_name || '', imageUrl: row.image_url, createdAt: row.created_at,
    value: round(Number(row.quantity) * Number(row.unit_cost)), status: stockStatus(row),
  }))
  const status = String(req.query.status || 'all')
  const filtered = status === 'all' ? rows : rows.filter((row) => row.status === status)
  const summary = {
    items: rows.length,
    available: rows.filter((row) => row.status !== 'OUT').length,
    low: rows.filter((row) => row.status === 'LOW').length,
    out: rows.filter((row) => row.status === 'OUT').length,
    over: rows.filter((row) => row.status === 'OVER').length,
    value: round(rows.reduce((sum, row) => sum + row.value, 0)),
  }
  const categories = [...new Set(rows.map((row) => row.category))].sort()
  res.json({ items: filtered, summary, categories })
})

router.post('/inventory', requirePermission('inventory.manage'), async (req, res) => {
  const body = req.body || {}
  const name = String(body.name || '').trim()
  const sku = String(body.sku || '').trim()
  const unit = String(body.unit || '').trim()
  if (!name || !sku || !unit) return res.status(400).json({ error: 'Name, SKU and unit are required.' })
  if (await dbGet('SELECT id FROM inventory_items WHERE sku = ?', [sku])) return res.status(400).json({ error: 'That SKU is already in use.' })
  const insert = await dbRun(
    `INSERT INTO inventory_items (name, sku, category, quantity, unit, min_stock, unit_cost, supplier_id, image_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, sku, String(body.category || 'Ingredients'), Math.max(0, Number(body.quantity) || 0), unit,
      Math.max(0, Number(body.minStock) || 0), Math.max(0, Number(body.unitCost) || 0),
      body.supplierId || null, String(body.imageUrl || ''), nowIso()],
  )
  audit(req.user.id, 'INVENTORY_CREATED', 'INVENTORY', insert.lastInsertRowid, `Added inventory item ${name}`)
  res.status(201).json({ id: Number(insert.lastInsertRowid), message: 'Inventory item created.' })
})

router.put('/inventory/:id', requirePermission('inventory.manage'), async (req, res) => {
  const existing = await dbGet('SELECT * FROM inventory_items WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Inventory item not found.' })
  const body = req.body || {}
  const name = String(body.name ?? existing.name).trim()
  const sku = String(body.sku ?? existing.sku).trim()
  const unit = String(body.unit ?? existing.unit).trim()
  if (!name || !sku || !unit) return res.status(400).json({ error: 'Name, SKU and unit are required.' })
  if (await dbGet('SELECT id FROM inventory_items WHERE sku = ? AND id != ?', [sku, req.params.id])) {
    return res.status(400).json({ error: 'That SKU is already in use.' })
  }
  await dbRun(
    `UPDATE inventory_items SET name = ?, sku = ?, category = ?, unit = ?, min_stock = ?, unit_cost = ?, supplier_id = ?, image_url = ? WHERE id = ?`,
    [name, sku, String(body.category ?? existing.category), unit, Math.max(0, Number(body.minStock ?? existing.min_stock) || 0),
      Math.max(0, Number(body.unitCost ?? existing.unit_cost) || 0), body.supplierId !== undefined ? body.supplierId || null : existing.supplier_id,
      String(body.imageUrl ?? existing.image_url), req.params.id],
  )
  audit(req.user.id, 'INVENTORY_UPDATED', 'INVENTORY', req.params.id, `Updated inventory item ${name}`)
  res.json({ message: 'Inventory item updated.' })
})

router.delete('/inventory/:id', requirePermission('inventory.manage'), async (req, res) => {
  const existing = await dbGet('SELECT id, name FROM inventory_items WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Inventory item not found.' })
  await dbRun('DELETE FROM inventory_items WHERE id = ?', [req.params.id])
  audit(req.user.id, 'INVENTORY_DELETED', 'INVENTORY', req.params.id, `Deleted inventory item ${existing.name}`)
  res.json({ message: 'Inventory item deleted.' })
})

router.post('/inventory/:id/stock', requirePermission('inventory.manage'), async (req, res) => {
  const item = await dbGet('SELECT * FROM inventory_items WHERE id = ?', [req.params.id])
  if (!item) return res.status(404).json({ error: 'Inventory item not found.' })
  const type = String(req.body?.type || 'ADD').toUpperCase()
  const quantity = Number(req.body?.quantity)
  const reason = String(req.body?.reason || '').trim()
  if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ error: 'Enter a valid stock quantity.' })
  if (reason.length < 3) return res.status(400).json({ error: 'Add a short reason for this stock movement.' })
  const previous = Number(item.quantity)
  let next = previous
  let movementQuantity = quantity
  if (type === 'ADD' || type === 'PURCHASE') {
    if (quantity <= 0) return res.status(400).json({ error: 'Quantity must be greater than zero.' })
    next = round(previous + quantity)
  } else if (type === 'REMOVE') {
    if (quantity <= 0) return res.status(400).json({ error: 'Quantity must be greater than zero.' })
    if (quantity > previous) return res.status(400).json({ error: 'You cannot remove more stock than is available.' })
    next = round(previous - quantity)
    movementQuantity = -quantity
  } else if (type === 'ADJUST') {
    next = round(quantity)
    movementQuantity = round(next - previous)
  } else {
    return res.status(400).json({ error: 'Unknown stock movement type.' })
  }
  await transaction(async (db) => {
    await db.prepare('UPDATE inventory_items SET quantity = ? WHERE id = ?').run(next, item.id)
    if (type === 'PURCHASE' && req.body?.unitCost) {
      await db.prepare('UPDATE inventory_items SET unit_cost = ? WHERE id = ?').run(Number(req.body.unitCost), item.id)
    }
    await db.prepare(
      `INSERT INTO stock_movements (inventory_item_id, type, quantity, previous_quantity, new_quantity, reason, staff_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(item.id, type, movementQuantity, previous, next, reason, req.user.id, nowIso())
  })
  audit(req.user.id, type === 'PURCHASE' ? 'STOCK_PURCHASE' : 'STOCK_ADJUSTED', 'INVENTORY', item.id, `${item.name}: ${previous} → ${next} ${item.unit}`)
  if (next <= Number(item.min_stock)) {
    notify('Low stock warning', `${item.name} is at ${next} ${item.unit}. Minimum stock is ${item.min_stock} ${item.unit}.`, 'STOCK')
  }
  res.json({ message: 'Stock movement recorded.', quantity: next })
})

router.get('/inventory/movements', requirePermission('inventory.view'), async (req, res) => {
  const rows = await dbAll(
    `SELECT m.*, i.name AS item_name, i.unit, u.name AS staff_name
     FROM stock_movements m JOIN inventory_items i ON i.id = m.inventory_item_id
     LEFT JOIN users u ON u.id = m.staff_id ORDER BY m.created_at DESC LIMIT 120`,
  )
  res.json({
    movements: rows.map((row) => ({
      id: row.id, itemName: row.item_name, unit: row.unit, type: row.type,
      quantity: Number(row.quantity), previousQuantity: Number(row.previous_quantity),
      newQuantity: Number(row.new_quantity), reason: row.reason, staffName: row.staff_name,
      createdAt: row.created_at,
    })),
  })
})

router.get('/inventory/export/csv', requirePermission('inventory.view'), async (req, res) => {
  const rows = await dbAll(
    `SELECT i.name, i.sku, i.category, i.quantity, i.unit, i.min_stock AS minStock,
            i.unit_cost AS unitCost, round2(i.quantity * i.unit_cost, 2) AS value, s.name AS supplier
     FROM inventory_items i LEFT JOIN suppliers s ON s.id = i.supplier_id ORDER BY i.name`,
  )
  const csv = toCsv(
    [{ key: 'name', label: 'Item' }, { key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Quantity' }, { key: 'unit', label: 'Unit' }, { key: 'minStock', label: 'Minimum' },
      { key: 'unitCost', label: 'Unit cost' }, { key: 'value', label: 'Value' }, { key: 'supplier', label: 'Supplier' }],
    rows,
  )
  res.header('Content-Type', 'text/csv; charset=utf-8')
  res.header('Content-Disposition', 'attachment; filename="inventory.csv"')
  res.send(csv)
})

router.get('/suppliers', requirePermission('inventory.view'), async (req, res) => {
  const rows = await dbAll(
    `SELECT s.*, COUNT(i.id) AS item_count,
            COALESCE(SUM(i.quantity * i.unit_cost), 0) AS stock_value
     FROM suppliers s LEFT JOIN inventory_items i ON i.supplier_id = s.id
     GROUP BY s.id ORDER BY s.name`,
  )
  res.json({
    suppliers: rows.map((row) => ({
      id: Number(row.id), name: row.name, contactPerson: row.contact_person, phone: row.phone,
      email: row.email, address: row.address, products: row.products, createdAt: row.created_at,
      itemCount: Number(row.item_count), stockValue: round(row.stock_value),
    })),
  })
})

router.post('/suppliers', requirePermission('inventory.manage'), async (req, res) => {
  const body = req.body || {}
  if (!String(body.name || '').trim()) return res.status(400).json({ error: 'Supplier name is required.' })
  const insert = await dbRun(
    'INSERT INTO suppliers (name, contact_person, phone, email, address, products, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [String(body.name).trim(), String(body.contactPerson || ''), String(body.phone || ''), String(body.email || ''),
      String(body.address || ''), String(body.products || ''), nowIso()],
  )
  audit(req.user.id, 'SUPPLIER_CREATED', 'SUPPLIER', insert.lastInsertRowid, `Added supplier ${body.name}`)
  res.status(201).json({ id: Number(insert.lastInsertRowid), message: 'Supplier created.' })
})

router.put('/suppliers/:id', requirePermission('inventory.manage'), async (req, res) => {
  const existing = await dbGet('SELECT * FROM suppliers WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Supplier not found.' })
  const body = req.body || {}
  const name = String(body.name ?? existing.name).trim()
  if (!name) return res.status(400).json({ error: 'Supplier name is required.' })
  await dbRun(
    'UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, products = ? WHERE id = ?',
    [name, String(body.contactPerson ?? existing.contact_person), String(body.phone ?? existing.phone),
      String(body.email ?? existing.email), String(body.address ?? existing.address),
      String(body.products ?? existing.products), req.params.id],
  )
  audit(req.user.id, 'SUPPLIER_UPDATED', 'SUPPLIER', req.params.id, `Updated supplier ${name}`)
  res.json({ message: 'Supplier updated.' })
})

router.delete('/suppliers/:id', requirePermission('inventory.manage'), async (req, res) => {
  const existing = await dbGet('SELECT id, name FROM suppliers WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Supplier not found.' })
  await dbRun('DELETE FROM suppliers WHERE id = ?', [req.params.id])
  audit(req.user.id, 'SUPPLIER_DELETED', 'SUPPLIER', req.params.id, `Deleted supplier ${existing.name}`)
  res.json({ message: 'Supplier deleted.' })
})

export default router
