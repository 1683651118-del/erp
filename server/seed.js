const { db, initDatabase } = require('./db');

async function seed() {
  await initDatabase();

  const samples = [
    [
      'customers',
      `INSERT INTO customers (code, name, phone, remark) VALUES
      ('C001', '客户A', '13800000001', '重点客户'),
      ('C002', '客户B', '13800000002', '长期合作')`
    ],
    [
      'products',
      `INSERT INTO products (code, name, spec, customer_code, stock, status, remark) VALUES
      ('P1001', '产品A', '120x80', 'C001', 100, '在库', '常规产品'),
      ('P1002', '产品B', '150x90', 'C002', 80, '在库', '外发产品')`
    ],
    [
      'orders',
      `INSERT INTO orders (order_no, customer_code, product_code, product_name, qty, order_date, delivery_date, remark, status) VALUES
      ('SO-2026001', 'C001', 'P1001', '产品A', 20, '2026-08-30', '2026-09-05', '首批订单', '待生产'),
      ('SO-2026002', 'C002', 'P1002', '产品B', 15, '2026-08-31', '2026-09-06', '补货订单', '待出货')`
    ]
  ];

  for (const [, sql] of samples) {
    await new Promise((resolve, reject) => {
      db.run(sql, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  console.log('示例数据已写入 SQLite');
  db.close();
}

seed().catch((err) => {
  console.error('seed 失败:', err);
  process.exit(1);
});
