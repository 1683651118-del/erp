const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:23tQtQBHFk30y5Pr@db.zoufotycpfmchavqprt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- 1. 客户表
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    remark TEXT
);

-- 2. 产品表
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    spec TEXT,
    customer_code TEXT REFERENCES customers(code),
    stock INTEGER DEFAULT 0,
    status TEXT DEFAULT '在库',
    remark TEXT
);

-- 3. 订单表
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    customer_code TEXT REFERENCES customers(code),
    product_code TEXT REFERENCES products(code),
    product_name TEXT,
    qty INTEGER DEFAULT 0,
    order_date DATE,
    delivery_date DATE,
    remark TEXT,
    status TEXT DEFAULT '待生产'
);

-- 4. 生产/库存相关表
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    product_code TEXT REFERENCES products(code),
    qty INTEGER DEFAULT 0,
    type TEXT,
    op_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入一些初始测试数据
INSERT INTO customers (code, name, phone, remark) 
SELECT 'C001', '演示客户', '13800000000', '初始化数据'
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE code = 'C001');

INSERT INTO products (code, name, spec, customer_code, stock)
SELECT 'P001', '示例产品', '规格A', 'C001', 0
WHERE NOT EXISTS (SELECT 1 FROM products WHERE code = 'P001');
`;

async function init() {
  try {
    console.log('正在使用用户原始连接串连接 Supabase...');
    await pool.query(sql);
    console.log('✅ 数据库表结构初始化成功！');
  } catch (err) {
    console.error('❌ 初始化失败:', err);
  } finally {
    await pool.end();
  }
}

init();
