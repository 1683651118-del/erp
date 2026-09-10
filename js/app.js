// ===== 权限检查总电闸：必须放在最前面 =====
(function() {
    const isLoginPage = window.location.pathname.includes('login.html');
    const hasToken = localStorage.getItem('erp_token');
    
    if (!hasToken && !isLoginPage) {
        window.location.href = '/login.html';
        return;
    }
})();

// ===== 权限拦截器：给所有的 fetch 自动带上 Token =====
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
    const token = localStorage.getItem('erp_token');
    if (token) {
        options.headers = options.headers || {};
        options.headers['x-auth-token'] = token;
    }
    return originalFetch(url, options).then(response => {
        if (response.status === 401) {
            // 如果后端返回 401，说明 Token 失效，强制跳回登录
            localStorage.removeItem('erp_token');
            window.location.href = '/login.html';
        }
        return response;
    });
};

// 退出登录函数
function logout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('erp_token');
        localStorage.removeItem('erp_username');
        window.location.href = '/login.html';
    }
}

// ===== 全局数据 =====
let data = {};
let menuVisible = {};
let detailFieldsVisible = {};
let dashboardCardsVisible = {};
let customMenus = [];
let detailCustomFields = [];
let dashboardCustomCards = [];
let outColumnsVisible = {};
let orderColumnsVisible = {};
let prodColumnsVisible = {};
let shipColumnsVisible = {};
let currentPage = 'dashboard';
let menuManageMode = false;
let detailManageMode = false;
let dashboardManageMode = false;
let trendChartInstance = null;
let excelParsedData = null;

// ★★★ 分组折叠状态 ★★★
let groupCollapsed = {};

// ★★★ 侧边栏折叠状态 ★★★
let sidebarCollapsed = false;

// ★★★ 折叠状态下当前展开的大项 ★★★
let popupExpandedGroup = null;

// ===== 数据默认值 =====
const DEFAULT_DATA = {
    customers: [],
    products: [],
    orders: [],
    productions: [],
    qualities: [],
    shipments: [],
    reconciliations: [],
    outsourceOrders: [],
    customColumns: [],
    _nextId: { order: 1, production: 1, quality: 1, shipment: 1, customer: 1, product: 1, reconcile: 1, outsource: 1 }
};

// ★★★ 菜单分组定义 ★★★
const menuGroups = [
    {
        id: 'group_dashboard',
        label: '汇总预览',
        icon: 'bi-grid-1x2-fill',
        isSingle: true,
        shortLabel: '汇总',
        items: [
            { page: 'dashboard', icon: 'bi-grid-1x2-fill', label: '汇总预览', shortLabel: '汇总' }
        ]
    },
    {
        id: 'group_orders',
        label: '订单管理',
        icon: 'bi-clipboard2-check',
        isSingle: true,
        shortLabel: '订单',
        items: [
            { page: 'orders', icon: 'bi-clipboard2-check', label: '订单管理', shortLabel: '订单', badge: 'orderBadge' }
        ]
    },
    {
        id: 'group_production',
        label: '生产管理',
        icon: 'bi-gear-wide-connected',
        isSingle: true,
        shortLabel: '生产',
        items: [
            { page: 'production', icon: 'bi-gear-wide-connected', label: '生产管理', shortLabel: '生产', badge: 'productionBadge' }
        ]
    },
    {
        id: 'group_outsource',
        label: '外发管理',
        icon: 'bi-send',
        isSingle: true,
        shortLabel: '外发',
        items: [
            { page: 'outsource', icon: 'bi-send', label: '外发管理', shortLabel: '外发', badge: 'outsourceBadge' }
        ]
    },
    {
        id: 'group_shipment',
        label: '出货管理',
        icon: 'bi-truck',
        isSingle: true,
        shortLabel: '出货',
        items: [
            { page: 'shipment', icon: 'bi-truck', label: '出货管理', shortLabel: '出货', badge: 'shipmentBadge' }
        ]
    },
    {
        id: 'group_purchase',
        label: '采购管理',
        icon: 'bi-cart',
        isSingle: true,
        shortLabel: '采购',
        items: [
            { page: 'purchase', icon: 'bi-cart', label: '采购管理', shortLabel: '采购' }
        ]
    },
    {
        id: 'group_purchaseDetail',
        label: '采购详情',
        icon: 'bi-list-ul',
        isSingle: true,
        shortLabel: '采购详',
        items: [
            { page: 'purchaseDetail', icon: 'bi-list-ul', label: '采购详情', shortLabel: '采购详' }
        ]
    },
    {
        id: 'group_reconciliation',
        label: '对账管理',
        icon: 'bi-cash-stack',
        isSingle: true,
        shortLabel: '对账',
        items: [
            { page: 'reconciliation', icon: 'bi-cash-stack', label: '对账管理', shortLabel: '对账' }
        ]
    },
    {
        id: 'group_inventory',
        label: '库存管理',
        icon: 'bi-boxes',
        isSingle: true,
        shortLabel: '库存',
        items: [
            { page: 'inventory', icon: 'bi-boxes', label: '库存管理', shortLabel: '库存' }
        ]
    },
    {
        id: 'group_data',
        label: '基础数据',
        icon: 'bi-database',
        isSingle: false,
        items: [
            { page: 'products', icon: 'bi-box', label: '产品管理', shortLabel: '产品' },
            { page: 'customers', icon: 'bi-people', label: '客户管理', shortLabel: '客户' },
            { page: 'quality', icon: 'bi-check2-circle', label: '质检管理', shortLabel: '质检' },
        ]
    },
    {
        id: 'group_system',
        label: '系统',
        icon: 'bi-gear',
        isSingle: false,
        items: [
            { page: 'settings', icon: 'bi-gear', label: '系统设置', shortLabel: '设置' },
            { page: 'help', icon: 'bi-question-circle', label: '帮助中心', shortLabel: '帮助' },
        ]
    }
];

// ★★★ 内置菜单项列表 ★★★
const builtinMenuItems = [];
menuGroups.forEach(group => {
    group.items.forEach(item => {
        builtinMenuItems.push({
            page: item.page,
            icon: item.icon || 'bi-file-earmark-text',
            label: item.label,
            badge: item.badge || '',
            shortLabel: item.shortLabel || group.shortLabel || item.label.substring(0, 2),
            groupId: group.id
        });
    });
});

// ===== 列配置 =====
const baseColumns = [
    { key: 'status', label: '状态' },
    { key: 'customerCode', label: '客户号' },
    { key: 'orderNo', label: '订单号' },
    { key: 'productCode', label: '产品编号' },
    { key: 'productName', label: '产品名称' },
    { key: 'spec', label: '规格型号/颜色/压印数字' },
    { key: 'color', label: '颜色' },
    { key: 'stamp', label: '压唛' },
    { key: 'qty', label: '订单数量' },
    { key: 'materialBoard', label: '物料-板材' },
    { key: 'materialShell', label: '物料-机壳' },
    { key: 'orderDate', label: '下单日期' },
    { key: 'deliveryDate', label: '交货日期' },
    { key: 'boardCode', label: '板材编号' },
    { key: 'shellStock', label: '壳子库存' },
    { key: 'progress', label: '进度(%)' },
    { key: 'qualityStatus', label: '质检状态' },
    { key: 'shipmentSchedule', label: '送货安排' },
    { key: 'partyName', label: '客户名称' },
    { key: 'partyContact', label: '联系人' },
    { key: 'remark', label: '备注' },
    { key: 'actions', label: '操作' }
];

