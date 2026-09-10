const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'ERP API v1',
    endpoints: [
      '/api/health',
      '/api/products',
      '/api/customers',
      '/api/orders',
      '/api/inventory',
      '/api/purchases'
    ]
  });
});

module.exports = router;
