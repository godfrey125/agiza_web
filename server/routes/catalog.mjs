import express from 'express'
import {
  audit, dbAll, dbGet, dbRun, nowIso, pagination, requireAuth,
  requirePermission, round, safeJson, searchTerm,
} from '../lib/core.mjs'
import { saveStoredUpload } from '../lib/uploads.mjs'

const router = express.Router()
router.use(requireAuth)

function numberOr(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function booleanInt(value) {
  return value ? 1 : 0
}

router.get('/menu', requirePermission('menu.view'), async (req, res) => {
  const { page, pageSize, offset } = pagination(req.query, 12)
  const clauses = []
  const params = []
  const term = String(req.query.q || '').trim()
  if (term) {
    clauses.push('(mi.name ILIKE ? OR mi.description ILIKE ? OR mi.ingredients ILIKE ?)')
    const like = searchTerm(term)
    params.push(like, like, like)
  }
  if (req.query.category && req.query.category !== 'all') {
    clauses.push('mi.category_id = ?')
    params.push(Number(req.query.category))
  }
  if (req.query.availability === 'available') clauses.push('mi.available = 1')
  if (req.query.availability === 'unavailable') clauses.push('mi.available = 0')
  if (req.query.featured === 'true') clauses.push('mi.featured = 1')
  if (req.query.categoryId === 'uncategorized') clauses.push('mi.category_id IS NULL')

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const sortMap = {
    newest: 'mi.created_at DESC',
    oldest: 'mi.created_at ASC',
    price_asc: 'mi.price ASC',
    price_desc: 'mi.price DESC',
    name: 'mi.name ASC',
    sales: 'sales DESC',
  }
  const sort = sortMap[req.query.sort] || sortMap.newest
  const total = (await dbGet(`SELECT COUNT(*) AS count FROM menu_items mi ${where}`, params))?.count || 0
  const rows = await dbAll(
    `SELECT mi.*, c.name AS category_name,
            (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.menu_item_id = mi.id) AS sales,
            (SELECT COUNT(DISTINCT oi.order_id) FROM order_items oi WHERE oi.menu_item_id = mi.id) AS order_count
     FROM menu_items mi LEFT JOIN categories c ON c.id = mi.category_id
     ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  )
  const summary = await dbGet(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN available = 1 THEN 1 ELSE 0 END) AS available,
            SUM(CASE WHEN available = 0 THEN 1 ELSE 0 END) AS unavailable,
            SUM(CASE WHEN featured = 1 THEN 1 ELSE 0 END) AS featured
     FROM menu_items`,
  )
  res.json({
    items: rows.map((row) => ({
      ...row,
      id: Number(row.id),
      price: Number(row.price),
      costPrice: Number(row.cost_price),
      preparationTime: Number(row.preparation_time),
      available: Boolean(row.available),
      featured: Boolean(row.featured),
      sales: Number(row.sales),
      orderCount: Number(row.order_count),
      profitMargin: Number(row.price) ? round(((Number(row.price) - Number(row.cost_price)) / Number(row.price)) * 100) : 0,
      recipe: safeJson(row.recipe_json, []),
    })),
    total: Number(total),
    page,
    pageSize,
    summary: {
      total: Number(summary?.total || 0),
      available: Number(summary?.available || 0),
      unavailable: Number(summary?.unavailable || 0),
      featured: Number(summary?.featured || 0),
    },
  })
})

router.get('/menu/:id', requirePermission('menu.view'), async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.status(404).json({ error: 'Menu item not found.' })
  }
  const row = await dbGet(
    `SELECT mi.*, c.name AS category_name, c.image_url AS category_image
     FROM menu_items mi LEFT JOIN categories c ON c.id = mi.category_id WHERE mi.id = ?`,
    [req.params.id],
  )
  if (!row) return res.status(404).json({ error: 'Menu item not found.' })
  const stats = await dbGet(
    `SELECT COUNT(DISTINCT oi.order_id) AS orders, COALESCE(SUM(oi.quantity), 0) AS quantity,
            COALESCE(SUM(oi.subtotal), 0) AS revenue
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.menu_item_id = ? AND o.status != 'CANCELLED'`,
    [req.params.id],
  )
  const recentOrders = await dbAll(
    `SELECT o.id, o.order_number, o.status, o.created_at, oi.quantity, oi.subtotal,
            c.name AS customer_name
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE oi.menu_item_id = ? ORDER BY o.created_at DESC LIMIT 8`,
    [req.params.id],
  )
  const reviews = await dbAll(
    `SELECT r.id, r.rating, r.title, r.message, r.created_at, c.name AS customer_name
     FROM reviews r LEFT JOIN customers c ON c.id = r.customer_id
     WHERE r.menu_item_id = ? ORDER BY r.created_at DESC LIMIT 5`,
    [req.params.id],
  )
  res.json({
    item: {
      ...row,
      id: Number(row.id),
      price: Number(row.price),
      costPrice: Number(row.cost_price),
      preparationTime: Number(row.preparation_time),
      available: Boolean(row.available),
      featured: Boolean(row.featured),
      recipe: safeJson(row.recipe_json, []),
      profitMargin: Number(row.price) ? round(((Number(row.price) - Number(row.cost_price)) / Number(row.price)) * 100) : 0,
    },
    stats: {
      orders: Number(stats.orders),
      quantity: Number(stats.quantity),
      revenue: round(stats.revenue),
      averageOrder: Number(stats.quantity) ? round(stats.revenue / Number(stats.orders || 1)) : 0,
    },
    recentOrders: recentOrders.map((order) => ({ ...order, id: Number(order.id), quantity: Number(order.quantity), subtotal: Number(order.subtotal) })),
    reviews,
  })
})

