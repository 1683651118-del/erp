const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.zoufotycpfmcahovqprt:23tQtQBHFk30y5Pr@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, password) 
SELECT 'admin', '123456'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');
`;

async function addAuthTable() {
  try {
    await pool.query(sql);
    console.log('✅ 用户表已创建，初始账号: admin / 密码: 123456');
  } catch (err) {
    console.error('❌ 创建失败:', err);
  } finally {
    await pool.end();
  }
}

addAuthTable();
