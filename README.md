# ERP 后端骨架

这是一个最小可运行的 Node + Express + SQLite ERP 后端骨架，适合接入现有前端项目。

## 运行方式

```bash
npm install
npm start
```

然后访问：

- 健康检查：http://localhost:3000/api/health
- 产品列表：http://localhost:3000/api/products
- 客户列表：http://localhost:3000/api/customers
- 订单列表：http://localhost:3000/api/orders
- 库存：http://localhost:3000/api/inventory
- 采购单：http://localhost:3000/api/purchases

## 说明

- 使用 SQLite 作为本地数据库，适合快速开发和演示
- 适合你当前这个前端 ERP 原型接入后端
- 业务结构已经按产品、客户、订单、库存、采购开好基础接口

## 后续建议

1. 把前端中 localStorage 的数据访问改为 fetch 调用后端接口
2. 补登录、权限、审批等功能
3. 按现有页面逐步迁移到 API 版本