const shipmentColumns = [
    { key: 'status', label: '状态' },
    { key: 'customerCode', label: '客户号' },
    { key: 'deliveryNo', label: '送货编号' },
    { key: 'deliveryPrintDate', label: '送货日期' },
    { key: 'orderNo', label: '订单号' },
    { key: 'productCode', label: '产品编号' },
    { key: 'productName', label: '产品名称' },
    { key: 'spec', label: '规格型号/颜色/压印数字' },
    { key: 'color', label: '颜色' },
    { key: 'stamp', label: '压唛' },
    { key: 'qty', label: '订单数量' },
    { key: 'materialBoard', label: '物料-板材' },
    { key: 'materialShell', label: '物料-机壳' },
    { key: 'orderDate', label: '下单日期' },
    { key: 'deliveryDate', label: '交货日期' },
    { key: 'boardCode', label: '板材编号' },
    { key: 'shellStock', label: '壳子库存' },
    { key: 'progress', label: '进度(%)' },
    { key: 'qualityStatus', label: '质检状态' },
    { key: 'shipmentSchedule', label: '送货安排' },
    { key: 'partyName', label: '客户名称' },
    { key: 'partyContact', label: '联系人' },
    { key: 'remark', label: '备注' },
    { key: 'shipmentStatus', label: '出货状态' },
    { key: 'source', label: '来源' },
    { key: 'actions', label: '操作' }
];

const outColumns = [
    { key: 'outsourceStatus', label: '外发详情' },
    { key: 'customerCode', label: '客户号' },
    { key: 'orderNo', label: '订单号' },
    { key: 'productCode', label: '产品编号' },
    { key: 'productName', label: '产品名称' },
    { key: 'spec', label: '规格型号' },
    { key: 'color', label: '颜色' },
    { key: 'stamp', label: '压唛' },
    { key: 'qty', label: '订单数量' },
    { key: 'remark', label: '备注' },
    { key: 'actions', label: '操作' }
];

const detailFieldDefs = [
    { key: 'customerCode', label: '客户号', type: 'text' },
    { key: 'orderNo', label: '订单号', type: 'text' },
    { key: 'productCode', label: '产品编号', type: 'text' },
    { key: 'productName', label: '产品名称', type: 'textarea' },
    { key: 'spec', label: '规格型号/颜色/压印数字', type: 'textarea' },
    { key: 'color', label: '颜色', type: 'text' },
    { key: 'stamp', label: '压唛', type: 'text' },
    { key: 'qty', label: '订单数量', type: 'number' },
    { key: 'materialBoard', label: '物料-板材', type: 'text' },
    { key: 'materialShell', label: '物料-机壳', type: 'text' },
    { key: 'orderDate', label: '下单日期', type: 'date' },
    { key: 'deliveryDate', label: '交货日期', type: 'date' },
    { key: 'boardCode', label: '板材编号', type: 'text' },
    { key: 'shellStock', label: '壳子库存', type: 'text' },
    { key: 'remark', label: '备注', type: 'text' },
    { key: 'status', label: '订单状态', type: 'select' },
    { key: 'progress', label: '生产进度(%)', type: 'number' },
    { key: 'shipmentSchedule', label: '送货安排', type: 'date' },
    { key: 'partyName', label: '客户名称', type: 'text' },
    { key: 'partyAddress', label: '客户地址', type: 'text' },
    { key: 'partyContact', label: '联系人', type: 'text' },
    { key: 'partyFormNo', label: '表单编号', type: 'text' },
    { key: 'shipmentStatus', label: '订单状态', type: 'select' }
];

const dashboardCardDefs = [
    { id: 'stat_total', label: '总订单', type: 'stat', field: 'total', icon: 'bi-file-earmark-text', color: 'blue', page: 'orders' },
    { id: 'stat_production', label: '生产中', type: 'stat', field: 'production', icon: 'bi-gear', color: 'gold', page: 'production' },
    { id: 'stat_shipment', label: '待出货', type: 'stat', field: 'shipment', icon: 'bi-box-seam', color: 'green', page: 'shipment' },
    { id: 'stat_reconcile', label: '待对账', type: 'stat', field: 'reconcile', icon: 'bi-cash', color: 'purple', page: 'reconciliation' },
    { id: 'stat_unpaid', label: '未交订单', type: 'stat', field: 'unpaidTotal', icon: 'bi-clock-history', color: 'gold', page: 'orders' },
    { id: 'stat_paid', label: '已交订单', type: 'stat', field: 'paidTotal', icon: 'bi-check2-circle', color: 'green', page: 'orders' }
];

const defaultActionCards = [
    { id: 'action_quick_order', label: '快速下单', type: 'action', icon: 'bi-plus-circle', action: "openModal('orderModal')", color: 'primary' },
    { id: 'action_start_prod', label: '开始生产', type: 'action', icon: 'bi-play-circle', action: "openModal('productionModal')", color: 'primary' },
    { id: 'action_create_ship', label: '创建出货单', type: 'action', icon: 'bi-truck', action: "openModal('shipmentModal')", color: 'primary' },
    { id: 'action_reconcile', label: '生成对账单', type: 'action', icon: 'bi-file-spreadsheet', action: "alert('跳转至对账页面')", color: 'primary' }
];

// ============================================================
//  ★★★ 解析函数 ★★★
// ============================================================

// 解析订单 extra 字段
function parseExtraFields(order) {
    if (!order) return order;
    let extra = {};
    if (order.extra) {
        try {
            extra = typeof order.extra === 'string' ? JSON.parse(order.extra) : order.extra;
        } catch (e) {
            console.warn('解析 extra 失败:', e);
            extra = {};
        }
    }
    delete order.extra;
    return {
        ...order,
        ...extra,
        spec: extra.spec || '',
        color: extra.color || '',
        stamp: extra.stamp || '',
        materialBoard: extra.materialBoard || '',
        materialShell: extra.materialShell || '',
        boardCode: extra.boardCode || '',
        shellStock: extra.shellStock || '',
        partyName: extra.partyName || '',
        partyAddress: extra.partyAddress || '',
        partyContact: extra.partyContact || '',
        partyFormNo: extra.partyFormNo || '',
        syncToPurchase: extra.syncToPurchase !== false,
        progress: extra.progress || 0,
        qualityStatus: extra.qualityStatus || '未质检',
        shipmentStatus: extra.shipmentStatus || '待出货',
        source: extra.source || 'production',
        outsourceStatus: extra.outsourceStatus || '',
        outsourceLocation: extra.outsourceLocation || '',
        customFields: extra.customFields || {},
        deliveryHistory: extra.deliveryHistory || [],
        deliveredQty: extra.deliveredQty || 0,
        remainingQty: extra.remainingQty || order.qty || 0,
        shipmentSchedule: extra.shipmentSchedule || '',
        purchase: extra.purchase || { orders: [], remark: '' }
    };
}