export async function validateMenuItem(body, existing = {}) {
  const name = String(body.name ?? existing.name ?? '').trim()
  const categoryId = body.categoryId !== undefined ? body.categoryId : existing.category_id
  const price = numberOr(body.price !== undefined ? body.price : existing.price)
  const costPrice = numberOr(body.costPrice !== undefined ? body.costPrice : existing.cost_price)
  if (!name) return { error: 'Menu item name is required.' }
  if (!categoryId) return { error: 'Choose a category for this item.' }
  if (price <= 0) return { error: 'Selling price must be greater than zero.' }
  if (costPrice < 0) return { error: 'Cost price cannot be negative.' }
  const category = await dbGet('SELECT id FROM categories WHERE id = ?', [categoryId])
  if (!category) return { error: 'The selected category no longer exists.' }
  const recipe = Array.isArray(body.recipe) ? body.recipe : safeJson(existing.recipe_json, [])
  return {
    values: {
      name,
      description: String(body.description ?? existing.description ?? '').trim(),
      categoryId: Number(categoryId),
      price: round(price),
      costPrice: round(costPrice),
      imageUrl: String(body.imageUrl ?? existing.image_url ?? '').trim(),
      ingredients: String(body.ingredients ?? existing.ingredients ?? '').trim(),
      preparationTime: Math.max(1, numberOr(body.preparationTime !== undefined ? body.preparationTime : existing.preparation_time, 20)),
      available: booleanInt(body.available !== undefined ? body.available : existing.available ?? true),
      featured: booleanInt(body.featured !== undefined ? body.featured : existing.featured ?? false),
      recipe: JSON.stringify(Array.isArray(recipe) ? recipe : []),
    },
  }
}

