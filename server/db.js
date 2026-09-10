const { Pool } = require('pg');

// 从环境变量读取数据库连接字符串
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Supabase 需要 SSL
  }
});

// 工具函数：自动将 SQL 中的 ? 转换为 $1, $2 ... (适配 PostgreSQL)
function formatSql(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

// 工具函数：执行 SQL（INSERT/UPDATE/DELETE）
function runSql(sql, params = []) {
  return pool.query(formatSql(sql), params)
    .then(result => {
      return {
        id: result.rows?.[0]?.id || null,
        changes: result.rowCount || 0
      };
    })
    .catch(err => {
      console.error('runSql 错误:', err);
      throw err;
    });
}

// 工具函数：查询单行
function getSql(sql, params = []) {
  return pool.query(formatSql(sql), params)
    .then(result => result.rows?.[0] || null)
    .catch(err => {
      console.error('getSql 错误:', err);
      throw err;
    });
}

// 工具函数：查询多行
function allSql(sql, params = []) {
  return pool.query(formatSql(sql), params)
    .then(result => result.rows || [])
    .catch(err => {
      console.error('allSql 错误:', err);
      throw err;
    });
}

// 初始化数据库（在 Supabase 中，表结构需要提前创建）
// 这里保留一个空函数，避免 index.js 调用时报错
function initDatabase() {
  console.log('✅ Supabase 数据库已就绪（表结构需提前创建）');
  return Promise.resolve();
}

// 关闭连接池（Vercel 环境下不需要主动关闭）
function closePool() {
  return pool.end();
}

module.exports = {
  pool,
  initDatabase,
  runSql,
  getSql,
  allSql,
  closePool
};