// 解析产品 extra 字段
function parseProductExtraFields(product) {
    if (!product) return product;
    let extra = {};
    if (product.extra) {
        try {
            extra = typeof product.extra === 'string' ? JSON.parse(product.extra) : product.extra;
        } catch (e) {
            console.warn('解析产品 extra 失败:', e);
            extra = {};
        }
    }
    delete product.extra;
    return {
        ...product,
        ...extra,
        // 基础字段（数据库字段优先）
        code: product.code || '',
        name: product.name || '',
        customerCode: product.customer_code || extra.customerCode || '',
        spec: product.spec || extra.spec || '',
        stock: product.stock || 0,
        status: product.status || '在库',
        remark: product.remark || extra.remark || '',
        // 扩展字段（从 extra 读取）
        magnetDetail: extra.magnetDetail || '[]',
        materialDetail: extra.materialDetail || [],
        images: extra.images || [],
        files: extra.files || [],
        desc: extra.desc || '',
        unit: extra.unit || '个',
        price: extra.price || 0,
        minStock: extra.minStock || 0,
        shellStock: extra.shellStock || 0,
        boardStock: extra.boardStock || 0,
        shellLocation: extra.shellLocation || '',
        boardLocation: extra.boardLocation || ''
    };
}

// ============================================================
//  ★★★ 从服务器加载数据 ★★★
// ============================================================

async function loadDataFromServer() {
    try {
        console.log('🔄 正在从服务器加载数据...');
        
        const [ordersRes, productsRes, customersRes] = await Promise.all([
            fetch('/api/orders').catch(() => ({ ok: false })),
            fetch('/api/products').catch(() => ({ ok: false })),
            fetch('/api/customers').catch(() => ({ ok: false }))
        ]);

        let orders = [];
        let products = [];
        let customers = [];

        if (ordersRes.ok) {
            orders = await ordersRes.json();
            console.log(`✅ 从服务器加载了 ${orders.length} 条订单`);
        } else {
            console.warn('⚠️ 订单API不可用，使用本地数据');
        }

        if (productsRes.ok) {
            products = await productsRes.json();
            console.log(`✅ 从服务器加载了 ${products.length} 个产品`);
        } else {
            console.warn('⚠️ 产品API不可用，使用本地数据');
        }

        if (customersRes.ok) {
            customers = await customersRes.json();
            console.log(`✅ 从服务器加载了 ${customers.length} 个客户`);
        } else {
            console.warn('⚠️ 客户API不可用，使用本地数据');
        }

        // ★★★ 解析订单和产品的 extra 字段 ★★★
        data.orders = (orders || []).map(o => parseExtraFields(o));
        data.products = (products || []).map(p => parseProductExtraFields(p));
        data.customers = customers || [];

        // 初始化其他数据（这些模块暂未接入后端，保留 localStorage 备份）
        loadLocalDataForOtherModules();

        // 计算 nextId
        data._nextId = {
            order: Math.max(0, ...data.orders.map(o => o.id || 0)) + 1,
            product: Math.max(0, ...data.products.map(p => p.id || 0)) + 1,
            customer: Math.max(0, ...data.customers.map(c => c.id || 0)) + 1,
            production: 1,
            quality: 1,
            shipment: 1,
            reconcile: 1,
            outsource: 1
        };

        // 补充订单默认字段
        data.orders.forEach(o => {
            if (!o.customFields) o.customFields = {};
            if (o.progress === undefined) o.progress = 0;
            if (!o.qualityStatus) o.qualityStatus = '未质检';
            if (!o.shipmentSchedule) o.shipmentSchedule = '';
            if (!o.partyName) o.partyName = '';
            if (!o.partyAddress) o.partyAddress = '';
            if (!o.partyContact) o.partyContact = '';
            if (!o.partyFormNo) o.partyFormNo = '';
            if (!o.outsourceStatus) o.outsourceStatus = '';
            if (!o.outsourceLocation) o.outsourceLocation = '';
            if (!o.source) o.source = 'production';
            if (!o.shipmentStatus) o.shipmentStatus = '待出货';
            if (!o.deliveryHistory) o.deliveryHistory = [];
            if (o.deliveredQty === undefined) o.deliveredQty = 0;
            if (o.remainingQty === undefined || o.remainingQty === 0) {
                o.remainingQty = o.qty || 0;
            }
            if (o.syncToPurchase === undefined) o.syncToPurchase = true;
        });

        // 备份到 localStorage（降级用）
        backupDataToLocal();

        console.log('✅ 数据加载完成，共 ' + data.orders.length + ' 条订单，' + data.products.length + ' 个产品');
        return true;
    } catch (error) {
        console.error('❌ 从服务器加载数据失败:', error);
        // 降级到 localStorage
        console.log('🔄 降级到 localStorage...');
        loadDataFromServer();
        return false;
    }
}

// 从 localStorage 加载其他模块的数据（生产、外发、出货等）
function loadLocalDataForOtherModules() {
    const stored = localStorage.getItem('erp_production_data');
    if (stored) {
        try {
            const localData = JSON.parse(stored);
            data.productions = localData.productions || [];
            data.qualities = localData.qualities || [];
            data.shipments = localData.shipments || [];
            data.reconciliations = localData.reconciliations || [];
            data.outsourceOrders = localData.outsourceOrders || [];
            data.customColumns = localData.customColumns || [];
            data.inventoryLogs = localData.inventoryLogs || [];
            
            // 补充外发订单默认字段
            data.outsourceOrders.forEach(os => {
                if (!os.status) os.status = '待外发';
                if (!os.location) os.location = '5楼';
                if (!os.outsourceDate) os.outsourceDate = new Date().toISOString().slice(0,10);
                if (!os.remark) os.remark = '';
                if (!os.supplier) os.supplier = '';
                if (!os.returnDate) os.returnDate = '';
            });
            
            // 补充生产单默认字段
            data.productions.forEach(p => {
                if (!p.stage) p.stage = '开料';
                if (!p.remark) p.remark = '';
            });
            
            console.log('📦 从 localStorage 加载了其他模块数据');
        } catch (e) {
            console.warn('加载 localStorage 数据失败:', e);
            initDefaultLocalData();
        }
    } else {
        initDefaultLocalData();
    }
}

function initDefaultLocalData() {
    data.productions = [];
    data.qualities = [];
    data.shipments = [];
    data.reconciliations = [];
    data.outsourceOrders = [];
    data.customColumns = [];
    data.inventoryLogs = [];
}

// 备份数据到 localStorage（降级方案）
function backupDataToLocal() {
    try {
        const backup = {
            orders: data.orders,
            products: data.products,
            customers: data.customers,
            productions: data.productions,
            qualities: data.qualities,
            shipments: data.shipments,
            reconciliations: data.reconciliations,
            outsourceOrders: data.outsourceOrders,
            customColumns: data.customColumns,
            inventoryLogs: data.inventoryLogs || [],
            _nextId: data._nextId
        };
        localStorage.setItem('erp_production_data_backup', JSON.stringify(backup));
    } catch (e) {
        // 忽略
    }
}

// ============================================================
//  ★★★ 兼容旧版：从 localStorage 加载（降级方案） ★★★
// ============================================================

