const express = require('express');
const { allSql, getSql, runSql } = require('../db');

const router = express.Router();

// 获取所有生产单
router.get('/', async (req, res) => {
    try {
        const rows = await allSql('SELECT * FROM productions ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error('GET /api/productions 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 获取单个生产单
router.get('/:id', async (req, res) => {
    try {
        const row = await getSql('SELECT * FROM productions WHERE id = ?', [req.params.id]);
        if (!row) {
            return res.status(404).json({ message: '生产单不存在' });
        }
        res.json(row);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 创建生产单
router.post('/', async (req, res) => {
    const { order_id, order_no, product_name, plan_qty, qualified_qty, stage, status, start_date, end_date, remark } = req.body;

    if (!order_id) {
        return res.status(400).json({ message: '订单ID不能为空' });
    }

    try {
        const result = await runSql(
            `INSERT INTO productions 
             (order_id, order_no, product_name, plan_qty, qualified_qty, stage, status, start_date, end_date, remark, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
                order_id,
                order_no || '',
                product_name || '',
                Number(plan_qty) || 0,
                Number(qualified_qty) || 0,
                stage || '开料',
                status || '生产中',
                start_date || '',
                end_date || '',
                remark || ''
            ]
        );

        const row = await getSql('SELECT * FROM productions WHERE id = ?', [result.id]);
        res.status(201).json(row);
    } catch (error) {
        console.error('POST /api/productions 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 更新生产单
router.put('/:id', async (req, res) => {
    try {
        const existing = await getSql('SELECT * FROM productions WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ message: '生产单不存在' });
        }

        const { order_id, order_no, product_name, plan_qty, qualified_qty, stage, status, start_date, end_date, remark } = req.body;

        await runSql(
            `UPDATE productions SET 
                order_id = ?, 
                order_no = ?, 
                product_name = ?, 
                plan_qty = ?, 
                qualified_qty = ?, 
                stage = ?, 
                status = ?, 
                start_date = ?, 
                end_date = ?, 
                remark = ?
             WHERE id = ?`,
            [
                order_id !== undefined ? order_id : existing.order_id,
                order_no !== undefined ? order_no : existing.order_no,
                product_name !== undefined ? product_name : existing.product_name,
                Number(plan_qty !== undefined ? plan_qty : existing.plan_qty),
                Number(qualified_qty !== undefined ? qualified_qty : existing.qualified_qty),
                stage || existing.stage,
                status || existing.status,
                start_date !== undefined ? start_date : existing.start_date,
                end_date !== undefined ? end_date : existing.end_date,
                remark !== undefined ? remark : existing.remark,
                req.params.id
            ]
        );

        const row = await getSql('SELECT * FROM productions WHERE id = ?', [req.params.id]);
        res.json(row);
    } catch (error) {
        console.error('PUT /api/productions/:id 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 删除生产单
router.delete('/:id', async (req, res) => {
    try {
        const existing = await getSql('SELECT * FROM productions WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ message: '生产单不存在' });
        }

        await runSql('DELETE FROM productions WHERE id = ?', [req.params.id]);
        res.json({ message: '删除成功' });
    } catch (error) {
        console.error('DELETE /api/productions/:id 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;