const express = require('express');
const { allSql, getSql, runSql } = require('../db');

const router = express.Router();

// 获取所有产品
router.get('/', async (req, res) => {
    try {
        const rows = await allSql('SELECT * FROM products ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error('GET /api/products 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 获取单个产品
router.get('/:id', async (req, res) => {
    try {
        const row = await getSql('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!row) {
            return res.status(404).json({ message: '产品不存在' });
        }
        res.json(row);
    } catch (error) {
        console.error('GET /api/products/:id 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 创建产品（支持 extra 字段）
router.post('/', async (req, res) => {
    const body = req.body || {};
    const code = body.code || body.productCode || '';
    const name = body.name || body.productName || '';
    const spec = body.spec || body.productSpec || '';
    const customer_code = body.customer_code ?? body.customerCode ?? '';
    const stock = body.stock ?? body.inventory ?? 0;
    const status = body.status || '在库';
    const remark = body.remark || '';
    const extra = body.extra || null;

    if (!code || !name) {
        return res.status(400).json({ message: '产品编码和名称不能为空' });
    }

    try {
        const result = await runSql(
            `INSERT INTO products (code, name, spec, customer_code, stock, status, remark, extra, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [code, name, spec, customer_code, Number(stock) || 0, status, remark, extra]
        );

        const row = await getSql('SELECT * FROM products WHERE id = ?', [result.id]);
        res.status(201).json(row);
    } catch (error) {
        console.error('POST /api/products 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 更新产品（支持 extra 字段）
router.put('/:id', async (req, res) => {
    const body = req.body || {};
    const code = body.code || body.productCode || undefined;
    const name = body.name || body.productName || undefined;
    const spec = body.spec || body.productSpec || undefined;
    const customer_code = body.customer_code ?? body.customerCode ?? undefined;
    const stock = body.stock ?? body.inventory ?? undefined;
    const status = body.status || undefined;
    const remark = body.remark ?? undefined;
    const extra = body.extra !== undefined ? body.extra : undefined;

    try {
        const existing = await getSql('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ message: '产品不存在' });
        }

        await runSql(
            `UPDATE products SET 
                code = ?, 
                name = ?, 
                spec = ?, 
                customer_code = ?, 
                stock = ?, 
                status = ?, 
                remark = ?,
                extra = ?
             WHERE id = ?`,
            [
                code || existing.code,
                name || existing.name,
                spec !== undefined ? spec : existing.spec,
                customer_code !== undefined ? customer_code : existing.customer_code,
                Number(stock !== undefined ? stock : existing.stock),
                status || existing.status,
                remark !== undefined ? remark : existing.remark,
                extra !== undefined ? extra : existing.extra,
                req.params.id
            ]
        );

        const row = await getSql('SELECT * FROM products WHERE id = ?', [req.params.id]);
        res.json(row);
    } catch (error) {
        console.error('PUT /api/products/:id 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 删除单个产品
router.delete('/:id', async (req, res) => {
    try {
        const existing = await getSql('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ message: '产品不存在' });
        }

        await runSql('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ message: '删除成功' });
    } catch (error) {
        console.error('DELETE /api/products/:id 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 清空所有产品
router.delete('/', async (req, res) => {
    try {
        await runSql('DELETE FROM products');
        res.json({ message: '清空成功' });
    } catch (error) {
        console.error('DELETE /api/products 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;