function loadDataFromStorage() {
    const stored = localStorage.getItem('erp_production_data');
    if (stored) {
        try {
            data = JSON.parse(stored);
            ['customers', 'products', 'orders', 'productions', 'qualities', 'shipments', 'reconciliations', 'outsourceOrders'].forEach(key => {
                if (!data[key]) data[key] = [];
            });
            if (!data._nextId) data._nextId = { order: 1, production: 1, quality: 1, shipment: 1, customer: 1, product: 1, reconcile: 1, outsource: 1 };
            if (!data.customColumns) data.customColumns = [];
            if (!data.inventoryLogs) data.inventoryLogs = [];
            
            data.orders.forEach(o => {
                if (!o.customFields) o.customFields = {};
                if (o.progress === undefined) o.progress = 0;
                if (!o.qualityStatus) o.qualityStatus = '未质检';
                if (!o.shipmentSchedule) o.shipmentSchedule = '';
                if (!o.partyName) o.partyName = '';
                if (!o.partyAddress) o.partyAddress = '';
                if (!o.partyContact) o.partyContact = '';
                if (!o.partyFormNo) o.partyFormNo = '';
                if (!o.outsourceStatus) o.outsourceStatus = '';
                if (!o.outsourceLocation) o.outsourceLocation = '';
                if (!o.source) o.source = 'production';
                if (!o.shipmentStatus) o.shipmentStatus = '待出货';
                if (!o.deliveryHistory) o.deliveryHistory = [];
                if (o.deliveredQty === undefined) o.deliveredQty = 0;
                if (o.remainingQty === undefined || o.remainingQty === 0) {
                    o.remainingQty = o.qty || 0;
                }
                if (o.syncToPurchase === undefined) o.syncToPurchase = true;
            });
            data.productions.forEach(p => {
                if (!p.stage) p.stage = '开料';
                if (!p.remark) p.remark = '';
            });
            data.outsourceOrders.forEach(os => {
                if (!os.status) os.status = '待外发';
                if (!os.location) os.location = '5楼';
                if (!os.outsourceDate) os.outsourceDate = new Date().toISOString().slice(0,10);
                if (!os.remark) os.remark = '';
                if (!os.supplier) os.supplier = '';
                if (!os.returnDate) os.returnDate = '';
            });
        } catch(e) {
            console.warn('数据解析失败', e);
            resetToDefault();
        }
    } else {
        resetToDefault();
    }

    // 加载采购关联数据
    data.purchaseOrders = JSON.parse(localStorage.getItem('erp_purchase_orders') || '[]');

    // 加载菜单可见性
    const menuStored = localStorage.getItem('erp_menu_visible');
    if (menuStored) {
        try { menuVisible = JSON.parse(menuStored); } catch(e) { menuVisible = {}; }
    } else {
        builtinMenuItems.forEach(item => menuVisible[item.page] = true);
    }

    // 加载分组折叠状态
    const groupStored = localStorage.getItem('erp_group_collapsed');
    if (groupStored) {
        try { groupCollapsed = JSON.parse(groupStored); } catch(e) { groupCollapsed = {}; }
    } else {
        groupCollapsed = {};
    }

    const coreGroupIds = ['group_data', 'group_finance', 'group_system'];
    coreGroupIds.forEach(id => {
        groupCollapsed[id] = false;
    });
    menuGroups.forEach(g => {
        if (!coreGroupIds.includes(g.id) && groupCollapsed[g.id] === undefined) {
            groupCollapsed[g.id] = true;
        }
    });
    localStorage.setItem('erp_group_collapsed', JSON.stringify(groupCollapsed));

    // 详情字段可见性
    const detailStored = localStorage.getItem('erp_detail_fields_visible');
    if (detailStored) {
        try { detailFieldsVisible = JSON.parse(detailStored); } catch(e) { detailFieldsVisible = {}; }
    } else {
        detailFieldDefs.forEach(f => detailFieldsVisible[f.key] = true);
        detailFieldsVisible['status'] = false;
        detailFieldsVisible['shipmentSchedule'] = false;
        detailFieldsVisible['qualityStatus'] = false;
    }

    const customDetailStored = localStorage.getItem('erp_detail_custom_fields');
    if (customDetailStored) {
        try { detailCustomFields = JSON.parse(customDetailStored); } catch(e) { detailCustomFields = []; }
    } else { detailCustomFields = []; }

    const cardStored = localStorage.getItem('erp_dashboard_cards_visible');
    if (cardStored) {
        try { dashboardCardsVisible = JSON.parse(cardStored); } catch(e) { dashboardCardsVisible = {}; }
    } else {
        dashboardCardDefs.forEach(c => dashboardCardsVisible[c.id] = true);
        defaultActionCards.forEach(c => dashboardCardsVisible[c.id] = true);
    }
    const customCardStored = localStorage.getItem('erp_dashboard_custom_cards');
    if (customCardStored) {
        try { dashboardCustomCards = JSON.parse(customCardStored); } catch(e) { dashboardCustomCards = []; }
    } else { dashboardCustomCards = []; }

    const customMenuStored = localStorage.getItem('erp_custom_menus');
    if (customMenuStored) {
        try { customMenus = JSON.parse(customMenuStored); } catch(e) { customMenus = []; }
    } else { customMenus = []; }

    const orderColStored = localStorage.getItem('erp_order_columns_visible');
    if (orderColStored) {
        try { orderColumnsVisible = JSON.parse(orderColStored); } catch(e) { orderColumnsVisible = {}; }
    } else { baseColumns.forEach(c => orderColumnsVisible[c.key] = true); }
    const prodColStored = localStorage.getItem('erp_prod_columns_visible');
    if (prodColStored) {
        try { prodColumnsVisible = JSON.parse(prodColStored); } catch(e) { prodColumnsVisible = {}; }
    } else { baseColumns.forEach(c => prodColumnsVisible[c.key] = true); }
    const shipColStored = localStorage.getItem('erp_ship_columns_visible');
    if (shipColStored) {
        try { shipColumnsVisible = JSON.parse(shipColStored); } catch(e) { shipColumnsVisible = {}; }
    } else { shipmentColumns.forEach(c => shipColumnsVisible[c.key] = true); }
    const outColStored = localStorage.getItem('erp_out_columns_visible');
    if (outColStored) {
        try { outColumnsVisible = JSON.parse(outColStored); } catch(e) { outColumnsVisible = {}; }
    } else { outColumns.forEach(c => outColumnsVisible[c.key] = true); }

    saveDataToStorage();
}

function resetToDefault() {
    data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    if (data.outsourceOrders.length === 0) {
        data.outsourceOrders.push({
            id: 1,
            orderId: 1,
            outsourceNo: 'WF20260822001',
            status: '待外发',
            location: '5楼',
            outsourceDate: '2026-08-22',
            supplier: '宏远外发加工厂',
            returnDate: '2026-08-30',
            remark: '欠200'
        });
    }
    if (data.orders.length > 0 && data.orders[0].outsourceStatus === '') {
        data.orders[0].outsourceStatus = '待外发';
        data.orders[0].outsourceLocation = '5楼';
    }
    if (data.orders.length > 0) {
        data.orders[0].source = 'production';
        data.orders[0].shipmentStatus = '待出货';
        if (!data.orders[0].deliveryHistory) data.orders[0].deliveryHistory = [];
        if (data.orders[0].deliveredQty === undefined) data.orders[0].deliveredQty = 0;
        if (data.orders[0].remainingQty === undefined || data.orders[0].remainingQty === 0) {
            data.orders[0].remainingQty = data.orders[0].qty || 0;
        }
        if (data.orders[0].syncToPurchase === undefined) data.orders[0].syncToPurchase = true;
    }
}

// ============================================================
//  数据持久化（兼容旧版，同时作为备份）
// ============================================================

