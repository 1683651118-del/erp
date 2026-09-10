const express = require('express');
const { allSql, getSql, runSql } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = await allSql('SELECT * FROM purchase_orders ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  const { supplier, order_no, total_amount, status, remark } = req.body;

  if (!order_no) {
    return res.status(400).json({ message: '采购单号不能为空' });
  }

  try {
    const result = await runSql(
      `INSERT INTO purchase_orders (supplier, order_no, total_amount, status, remark, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [supplier || '', order_no, Number(total_amount) || 0, status || '待审核', remark || '']
    );

    const row = await getSql('SELECT * FROM purchase_orders WHERE id = ?', [result.id]);
    res.status(201).json(row);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