router.post('/menu', requirePermission('menu.manage'), async (req, res) => {
  const result = await validateMenuItem(req.body || {})
  if (result.error) return res.status(400).json({ error: result.error })
  const v = result.values
  const insert = await dbRun(
    `INSERT INTO menu_items
      (name, description, category_id, price, cost_price, image_url, ingredients, preparation_time, available, featured, recipe_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [v.name, v.description, v.categoryId, v.price, v.costPrice, v.imageUrl, v.ingredients, v.preparationTime, v.available, v.featured, v.recipe, nowIso()],
  )
  const id = Number(insert.lastInsertRowid)
  audit(req.user.id, 'MENU_CREATED', 'MENU_ITEM', id, `Created menu item ${v.name}`)
  res.status(201).json({ id, message: 'Menu item created.' })
})

router.put('/menu/:id', requirePermission('menu.manage'), async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.status(404).json({ error: 'Menu item not found.' })
  }
  const existing = await dbGet('SELECT * FROM menu_items WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Menu item not found.' })
  const result = await validateMenuItem(req.body || {}, existing)
  if (result.error) return res.status(400).json({ error: result.error })
  const v = result.values
  await dbRun(
    `UPDATE menu_items SET name = ?, description = ?, category_id = ?, price = ?, cost_price = ?,
      image_url = ?, ingredients = ?, preparation_time = ?, available = ?, featured = ?, recipe_json = ?
     WHERE id = ?`,
    [v.name, v.description, v.categoryId, v.price, v.costPrice, v.imageUrl, v.ingredients, v.preparationTime, v.available, v.featured, v.recipe, req.params.id],
  )
  audit(req.user.id, 'MENU_UPDATED', 'MENU_ITEM', req.params.id, `Updated menu item ${v.name}`)
  res.json({ message: 'Menu item updated.' })
})

router.delete('/menu/:id', requirePermission('menu.manage'), async (req, res) => {
  if (!/^\d+$/.test(String(req.params.id))) {
    return res.status(404).json({ error: 'Menu item not found.' })
  }
  const existing = await dbGet('SELECT id, name FROM menu_items WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Menu item not found.' })
  await dbRun('DELETE FROM menu_items WHERE id = ?', [req.params.id])
  audit(req.user.id, 'MENU_DELETED', 'MENU_ITEM', req.params.id, `Deleted menu item ${existing.name}`)
  res.json({ message: 'Menu item deleted.' })
})

router.get('/categories', requirePermission('categories.view'), async (req, res) => {
  const term = String(req.query.q || '').trim()
  const clauses = []
  const params = []
  if (term) {
    clauses.push('(c.name ILIKE ? OR c.description ILIKE ?)')
    params.push(searchTerm(term), searchTerm(term))
  }
  if (req.query.status === 'ACTIVE') clauses.push("c.status = 'ACTIVE'")
  if (req.query.status === 'INACTIVE') clauses.push("c.status = 'INACTIVE'")
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await dbAll(
    `SELECT c.*, COUNT(mi.id) AS item_count,
            SUM(CASE WHEN mi.available = 1 THEN 1 ELSE 0 END) AS available_items,
            COALESCE((SELECT SUM(oi.subtotal) FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id
              JOIN orders o ON o.id = oi.order_id WHERE m.category_id = c.id AND o.status != 'CANCELLED'), 0) AS revenue
     FROM categories c LEFT JOIN menu_items mi ON mi.category_id = c.id
     ${where} GROUP BY c.id ORDER BY c.name ASC`,
    params,
  )
  const summary = await dbGet(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive
     FROM categories`,
  )
  const uncategorized = (await dbGet('SELECT COUNT(*) AS count FROM menu_items WHERE category_id IS NULL'))?.count || 0
  res.json({
    items: rows.map((row) => ({
      ...row,
      id: Number(row.id),
      itemCount: Number(row.item_count),
      availableItems: Number(row.available_items),
      revenue: round(row.revenue),
    })),
    summary: {
      total: Number(summary?.total || 0),
      active: Number(summary?.active || 0),
      inactive: Number(summary?.inactive || 0),
      withoutCategory: Number(uncategorized),
    },
  })
})

