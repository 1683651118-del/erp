const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, getSql } = require('./db');

// 引入所有路由
const apiIndexRoutes = require('./routes/index');
const productsRoutes = require('./routes/products');
const customersRoutes = require('./routes/customers');
const ordersRoutes = require('./routes/orders');
const inventoryRoutes = require('./routes/inventory');
const purchasesRoutes = require('./routes/purchases');
const productionsRoutes = require('./routes/productions');
const outsourceRoutes = require('./routes/outsource');

const app = express();
const rootDir = path.join(__dirname, '..');

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// 简单的登录检查中间件
const checkAuth = (req, res, next) => {
  // 排除登录接口和健康检查
  if (req.path === '/api/login' || req.path === '/api/health' || req.path === '/login.html') {
    return next();
  }
  
  // 检查请求头或查询参数中是否有 token (这里简化为检查 x-auth-token)
  // 在实际 ERP 中，前端登录后会把 token 存入 localStorage
  const token = req.headers['x-auth-token'] || req.query.token;
  
  if (!token && req.path.startsWith('/api/')) {
    return res.status(401).json({ message: '未登录' });
  }

  // 如果是访问页面且未登录，重定向到登录页
  if (!token && (req.path.startsWith('/pages/') || req.path === '/' || req.path === '/index.html')) {
    return res.redirect('/login.html');
  }

  next();
};

app.use(checkAuth);

// 登录接口
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await getSql('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    if (user) {
      // 登录成功，返回一个简单的 token (实际应使用 JWT)
      res.json({ success: true, token: 'erp-auth-token-2026', username: user.username });
    } else {
      res.status(401).json({ success: false, message: '账号或密码错误' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'erp-backend',
    message: 'ERP 后端服务运行正常（Supabase）',
  });
});

// 挂载 API 路由
app.use('/api', apiIndexRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/productions', productionsRoutes);
app.use('/api/outsource', outsourceRoutes);

// 静态文件（Vercel 中通常由前端托管，但保留兼容）
app.use(express.static(rootDir));

// 页面路由
app.get('/pages/:page', (req, res) => {
  const page = req.params.page;
  const pagePath = path.join(rootDir, 'pages', `${page}.html`);
  res.sendFile(pagePath, err => {
    if (err) {
      res.status(404).send('Page not found');
    }
  });
});

// 兜底：返回 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(rootDir, 'index.html'));
});

// API 404 处理
app.use((req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

// ★★★ Vercel 关键改动：导出 app，而不是启动监听 ★★★
// 同时保留本地开发时的启动逻辑
if (require.main === module) {
  // 本地开发模式：启动服务器
  const PORT = process.env.PORT || 3000;
  (async function startLocal() {
    try {
      await initDatabase();
      app.listen(PORT, () => {
        console.log(`🚀 ERP 后端已启动（本地），端口: ${PORT}`);
        console.log(`📍 健康检查: http://localhost:${PORT}/api/health`);
      });
    } catch (error) {
      console.error('启动服务失败:', error);
      process.exit(1);
    }
  })();
}

// ★★★ 导出 app 供 Vercel 使用 ★★★
module.exports = app;