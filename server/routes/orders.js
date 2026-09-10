const express = require('express');
const { allSql, getSql, runSql } = require('../db');

const router = express.Router();

// ============================================================
//  GET 请求
// ============================================================

// 获取所有订单
router.get('/', async (req, res) => {
    try {
        const rows = await allSql('SELECT * FROM orders ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error('GET /api/orders 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// 获取单个订单（按 ID）
router.get('/:id', async (req, res) => {
    try {
        const row = await getSql('SELECT * FROM orders WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ message: '订单不存在' });
        res.json(row);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 通过订单号获取订单（出货管理专用）
router.get('/by-order/:orderNo', async (req, res) => {
    try {
        const orderNo = req.params.orderNo;
        console.log('🔍 [GET /by-order] 查询订单号:', orderNo);
        // ★★★ 使用 trim() 去除可能的前后空格 ★★★
        const row = await getSql('SELECT * FROM orders WHERE order_no = ?', [orderNo.trim()]);
        if (!row) {
            console.log('❌ 未找到订单号:', orderNo);
            return res.status(404).json({ message: '订单不存在' });
        }
        console.log('✅ 找到订单，ID:', row.id);
        res.json(row);
    } catch (error) {
        console.error('GET /by-order 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// ============================================================
//  POST 请求
// ============================================================

// 创建订单
router.post('/', async (req, res) => {
    const { order_no, customer_code, product_code, product_name, qty, order_date, delivery_date, remark, status, extra } = req.body;
    if (!order_no || !product_name || !qty) {
        return res.status(400).json({ message: '订单号、产品名称和数量不能为空' });
    }
    try {
        const result = await runSql(
            `INSERT INTO orders (order_no, customer_code, product_code, product_name, qty, order_date, delivery_date, remark, status, extra, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [order_no, customer_code || '', product_code || '', product_name, Number(qty) || 0, order_date || '', delivery_date || '', remark || '', status || '待生产', extra || null]
        );
        const row = await getSql('SELECT * FROM orders WHERE id = ?', [result.id]);
        res.status(201).json(row);
    } catch (error) {
        console.error('POST /api/orders 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// ============================================================
//  PUT 请求
// ============================================================

// 更新订单（按 ID）
router.put('/:id', async (req, res) => {
    const orderId = req.params.id;
    console.log(`📥 [PUT /:id] 收到请求，ID: ${orderId}`);
    try {
        const existing = await getSql('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (!existing) {
            console.log(`❌ 订单 ID ${orderId} 不存在`);
            return res.status(404).json({ message: '订单不存在' });
        }

        const { order_no, customer_code, product_code, product_name, qty, order_date, delivery_date, remark, status, extra } = req.body;

        // 如果 extra 是对象，转为 JSON 字符串；否则保持原样
        let extraStr = extra;
        if (extra && typeof extra === 'object') {
            extraStr = JSON.stringify(extra);
        }

        await runSql(
            `UPDATE orders SET 
                order_no = ?,
                customer_code = ?,
                product_code = ?,
                product_name = ?,
                qty = ?,
                order_date = ?,
                delivery_date = ?,
                remark = ?,
                status = ?,
                extra = ?
             WHERE id = ?`,
            [
                order_no || existing.order_no,
                customer_code !== undefined ? customer_code : existing.customer_code,
                product_code !== undefined ? product_code : existing.product_code,
                product_name || existing.product_name,
                Number(qty) || existing.qty,
                order_date !== undefined ? order_date : existing.order_date,
                delivery_date !== undefined ? delivery_date : existing.delivery_date,
                remark !== undefined ? remark : existing.remark,
                status || existing.status,
                extraStr !== undefined ? extraStr : existing.extra,
                orderId
            ]
        );

        const row = await getSql('SELECT * FROM orders WHERE id = ?', [orderId]);
        console.log(`✅ 订单 ID ${orderId} 更新成功`);
        res.json(row);
    } catch (error) {
        console.error(`❌ PUT /api/orders/:id 错误 (ID: ${orderId}):`, error);
        res.status(500).json({ message: error.message });
    }
});

// 通过订单号更新订单（出货管理专用）
router.put('/by-order/:orderNo', async (req, res) => {
    const orderNo = req.params.orderNo;
    console.log(`📥 [PUT /by-order] 收到请求，订单号: ${orderNo}`);
    try {
        const existing = await getSql('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
        if (!existing) {
            console.log(`❌ 订单号 ${orderNo} 不存在`);
            return res.status(404).json({ message: '订单不存在' });
        }
        const id = existing.id;

        const { order_no, customer_code, product_code, product_name, qty, order_date, delivery_date, remark, status, extra } = req.body;

        let extraStr = extra;
        if (extra && typeof extra === 'object') {
            extraStr = JSON.stringify(extra);
        }

        await runSql(
            `UPDATE orders SET 
                order_no = ?,
                customer_code = ?,
                product_code = ?,
                product_name = ?,
                qty = ?,
                order_date = ?,
                delivery_date = ?,
                remark = ?,
                status = ?,
                extra = ?
             WHERE id = ?`,
            [
                order_no || existing.order_no,
                customer_code !== undefined ? customer_code : existing.customer_code,
                product_code !== undefined ? product_code : existing.product_code,
                product_name || existing.product_name,
                Number(qty) || existing.qty,
                order_date !== undefined ? order_date : existing.order_date,
                delivery_date !== undefined ? delivery_date : existing.delivery_date,
                remark !== undefined ? remark : existing.remark,
                status || existing.status,
                extraStr !== undefined ? extraStr : existing.extra,
                id
            ]
        );

        const row = await getSql('SELECT * FROM orders WHERE id = ?', [id]);
        console.log(`✅ 订单号 ${orderNo} (ID: ${id}) 更新成功`);
        res.json(row);
    } catch (error) {
        console.error(`❌ PUT /api/orders/by-order/:orderNo 错误 (订单号: ${orderNo}):`, error);
        res.status(500).json({ message: error.message });
    }
});

// ============================================================
//  DELETE 请求
// ============================================================

// 按 ID 删除订单（级联删除外发记录）
router.delete('/:id', async (req, res) => {
    try {
        const existing = await getSql('SELECT * FROM orders WHERE id = ?', [req.params.id]);
        if (!existing) return res.status(404).json({ message: '订单不存在' });
        await runSql('DELETE FROM outsource WHERE order_id = ?', [req.params.id]);
        await runSql('DELETE FROM productions WHERE order_id = ?', [req.params.id]);
        await runSql('DELETE FROM orders WHERE id = ?', [req.params.id]);
        res.json({ message: '删除成功' });
    } catch (error) {
        console.error('DELETE /api/orders/:id 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

// ★★★ 新增：按订单号删除订单（前端 orders.js 会调用） ★★★
router.delete('/by-order/:orderNo', async (req, res) => {
    const orderNo = req.params.orderNo;
    console.log(`🗑️ [DELETE /by-order] 通过订单号删除: ${orderNo}`);
    try {
        const existing = await getSql('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
        if (!existing) {
            console.log(`❌ 订单号 ${orderNo} 不存在`);
            return res.status(404).json({ message: '订单不存在' });
        }
        const id = existing.id;

        // 级联删除外发记录
        await runSql('DELETE FROM outsource WHERE order_id = ?', [id]);
        // 删除生产记录
        await runSql('DELETE FROM productions WHERE order_id = ?', [id]);
        // 删除订单
        await runSql('DELETE FROM orders WHERE id = ?', [id]);

        console.log(`✅ 订单号 ${orderNo} (ID: ${id}) 删除成功`);
        res.json({ message: '删除成功', orderNo });
    } catch (error) {
        console.error(`❌ DELETE /api/orders/by-order/:orderNo 错误 (订单号: ${orderNo}):`, error);
        res.status(500).json({ message: error.message });
    }
});

// 清空所有订单（危险操作）
router.delete('/clear', async (req, res) => {
    try {
        await runSql('DELETE FROM outsource');
        await runSql('DELETE FROM productions');
        await runSql('DELETE FROM orders');
        res.json({ message: '所有订单已清空' });
    } catch (error) {
        console.error('DELETE /api/orders/clear 错误:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;