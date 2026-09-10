const express = require('express');
const { allSql, getSql, runSql } = require('../db');

const router = express.Router();

// 获取所有库存流水
router.get('/logs', async (req, res) => {
    try {
        const rows = await allSql('SELECT * FROM inventory_logs ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error('GET /api/inventory/logs 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 获取某个产品的流水
router.get('/logs/product/:productId', async (req, res) => {
    try {
        const rows = await allSql(
            'SELECT * FROM inventory_logs WHERE product_id = ? ORDER BY id DESC',
            [req.params.productId]
        );
        res.json(rows);
    } catch (error) {
        console.error('GET /api/inventory/logs/product/:productId 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 记录库存流水（入库/出库/调整）
router.post('/log', async (req, res) => {
    const {
        product_id, product_name, product_code, customer_code,
        material_type, type, qty, before_qty, after_qty,
        location, remark, operator
    } = req.body;

    if (!product_id || !type || qty === undefined) {
        return res.status(400).json({ message: '产品ID、类型和数量不能为空' });
    }

    try {
        // 验证产品是否存在
        const product = await getSql('SELECT * FROM products WHERE id = ?', [product_id]);
        if (!product) {
            return res.status(404).json({ message: '产品不存在' });
        }

        const result = await runSql(
            `INSERT INTO inventory_logs 
             (product_id, product_name, product_code, customer_code, material_type, type, qty, before_qty, after_qty, location, remark, operator, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
                product_id,
                product_name || product.name || '',
                product_code || product.code || '',
                customer_code || product.customer_code || '',
                material_type || 'product',
                type,
                Number(qty),
                before_qty !== undefined ? Number(before_qty) : 0,
                after_qty !== undefined ? Number(after_qty) : 0,
                location || '',
                remark || '',
                operator || '管理员'
            ]
        );

        const row = await getSql('SELECT * FROM inventory_logs WHERE id = ?', [result.id]);
        res.status(201).json(row);
    } catch (error) {
        console.error('POST /api/inventory/log 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 清空所有流水记录（谨慎使用）
router.delete('/logs', async (req, res) => {
    try {
        await runSql('DELETE FROM inventory_logs');
        res.json({ message: '清空成功' });
    } catch (error) {
        console.error('DELETE /api/inventory/logs 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;