function saveDataToStorage() {
    // 保存到 localStorage 作为备份
    try {
        const toStore = {
            customers: data.customers,
            products: data.products,
            orders: data.orders,
            productions: data.productions,
            qualities: data.qualities,
            shipments: data.shipments,
            reconciliations: data.reconciliations,
            outsourceOrders: data.outsourceOrders,
            customColumns: data.customColumns,
            inventoryLogs: data.inventoryLogs || [],
            _nextId: data._nextId
        };
        localStorage.setItem('erp_production_data', JSON.stringify(toStore));
        localStorage.setItem('erp_purchase_orders', JSON.stringify(data.purchaseOrders || []));
    } catch(e) {
        console.warn('保存到 localStorage 失败:', e);
    }

    // 更新角标
    updateBadges();

    // ★★★ 如果采购页面当前可见，自动刷新 ★★★
    var pageContainer = document.getElementById('pageContainer');
    if (pageContainer && pageContainer.querySelector('#page-purchase')) {
        if (typeof window.renderPurchaseOrders === 'function') {
            setTimeout(function() {
                window.renderPurchaseOrders();
            }, 100);
        }
    }
}

function updateBadges() {
    const orderBadge = document.getElementById('orderBadge');
    if (orderBadge) orderBadge.textContent = data.orders.length;

    const productionBadge = document.getElementById('productionBadge');
    if (productionBadge) {
        const activeProductionCount = data.productions.filter(p => 
            p.stage !== '已完成' && p.stage !== '已完成-待送货'
        ).length;
        productionBadge.textContent = activeProductionCount;
    }

    const outsourceBadge = document.getElementById('outsourceBadge');
    if (outsourceBadge) {
        const activeOutsourceCount = data.outsourceOrders.filter(os => os.status !== '已完成-待出货').length;
        outsourceBadge.textContent = activeOutsourceCount;
    }

    const shipmentBadge = document.getElementById('shipmentBadge');
    if (shipmentBadge) {
        const shipmentCount = data.orders.filter(o => o.status === '待出货' || o.status === '已完成-待送货').length;
        shipmentBadge.textContent = shipmentCount;
    }

    const qualityBadge = document.getElementById('qualityBadge');
    if (qualityBadge) {
        const qualityCount = data.orders.filter(o => o.qualityStatus === '未质检' || o.qualityStatus === '质检中').length;
        qualityBadge.textContent = qualityCount;
    }

    localStorage.setItem('erp_menu_visible', JSON.stringify(menuVisible));
    localStorage.setItem('erp_group_collapsed', JSON.stringify(groupCollapsed));
    localStorage.setItem('erp_detail_fields_visible', JSON.stringify(detailFieldsVisible));
    localStorage.setItem('erp_detail_custom_fields', JSON.stringify(detailCustomFields));
    localStorage.setItem('erp_dashboard_cards_visible', JSON.stringify(dashboardCardsVisible));
    localStorage.setItem('erp_dashboard_custom_cards', JSON.stringify(dashboardCustomCards));
    localStorage.setItem('erp_custom_menus', JSON.stringify(customMenus));
    localStorage.setItem('erp_order_columns_visible', JSON.stringify(orderColumnsVisible));
    localStorage.setItem('erp_prod_columns_visible', JSON.stringify(prodColumnsVisible));
    localStorage.setItem('erp_ship_columns_visible', JSON.stringify(shipColumnsVisible));
    localStorage.setItem('erp_out_columns_visible', JSON.stringify(outColumnsVisible));
}

// ============================================================
//  导出/导入数据（备份/恢复）
// ============================================================

function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ERP_备份_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported.orders) { alert('无效备份文件'); return; }
            if (!confirm('恢复将覆盖当前数据，确定？')) return;
            data = imported;
            if (!data.customColumns) data.customColumns = [];
            if (!data.outsourceOrders) data.outsourceOrders = [];
            data.orders.forEach(o => {
                if (!o.customFields) o.customFields = {};
                if (o.progress === undefined) o.progress = 0;
                if (!o.qualityStatus) o.qualityStatus = '未质检';
                if (!o.shipmentSchedule) o.shipmentSchedule = '';
                if (!o.partyName) o.partyName = '';
                if (!o.partyAddress) o.partyAddress = '';
                if (!o.partyContact) o.partyContact = '';
                if (!o.partyFormNo) o.partyFormNo = '';
                if (!o.outsourceStatus) o.outsourceStatus = '';
                if (!o.outsourceLocation) o.outsourceLocation = '';
                if (!o.source) o.source = 'production';
                if (!o.shipmentStatus) o.shipmentStatus = '待出货';
                if (!o.deliveryHistory) o.deliveryHistory = [];
                if (o.deliveredQty === undefined) o.deliveredQty = 0;
                if (o.remainingQty === undefined || o.remainingQty === 0) {
                    o.remainingQty = o.qty || 0;
                }
                if (o.syncToPurchase === undefined) o.syncToPurchase = true;
            });
            data.productions.forEach(p => { if (!p.stage) p.stage = '开料'; if (!p.remark) p.remark = ''; });
            data.outsourceOrders.forEach(os => {
                if (!os.status) os.status = '待外发';
                if (!os.location) os.location = '5楼';
                if (!os.outsourceDate) os.outsourceDate = new Date().toISOString().slice(0,10);
                if (!os.remark) os.remark = '';
                if (!os.supplier) os.supplier = '';
                if (!os.returnDate) os.returnDate = '';
            });
            saveDataToStorage();
            renderAll();
            alert('✅ 数据恢复成功！');
        } catch(err) {
            alert('文件解析失败：' + err.message);
        }
    };
    reader.readAsText(file);
    document.getElementById('importFileInput').value = '';
}

// ============================================================
//  页面路由
// ============================================================

const pageRegistry = {};

