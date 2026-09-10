const express = require('express');
const { allSql, getSql, runSql } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = await allSql('SELECT * FROM customers ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  const { code, name, phone, remark } = req.body;

  if (!code || !name) {
    return res.status(400).json({ message: '客户编码和名称不能为空' });
  }

  try {
    const result = await runSql(
      `INSERT INTO customers (code, name, phone, remark, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      [code, name, phone || '', remark || '']
    );

    const row = await getSql('SELECT * FROM customers WHERE id = ?', [result.id]);
    res.status(201).json(row);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
