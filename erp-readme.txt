erp/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js          # 核心：数据层、路由、全局函数
│   ├── utils.js        # 工具函数
│   ├── dashboard.js    # 汇总预览
│   ├── orders.js       # 订单管理
│   ├── production.js   # 生产管理
│   ├── outsource.js    # 外发管理
│   ├── shipment.js     # 出货管理
│   ├── quality.js      # 质检管理
│   ├── customers.js    # 客户管理
│   ├── products.js     # 产品管理
│   └── reconciliation.js # 对账管理
└── pages/
    ├── dashboard.html
    ├── orders.html
    ├── production.html
    ├── outsource.html
    ├── shipment.html
    ├── quality.html
    ├── customers.html
    ├── products.html
    ├── purchase.html    # ← 采购管理（逻辑在HTML内部）
    ├── reconciliation.html
    ├── settings.html
    └── help.html