async function switchPage(page) {
    currentPage = page;
    const container = document.getElementById('pageContainer');
    const custom = document.getElementById('customPageContainer');
    if (custom) custom.style.display = 'none';

    if (sidebarCollapsed) {
        popupExpandedGroup = null;
        renderMenu();
    }

    // 增加：淡出效果，防止生硬跳动
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.2s ease-in-out';

    const showPage = (html, onShow) => {
        container.innerHTML = html;
        if (onShow) onShow();
        updateActiveNav(page);
        // 增加：延迟淡入并重置滚动条
        setTimeout(() => {
            container.style.opacity = '1';
            window.scrollTo(0, 0);
        }, 50);
    };

    if (pageRegistry[page] && pageRegistry[page].loaded) {
        showPage(pageRegistry[page].html, pageRegistry[page].onShow);
        return;
    }

    try {
        const response = await fetch(`/pages/${page}.html`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        pageRegistry[page] = {
            loaded: true,
            html: html,
            onShow: window[`init${capitalize(page)}`] || null
        };
        showPage(html, pageRegistry[page].onShow);
    } catch(err) {
        container.innerHTML = `<div class="alert alert-danger">加载页面失败: ${err.message}</div>`;
        container.style.opacity = '1';
    }
}

function updateActiveNav(page) {
    document.querySelectorAll('.sidebar .nav-link').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    document.querySelectorAll('.sidebar .sub-nav-link').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    const titles = {
        dashboard: '汇总预览 <small>生产概览</small>',
        orders: '订单管理 <small>全部生产订单</small>',
        production: '生产管理 <small>进度跟踪</small>',
        outsource: '外发管理 <small>外发订单跟踪</small>',
        shipment: '出货管理 <small>发货记录</small>',
        quality: '质检管理 <small>质量记录</small>',
        customers: '客户管理 <small>客户列表</small>',
        products: '产品管理 <small>产品库</small>',
        purchase: '采购管理 <small>采购订单</small>',
        purchaseDetail: '采购详情 <small>所有采购记录</small>',
        reconciliation: '对账管理 <small>财务对账</small>',
        inventory: '库存管理',
        settings: '系统设置',
        help: '帮助中心'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.innerHTML = titles[page] || page;
    document.getElementById('sidebar').classList.remove('open');
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getMenuItems() {
    const allItems = [];
    menuGroups.forEach(group => {
        group.items.forEach(item => {
            allItems.push({ ...item, groupId: group.id });
        });
    });
    customMenus.forEach(item => {
        allItems.push({ ...item, groupId: 'group_custom' });
    });
    return allItems;
}

// ============================================================
//  ★★★ 菜单渲染 ★★★
// ============================================================

function renderMenu() {
    const nav = document.getElementById('menuNav');
    let html = '';

    const singleGroups = menuGroups.filter(g => g.isSingle);
    const normalGroups = menuGroups.filter(g => !g.isSingle);

    singleGroups.forEach(group => {
        const item = group.items[0];
        if (!item) return;
        if (menuVisible[item.page] === false) return;

        const active = item.page === currentPage ? 'active' : '';
        const badgeHtml = item.badge ? `<span class="badge" id="${item.badge}">0</span>` : '';
        const deleteBtn = `<span class="menu-delete-btn" onclick="event.stopPropagation(); deleteMenuItem('${item.page}')"><i class="bi bi-x-circle"></i></span>`;
        const shortLabel = item.shortLabel || group.shortLabel || item.label.substring(0, 2);
        
        html += `<a class="nav-link menu-item-single ${active}" 
                     data-page="${item.page}" 
                     onclick="switchPage('${item.page}')"
                     title="${item.label}">
            <i class="bi ${item.icon}"></i>
            <span class="nav-label">${item.label}</span>
            <span class="nav-short">${shortLabel}</span>
            ${badgeHtml}
            ${deleteBtn}
        </a>`;
    });

    if (singleGroups.length > 0 && normalGroups.length > 0) {
        html += `<div class="menu-divider"></div>`;
    }

    const coreGroupIds = ['group_orders', 'group_production', 'group_outsource', 'group_shipment'];
    
    normalGroups.forEach(group => {
        const visibleItems = group.items.filter(item => menuVisible[item.page] !== false);
        if (visibleItems.length === 0) return;

        let isCollapsed = true;
        if (coreGroupIds.includes(group.id)) {
            if (sidebarCollapsed) {
                isCollapsed = popupExpandedGroup !== group.id;
            } else {
                isCollapsed = groupCollapsed[group.id] !== false;
            }
        } else {
            isCollapsed = groupCollapsed[group.id] !== false;
        }
        
        const arrowIcon = isCollapsed ? 'bi-chevron-right' : 'bi-chevron-down';
        const collapseClass = isCollapsed ? 'collapsed' : '';
        const isCore = coreGroupIds.includes(group.id);

        html += `<div class="menu-group ${isCore ? 'menu-group-core' : ''}" data-group="${group.id}">
            <div class="menu-group-header" onclick="onGroupHeaderClick('${group.id}')" title="${group.label}">
                <i class="bi ${group.icon} group-icon"></i>
                <span class="group-label">${group.label}</span>
                <span class="group-short">${group.shortLabel || group.label.substring(0, 2)}</span>
                <i class="bi ${arrowIcon} group-arrow"></i>
            </div>
            <div class="menu-group-body ${collapseClass}">`;

        visibleItems.forEach(item => {
            const active = item.page === currentPage ? 'active' : '';
            const badgeHtml = item.badge ? `<span class="badge" id="${item.badge}">0</span>` : '';
            const deleteBtn = `<span class="menu-delete-btn" onclick="event.stopPropagation(); deleteMenuItem('${item.page}')"><i class="bi bi-x-circle"></i></span>`;
            const shortLabel = item.shortLabel || item.label.substring(0, 2);
            
            const displayLabel = sidebarCollapsed ? shortLabel : item.label;
            
            html += `<a class="nav-link sub-nav-link ${active}" 
                         data-page="${item.page}" 
                         onclick="switchPage('${item.page}')"
                         title="${item.label}">
                <i class="bi ${item.icon}"></i>
                <span class="nav-label">${displayLabel}</span>
                <span class="nav-short">${shortLabel}</span>
                ${badgeHtml}
                ${deleteBtn}
            </a>`;
        });

        html += `</div></div>`;
    });

    const customVisible = customMenus.filter(item => menuVisible[item.page] !== false);
    if (customVisible.length > 0) {
        let isCollapsed = true;
        if (sidebarCollapsed) {
            isCollapsed = popupExpandedGroup !== 'group_custom';
        } else {
            isCollapsed = groupCollapsed['group_custom'] !== false;
        }
        const arrowIcon = isCollapsed ? 'bi-chevron-right' : 'bi-chevron-down';
        const collapseClass = isCollapsed ? 'collapsed' : '';

        html += `<div class="menu-group" data-group="group_custom">
            <div class="menu-group-header" onclick="onGroupHeaderClick('group_custom')" title="自定义菜单">
                <i class="bi bi-star group-icon"></i>
                <span class="group-label">自定义</span>
                <span class="group-short">自定义</span>
                <i class="bi ${arrowIcon} group-arrow"></i>
            </div>
            <div class="menu-group-body ${collapseClass}">`;

        customVisible.forEach(item => {
            const active = item.page === currentPage ? 'active' : '';
            const deleteBtn = `<span class="menu-delete-btn" onclick="event.stopPropagation(); deleteMenuItem('${item.page}')"><i class="bi bi-x-circle"></i></span>`;
            const shortLabel = item.shortLabel || item.label.substring(0, 2);
            const displayLabel = sidebarCollapsed ? shortLabel : item.label;
            
            const clickHandler = item.content ? `showCustomPage('${item.page}')` : `switchPage('${item.page}')`;
            html += `<a class="nav-link sub-nav-link ${active}" 
                         data-page="${item.page}" 
                         onclick="${clickHandler}"
                         title="${item.label}">
                <i class="bi ${item.icon || 'bi-file-earmark-text'}"></i>
                <span class="nav-label">${displayLabel}</span>
                <span class="nav-short">${shortLabel}</span>
                ${deleteBtn}
            </a>`;
        });

        html += `</div></div>`;
    }

    nav.innerHTML = html;
    saveDataToStorage();
    updateMenuDeleteButtons();
}

function onGroupHeaderClick(groupId) {
    const group = menuGroups.find(g => g.id === groupId);
    if (!group) return;

    const visibleItems = group.items.filter(item => menuVisible[item.page] !== false);
    if (visibleItems.length === 0) return;

    const coreGroupIds = ['group_orders', 'group_production', 'group_outsource', 'group_shipment'];
    const isCore = coreGroupIds.includes(groupId);
    const isCustom = groupId === 'group_custom';

    if (sidebarCollapsed) {
        if (isCore || isCustom) {
            if (popupExpandedGroup === groupId) {
                popupExpandedGroup = null;
            } else {
                popupExpandedGroup = groupId;
            }
            renderMenu();
        }

        if (visibleItems.length > 0) {
            setTimeout(() => {
                if (isCustom && customMenus.some(m => m.page === visibleItems[0].page && m.content)) {
                    showCustomPage(visibleItems[0].page);
                } else {
                    switchPage(visibleItems[0].page);
                }
            }, 50);
        }
        return;
    }

    let needsRerender = false;
    const isCurrentlyExpanded = groupCollapsed[groupId] === false;

    if (!isCurrentlyExpanded) {
        menuGroups.forEach(g => { groupCollapsed[g.id] = true; });
        groupCollapsed[groupId] = false;
        localStorage.setItem('erp_group_collapsed', JSON.stringify(groupCollapsed));
        needsRerender = true;
    } else {
        let otherExpanded = false;
        menuGroups.forEach(g => {
            if (g.id !== groupId && groupCollapsed[g.id] === false) {
                otherExpanded = true;
                groupCollapsed[g.id] = true;
            }
        });
        if (otherExpanded) {
            localStorage.setItem('erp_group_collapsed', JSON.stringify(groupCollapsed));
            needsRerender = true;
        }
    }

    if (needsRerender) {
        renderMenu();
    }

    if (visibleItems.length > 0) {
        if (currentPage !== visibleItems[0].page) {
            if (isCustom && customMenus.some(m => m.page === visibleItems[0].page && m.content)) {
                showCustomPage(visibleItems[0].page);
            } else {
                switchPage(visibleItems[0].page);
            }
        } else {
            renderAll();
        }
    }
}

function toggleGroup(groupId) {
    if (groupCollapsed[groupId] === undefined) {
        groupCollapsed[groupId] = false;
    }
    groupCollapsed[groupId] = !groupCollapsed[groupId];
    localStorage.setItem('erp_group_collapsed', JSON.stringify(groupCollapsed));
    renderMenu();
}

// ============================================================
//  自定义页面
// ============================================================

function showCustomPage(page) {
    const custom = customMenus.find(m => m.page === page);
    if (!custom) return;
    const container = document.getElementById('pageContainer');
    const old = document.getElementById('customPageContainer');
    if (old) old.remove();
    const div = document.createElement('div');
    div.id = 'customPageContainer';
    div.className = 'page-content';
    div.innerHTML = `<div class="table-wrap" style="padding:20px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h4>${custom.label}</h4><button class="btn btn-sm btn-outline-custom" onclick="document.getElementById('customPageContainer').remove(); switchPage('dashboard')">返回</button></div><div>${custom.content || '<p class="text-muted">暂无内容</p>'}</div></div>`;
    container.appendChild(div);
    document.querySelectorAll('.page-content').forEach(el => el.style.display = 'none');
    div.style.display = 'block';
    updateActiveNav(page);
}

// ============================================================
//  菜单管理
// ============================================================

function toggleMenuManage() { 
    menuManageMode = !menuManageMode; 
    updateMenuDeleteButtons(); 
}

function updateMenuDeleteButtons() { 
    document.querySelectorAll('.menu-delete-btn').forEach(btn => btn.classList.toggle('visible', menuManageMode)); 
}

function deleteMenuItem(page) {
    const allItems = getMenuItems();
    const item = allItems.find(m => m.page === page);
    if (!item) return;
    if (!confirm(`确定要删除菜单 "${item.label}" 吗？`)) return;
    menuVisible[page] = false;
    saveDataToStorage();
    renderMenu();
    if (currentPage === page) switchPage('dashboard');
}

function openMenuManager() {
    const container = document.getElementById('recoverMenuList');
    let html = '';
    const allPages = getMenuItems().map(m => m.page);
    let hasDeleted = false;
    allPages.forEach(p => {
        if (menuVisible[p] === false) {
            const label = getMenuItems().find(m => m.page === p)?.label || p;
            html += `<div class="recover-item"><input type="checkbox" class="form-check-input" id="recover_menu_${p}" value="${p}" /><label for="recover_menu_${p}">${label}</label></div>`;
            hasDeleted = true;
        }
    });
    if (!hasDeleted) html = '<p class="text-muted text-center">没有已删除的菜单</p>';
    container.innerHTML = html;
    document.getElementById('newMenuName').value = '';
    document.getElementById('newMenuIcon').value = 'bi-file-earmark-text';
    document.getElementById('newMenuPage').value = '';
    document.getElementById('newMenuContent').value = '';
    new bootstrap.Modal(document.getElementById('menuManagerModal')).show();
}

function recoverMenus() {
    const checks = document.querySelectorAll('#recoverMenuList input:checked');
    if (checks.length === 0) { alert('请选择要恢复的菜单'); return; }
    checks.forEach(cb => { menuVisible[cb.value] = true; });
    saveDataToStorage();
    closeModal('menuManagerModal');
    renderMenu();
    alert('✅ 已恢复选中菜单');
}

function addCustomMenu() {
    const label = document.getElementById('newMenuName').value.trim();
    const icon = document.getElementById('newMenuIcon').value.trim() || 'bi-file-earmark-text';
    const page = document.getElementById('newMenuPage').value.trim();
    const content = document.getElementById('newMenuContent').value.trim();
    if (!label || !page) { alert('请填写菜单名称和页面标识'); return; }
    if (getMenuItems().some(m => m.page === page)) { alert('页面标识已存在'); return; }
    customMenus.push({ label, icon, page, content });
    menuVisible[page] = true;
    saveDataToStorage();
    closeModal('menuManagerModal');
    renderMenu();
    alert(`✅ 已添加菜单 "${label}"`);
}

// ============================================================
//  全局模态框辅助
// ============================================================

function openModal(id) {
    if (id === 'orderModal') {
        document.getElementById('ordOrderNo').value = '';
        document.getElementById('ordProductName').value = '';
        document.getElementById('ordQty').value = 100;
        document.getElementById('ordOrderDate').value = new Date().toISOString().slice(0,10);
        const d = new Date();
        d.setDate(d.getDate() + 7);
        document.getElementById('ordDeliveryDate').value = d.toISOString().slice(0,10);
        ['ordCustomerCode','ordProductCode','ordSpec','ordColor','ordStamp','ordMaterialBoard','ordMaterialShell','ordBoardCode','ordShellStock','ordRemark'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('pasteText').value = '';
        document.getElementById('pasteParsePreview').style.display = 'none';
        const syncCheck = document.getElementById('ordSyncToPurchase');
        if (syncCheck) syncCheck.checked = true;
    }
    const modal = new bootstrap.Modal(document.getElementById(id));
    modal.show();
}

function closeModal(id) {
    const modal = bootstrap.Modal.getInstance(document.getElementById(id));
    if (modal) modal.hide();
}

// ============================================================
//  侧边栏折叠功能
// ============================================================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle('collapsed', sidebarCollapsed);
    localStorage.setItem('erp_sidebar_collapsed', JSON.stringify(sidebarCollapsed));
    
    if (sidebarCollapsed) {
        popupExpandedGroup = null;
    } else {
        popupExpandedGroup = null;
    }
    
    const mainWrap = document.querySelector('.main-wrap');
    if (mainWrap) {
        if (sidebarCollapsed) {
            mainWrap.style.width = 'calc(100% - 70px)';
            mainWrap.style.marginLeft = '0';
        } else {
            mainWrap.style.width = '';
            mainWrap.style.marginLeft = '';
        }
    }
    
    const icon = document.getElementById('collapseIcon');
    if (icon) {
        icon.style.transform = sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    
    renderMenu();
}

function restoreSidebarState() {
    const stored = localStorage.getItem('erp_sidebar_collapsed');
    if (stored !== null) {
        sidebarCollapsed = JSON.parse(stored);
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed', sidebarCollapsed);
            const mainWrap = document.querySelector('.main-wrap');
            if (mainWrap) {
                if (sidebarCollapsed) {
                    mainWrap.style.width = 'calc(100% - 60px)';
                    mainWrap.style.marginLeft = '0';
                } else {
                    mainWrap.style.width = '';
                    mainWrap.style.marginLeft = '';
                }
            }
            const icon = document.getElementById('collapseIcon');
            if (icon) {
                icon.style.transform = sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        }
    }
}

document.addEventListener('click', function(e) {
    if (sidebarCollapsed && popupExpandedGroup) {
        const sidebar = document.getElementById('sidebar');
        const menuGroup = sidebar.querySelector('.menu-group[data-group="' + popupExpandedGroup + '"]');
        if (menuGroup && !menuGroup.contains(e.target)) {
            if (!sidebar.contains(e.target)) {
                popupExpandedGroup = null;
                renderMenu();
            }
        }
    }
});

// ============================================================
//  渲染全部
// ============================================================

function renderAll() {
    if (currentPage === 'dashboard') { if (window.initDashboard) window.initDashboard(); }
    if (currentPage === 'orders') { if (window.initOrders) window.initOrders(); }
    if (currentPage === 'production') { if (window.initProduction) window.initProduction(); }
    if (currentPage === 'outsource') { if (window.initOutsource) window.initOutsource(); }
    if (currentPage === 'shipment') { if (window.initShipment) window.initShipment(); }
    if (currentPage === 'quality') { if (window.initQuality) window.initQuality(); }
    if (currentPage === 'customers') { if (window.initCustomers) window.initCustomers(); }
    if (currentPage === 'products') { if (window.initProducts) window.initProducts(); }
    if (currentPage === 'purchase') { if (window.initPurchase) window.initPurchase(); }
    if (currentPage === 'purchaseDetail') { if (window.initPurchaseDetail) window.initPurchaseDetail(); }
    if (currentPage === 'reconciliation') { if (window.initReconciliation) window.initReconciliation(); }
    if (currentPage === 'inventory') { if (window.initInventory) window.initInventory(); }
    saveDataToStorage();
}

// ============================================================
//  ★★★ 强制修复 statusBadge 颜色 ★★★
// ============================================================

// 重新定义 statusBadge 确保覆盖
function statusBadge(status) {
    var map = {
        // 订单状态 - 使用显眼的颜色
        '待生产': 'bg-soft-secondary',
        '生产中': 'bg-soft-warning',      // 橙色
        '待质检': 'bg-soft-warning',
        '质检中': 'bg-soft-warning',
        '质检合格': 'bg-soft-success',
        '质检不合格': 'bg-soft-danger',
        '质检未通过-返单': 'bg-soft-danger',
        '质检未通过-返单(生产)': 'bg-soft-danger',
        '质检未通过-返单(外发)': 'bg-soft-danger',
        '待出货': 'bg-soft-primary',
        '已完成': 'bg-soft-success',
        '已出货': 'bg-soft-success',
        '已完成-待送货': 'bg-soft-info',
        '已送货完成': 'bg-soft-success',

        // 外发状态
        '待外发': 'bg-soft-secondary',
        '外发中': 'bg-soft-warning',      // 橙色
        '已完成-待出货': 'bg-soft-success',

        // 质检结果
        '合格': 'bg-soft-success',
        '不合格': 'bg-soft-danger',

        // 对账状态
        '待对账': 'bg-soft-warning',
        '已对账': 'bg-soft-primary',
        '已结清': 'bg-soft-success',

        // 生产阶段
        '开料': 'bg-soft-secondary',
        '压板材': 'bg-soft-warning',
        '出成品': 'bg-soft-primary',
        '包装待送货': 'bg-soft-success'
    };
    return map[status] || 'bg-soft-secondary';
}

// ============================================================
//  ★★★ 页面启动自动初始化 ★★★
// ============================================================

(function() {
    console.log('🚀 页面启动，开始初始化...');
    
    // 优先从服务器加载数据
    loadDataFromServer()
        .then(function(success) {
            console.log('📊 数据加载结果:', success ? '成功' : '失败（使用缓存）');
            // 渲染菜单
            renderMenu();
            // 切换到默认页面
            if (!currentPage || currentPage === '') {
                switchPage('dashboard');
            } else {
                switchPage(currentPage);
            }
            // 恢复侧边栏状态
            restoreSidebarState();
            // 绑定侧边栏切换事件
            initSidebarEvents();
            console.log('✅ 系统初始化完成');
        })
        .catch(function(err) {
            console.warn('⚠️ 服务器加载失败，使用 localStorage:', err);
            // 降级到 localStorage
            loadDataFromStorage();
            renderMenu();
            if (!currentPage || currentPage === '') {
                switchPage('dashboard');
            } else {
                switchPage(currentPage);
            }
            restoreSidebarState();
            initSidebarEvents();
            console.log('✅ 系统初始化完成（使用缓存）');
        });
})();

// 侧边栏事件绑定（避免重复绑定）
function initSidebarEvents() {
    var toggleBtn = document.getElementById('sidebarToggle');
    if (toggleBtn) {
        // 移除旧监听器（防止重复绑定）
        var newBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);
        newBtn.addEventListener('click', function() {
            document.getElementById('sidebar').classList.toggle('open');
        });
    }
    
    // 点击外部关闭侧边栏
    document.addEventListener('click', function(e) {
        var sidebar = document.getElementById('sidebar');
        var toggle = document.getElementById('sidebarToggle');
        if (window.innerWidth <= 992 && sidebar && sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) && toggle && !toggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

// 覆盖到全局
window.statusBadge = statusBadge;

// ============================================================
//  页面初始化
// ============================================================

// 暴露全局变量和函数
window.data = data;
window.switchPage = switchPage;
window.renderAll = renderAll;
window.exportData = exportData;
window.importData = importData;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleMenuManage = toggleMenuManage;
window.deleteMenuItem = deleteMenuItem;
window.openMenuManager = openMenuManager;
window.recoverMenus = recoverMenus;
window.addCustomMenu = addCustomMenu;
window.saveDataToStorage = saveDataToStorage;
window.loadDataFromStorage = loadDataFromStorage;
window.loadDataFromServer = loadDataFromServer;
window.parseExtraFields = parseExtraFields;
window.parseProductExtraFields = parseProductExtraFields;
window.getMenuItems = getMenuItems;
window.renderMenu = renderMenu;
window.onGroupHeaderClick = onGroupHeaderClick;
window.toggleGroup = toggleGroup;
window.showCustomPage = showCustomPage;
window.toggleSidebar = toggleSidebar;
window.restoreSidebarState = restoreSidebarState;
window.baseColumns = baseColumns;
window.shipmentColumns = shipmentColumns;
window.outColumns = outColumns;
window.detailFieldDefs = detailFieldDefs;
window.dashboardCardDefs = dashboardCardDefs;
window.defaultActionCards = defaultActionCards;
window.builtinMenuItems = builtinMenuItems;
window.menuGroups = menuGroups;
window.menuVisible = menuVisible;
window.detailFieldsVisible = detailFieldsVisible;
window.dashboardCardsVisible = dashboardCardsVisible;
window.customMenus = customMenus;
window.detailCustomFields = detailCustomFields;
window.dashboardCustomCards = dashboardCustomCards;
window.orderColumnsVisible = orderColumnsVisible;
window.prodColumnsVisible = prodColumnsVisible;
window.shipColumnsVisible = shipColumnsVisible;
window.outColumnsVisible = outColumnsVisible;
window.detailManageMode = detailManageMode;
window.dashboardManageMode = dashboardManageMode;
window.menuManageMode = menuManageMode;
window.excelParsedData = excelParsedData;
window.sidebarCollapsed = sidebarCollapsed;
window.groupCollapsed = groupCollapsed;
window.popupExpandedGroup = popupExpandedGroup;
window.updateBadges = updateBadges;

console.log('✅ app.js 已加载完成');