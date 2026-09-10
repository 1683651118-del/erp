const express = require('express');
const { allSql, getSql, runSql } = require('../db');

const router = express.Router();

// 获取所有外发记录
router.get('/', async (req, res) => {
    try {
        const rows = await allSql('SELECT * FROM outsource ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error('GET /api/outsource 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 获取单个外发记录
router.get('/:id', async (req, res) => {
    try {
        const row = await getSql('SELECT * FROM outsource WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ message: '外发记录不存在' });
        res.json(row);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 创建外发记录
router.post('/', async (req, res) => {
    const { order_id, outsource_no, status, location, outsource_date, supplier, return_date, remark } = req.body;

    if (!order_id || !outsource_no) {
        return res.status(400).json({ message: '订单ID和外发单号不能为空' });
    }

    try {
        const result = await runSql(
            `INSERT INTO outsource 
             (order_id, outsource_no, status, location, outsource_date, supplier, return_date, remark, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
                order_id,
                outsource_no,
                status || '待外发',
                location || '5楼',
                outsource_date || '',
                supplier || '',
                return_date || '',
                remark || ''
            ]
        );

        const row = await getSql('SELECT * FROM outsource WHERE id = ?', [result.id]);
        res.status(201).json(row);
    } catch (error) {
        console.error('POST /api/outsource 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// ★★★ 更新外发记录（PUT）★★★
router.put('/:id', async (req, res) => {
    try {
        const existing = await getSql('SELECT * FROM outsource WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ message: '外发记录不存在' });
        }

        const { order_id, outsource_no, status, location, outsource_date, supplier, return_date, remark } = req.body;

        await runSql(
            `UPDATE outsource SET 
                order_id = ?, 
                outsource_no = ?, 
                status = ?, 
                location = ?, 
                outsource_date = ?, 
                supplier = ?, 
                return_date = ?, 
                remark = ?
             WHERE id = ?`,
            [
                order_id !== undefined ? order_id : existing.order_id,
                outsource_no || existing.outsource_no,
                status || existing.status,
                location !== undefined ? location : existing.location,
                outsource_date !== undefined ? outsource_date : existing.outsource_date,
                supplier !== undefined ? supplier : existing.supplier,
                return_date !== undefined ? return_date : existing.return_date,
                remark !== undefined ? remark : existing.remark,
                req.params.id
            ]
        );

        const row = await getSql('SELECT * FROM outsource WHERE id = ?', [req.params.id]);
        res.json(row);
    } catch (error) {
        console.error('PUT /api/outsource/:id 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 删除外发记录
router.delete('/:id', async (req, res) => {
    try {
        const existing = await getSql('SELECT * FROM outsource WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ message: '外发记录不存在' });
        }
        await runSql('DELETE FROM outsource WHERE id = ?', [req.params.id]);
        res.json({ message: '删除成功' });
    } catch (error) {
        console.error('DELETE /api/outsource/:id 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 清空所有外发记录
router.delete('/', async (req, res) => {
    try {
        await runSql('DELETE FROM outsource');
        res.json({ message: '清空成功' });
    } catch (error) {
        console.error('DELETE /api/outsource 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;