router.get('/categories/:id', requirePermission('categories.view'), async (req, res) => {
  const category = await dbGet('SELECT * FROM categories WHERE id = ?', [req.params.id])
  if (!category) return res.status(404).json({ error: 'Category not found.' })
  const items = await dbAll(
    `SELECT mi.*, (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.menu_item_id = mi.id) AS sales
     FROM menu_items mi WHERE mi.category_id = ? ORDER BY sales DESC, mi.name ASC`,
    [req.params.id],
  )
  const stats = await dbGet(
    `SELECT COUNT(DISTINCT oi.order_id) AS orders, COALESCE(SUM(oi.subtotal), 0) AS revenue
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE mi.category_id = ? AND o.status != 'CANCELLED'`,
    [req.params.id],
  )
  res.json({
    category: { ...category, id: Number(category.id) },
    stats: { orders: Number(stats.orders), revenue: round(stats.revenue) },
    items: items.map((item) => ({
      ...item,
      id: Number(item.id),
      price: Number(item.price),
      costPrice: Number(item.cost_price),
      available: Boolean(item.available),
      featured: Boolean(item.featured),
      sales: Number(item.sales),
    })),
  })
})

export async function validateCategory(body, existing = {}) {
  const name = String(body.name ?? existing.name ?? '').trim()
  if (!name) return { error: 'Category name is required.' }
  if (body.name && body.name !== existing.name) {
    const duplicate = await dbGet('SELECT id FROM categories WHERE lower(name) = lower(?) AND id != ?', [name, existing.id || 0])
    if (duplicate) return { error: 'A category with this name already exists.' }
  }
  return {
    values: {
      name,
      description: String(body.description ?? existing.description ?? '').trim(),
      imageUrl: String(body.imageUrl ?? existing.image_url ?? '').trim(),
      status: String(body.status ?? existing.status ?? 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    },
  }
}

router.post('/categories', requirePermission('categories.manage'), async (req, res) => {
  const result = await validateCategory(req.body || {})
  if (result.error) return res.status(400).json({ error: result.error })
  const v = result.values
  const insert = await dbRun(
    'INSERT INTO categories (name, description, image_url, status, created_at) VALUES (?, ?, ?, ?, ?)',
    [v.name, v.description, v.imageUrl, v.status, nowIso()],
  )
  const id = Number(insert.lastInsertRowid)
  audit(req.user.id, 'CATEGORY_CREATED', 'CATEGORY', id, `Created category ${v.name}`)
  res.status(201).json({ id, message: 'Category created.' })
})

router.put('/categories/:id', requirePermission('categories.manage'), async (req, res) => {
  const existing = await dbGet('SELECT * FROM categories WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Category not found.' })
  const result = await validateCategory(req.body || {}, existing)
  if (result.error) return res.status(400).json({ error: result.error })
  const v = result.values
  await dbRun('UPDATE categories SET name = ?, description = ?, image_url = ?, status = ? WHERE id = ?', [
    v.name, v.description, v.imageUrl, v.status, req.params.id,
  ])
  audit(req.user.id, 'CATEGORY_UPDATED', 'CATEGORY', req.params.id, `Updated category ${v.name}`)
  res.json({ message: 'Category updated.' })
})

router.delete('/categories/:id', requirePermission('categories.manage'), async (req, res) => {
  const existing = await dbGet('SELECT id, name FROM categories WHERE id = ?', [req.params.id])
  if (!existing) return res.status(404).json({ error: 'Category not found.' })
  const count = (await dbGet('SELECT COUNT(*) AS count FROM menu_items WHERE category_id = ?', [req.params.id]))?.count || 0
  if (Number(count) > 0) {
    return res.status(409).json({ error: `Move the ${count} menu item${Number(count) === 1 ? '' : 's'} in this category before deleting it.` })
  }
  await dbRun('DELETE FROM categories WHERE id = ?', [req.params.id])
  audit(req.user.id, 'CATEGORY_DELETED', 'CATEGORY', req.params.id, `Deleted category ${existing.name}`)
  res.json({ message: 'Category deleted.' })
})

router.post('/uploads', async (req, res) => {
  const result = await saveStoredUpload(req.body?.dataUrl)
  if (result.error) return res.status(400).json({ error: result.error })
  res.status(201).json({ url: result.url, message: 'Image uploaded.' })
})

export default router
