// ============================================================
//  生产管理模块（完整版 · 服务器存储）
//  功能：生产单列表、阶段流转、合格数量、删除、列设置、底色、高亮
//  修复：推送生产时从后端获取最新订单 ID，避免 ID 不一致
// ============================================================

// ★★★ 确保 showToast 存在 ★★★
if (typeof showToast === 'undefined') {
    window.showToast = function(message, type = 'success') {
        console.log('📢 [Toast]', type, message);
        alert(message);
    };
    console.warn('⚠️ showToast 未加载，已使用备用 alert 替代');
}

// ★★★ 列配置 ★★★
const productionColumns = [
    { key: 'checkbox', label: '☑' },
    { key: 'status', label: '状态' },
    { key: 'stage', label: '当前阶段' },
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

const PROD_COLUMN_ORDER_KEY = 'erp_production_column_order';
const PROD_COLUMN_WIDTHS_KEY = 'erp_production_column_widths';
const PROD_COLUMN_VISIBLE_KEY = 'erp_production_column_visible';

let productionHighlight = null;
var selectedProductionRowId = null;
var currentProdHighlightRow = null;

// ============================================================
//  列设置函数
// ============================================================

function getProdColumnOrder() {
    try {
        const stored = localStorage.getItem(PROD_COLUMN_ORDER_KEY);
        if (stored) {
            const order = JSON.parse(stored);
            const allKeys = productionColumns.map(c => c.key);
            const missingKeys = allKeys.filter(k => !order.includes(k));
            if (missingKeys.length > 0) {
                const newOrder = [...order, ...missingKeys];
                saveProdColumnOrder(newOrder);
                return newOrder;
            }
            return order;
        }
    } catch (e) {}
    return productionColumns.map(c => c.key);
}
function saveProdColumnOrder(orderArray) {
    localStorage.setItem(PROD_COLUMN_ORDER_KEY, JSON.stringify(orderArray));
}
function getProdColumnWidths() {
    try {
        const stored = localStorage.getItem(PROD_COLUMN_WIDTHS_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
}
function saveProdColumnWidth(colKey, width) {
    const widths = getProdColumnWidths();
    widths[colKey] = width;
    localStorage.setItem(PROD_COLUMN_WIDTHS_KEY, JSON.stringify(widths));
}
function getProdColumnWidth(colKey, defaultWidth) {
    const widths = getProdColumnWidths();
    return widths[colKey] || defaultWidth;
}
function getProdColumnVisible() {
    try {
        const stored = localStorage.getItem(PROD_COLUMN_VISIBLE_KEY);
        if (stored) {
            const visible = JSON.parse(stored);
            productionColumns.forEach(c => {
                if (visible[c.key] === undefined) visible[c.key] = true;
            });
            return visible;
        }
    } catch (e) {}
    const defaultVisible = {};
    productionColumns.forEach(c => { defaultVisible[c.key] = true; });
    return defaultVisible;
}
function saveProdColumnVisible(visibleObj) {
    localStorage.setItem(PROD_COLUMN_VISIBLE_KEY, JSON.stringify(visibleObj));
}

// 列宽拖拽初始化（略）
function initProdColumnResize() {
    const table = document.querySelector('#prodTable');
    if (!table) return;
    const oldHandles = table.querySelectorAll('.col-resize-handle');
    oldHandles.forEach(h => h.remove());
    const headers = table.querySelectorAll('thead th');
    let dragData = null;
    let ghostLine = null;

    if (!document.getElementById('colResizeGhost')) {
        ghostLine = document.createElement('div');
        ghostLine.id = 'colResizeGhost';
        ghostLine.className = 'col-resize-ghost';
        document.body.appendChild(ghostLine);
    } else {
        ghostLine = document.getElementById('colResizeGhost');
    }

    headers.forEach((th, index) => {
        const colKey = th.dataset.col;
        if (!colKey || colKey === 'checkbox') return;
        const savedWidth = getProdColumnWidth(colKey);
        if (savedWidth) {
            th.style.width = savedWidth + 'px';
            th.style.minWidth = savedWidth + 'px';
            const colIndex = index;
            table.querySelectorAll('tbody tr').forEach(row => {
                const td = row.querySelectorAll('td')[colIndex];
                if (td) {
                    td.style.width = savedWidth + 'px';
                    td.style.minWidth = savedWidth + 'px';
                }
            });
        }
        const handle = document.createElement('div');
        handle.className = 'col-resize-handle';
        handle.dataset.index = index;
        handle.dataset.col = colKey;
        handle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const tableEl = this.closest('table');
            const colIndex = parseInt(this.dataset.index);
            const colKey = this.dataset.col;
            const thEl = tableEl.querySelectorAll('thead th')[colIndex];
            const startX = e.clientX;
            const startWidth = thEl.offsetWidth;

            ghostLine.style.left = (startX) + 'px';
            ghostLine.classList.add('visible');
            document.body.classList.add('resizing');
            this.classList.add('dragging');

            dragData = {
                colIndex: colIndex,
                colKey: colKey,
                thEl: thEl,
                startX: startX,
                startWidth: startWidth,
                handle: this
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        th.style.position = 'relative';
        th.appendChild(handle);
    });

    function onMouseMove(e) {
        if (!dragData) return;
        const delta = e.clientX - dragData.startX;
        let newWidth = dragData.startWidth + delta;
        newWidth = Math.max(40, newWidth);
        newWidth = Math.min(400, newWidth);

        dragData.thEl.style.width = newWidth + 'px';
        dragData.thEl.style.minWidth = newWidth + 'px';

        const tableEl = dragData.thEl.closest('table');
        const colIndex = dragData.colIndex;
        tableEl.querySelectorAll('tbody tr').forEach(row => {
            const td = row.querySelectorAll('td')[colIndex];
            if (td) {
                td.style.width = newWidth + 'px';
                td.style.minWidth = newWidth + 'px';
            }
        });

        ghostLine.style.left = e.clientX + 'px';
    }

    function onMouseUp(e) {
        if (!dragData) return;
        const newWidth = dragData.thEl.offsetWidth;
        saveProdColumnWidth(dragData.colKey, newWidth);

        document.body.classList.remove('resizing');
        if (dragData.handle) {
            dragData.handle.classList.remove('dragging');
        }
        ghostLine.classList.remove('visible');

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        dragData = null;
    }
}

// 列设置模态框
function openProdColumnSettings() {
    const content = document.getElementById('prodColumnSettingsContent');
    if (!content) return;
    const order = getProdColumnOrder();
    const visible = getProdColumnVisible();

    let html = '<div class="mb-2"><strong>调整列顺序（点击 ↑↓ 移动）</strong></div>';
    html += '<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="prod_col_all" onchange="toggleProdAllColumns(this.checked)"><label class="form-check-label" for="prod_col_all">全选</label></div>';
    html += '<div id="prodColumnSortableList" class="list-group">';
    order.forEach(key => {
        const col = productionColumns.find(c => c.key === key);
        if (!col) return;
        const isCheckbox = key === 'checkbox';
        const checked = (visible[key] !== false) ? 'checked' : '';
        const disabledAttr = isCheckbox ? 'disabled' : '';
        html += `<div class="list-group-item d-flex align-items-center justify-content-between" data-key="${key}" style="padding:6px 12px;">`;
        html += `<div class="d-flex align-items-center gap-2">`;
        html += `<input type="checkbox" class="form-check-input prod-col-check" data-col="${key}" ${checked} ${disabledAttr} onchange="updateProdColumnVisibility()">`;
        html += `<span style="font-weight:500;">${col.label}</span>`;
        if (isCheckbox) html += `<span class="text-muted" style="font-size:11px;">（固定）</span>`;
        html += `</div>`;
        html += `<div>`;
        html += `<button class="btn btn-sm btn-outline-secondary" onclick="moveProdColumnUp('${key}')" title="上移">↑</button>`;
        html += `<button class="btn btn-sm btn-outline-secondary" onclick="moveProdColumnDown('${key}')" title="下移">↓</button>`;
        html += `</div>`;
        html += `</div>`;
    });
    html += '</div>';
    // 清空生产单按钮
    html += `<hr style="margin:12px 0;">`;
    html += `<div class="d-flex justify-content-between align-items-center">`;
    html += `<span style="font-size:13px;color:#6c7a8a;">⚠️ 清空所有生产单数据</span>`;
    html += `<button class="btn btn-sm btn-outline-danger" onclick="clearAllProductions()" style="font-size:12px;">`;
    html += `<i class="bi bi-trash3"></i> 清空生产单</button>`;
    html += `</div>`;

    content.innerHTML = html;
    new bootstrap.Modal(document.getElementById('prodColumnSettingsModal')).show();
}

function refreshProdColumnSettingsList() {
    const container = document.getElementById('prodColumnSortableList');
    if (!container) return;
    const order = getProdColumnOrder();
    const visible = getProdColumnVisible();
    let html = '';
    order.forEach(key => {
        const col = productionColumns.find(c => c.key === key);
        if (!col) return;
        const isCheckbox = key === 'checkbox';
        const checked = (visible[key] !== false) ? 'checked' : '';
        const disabledAttr = isCheckbox ? 'disabled' : '';
        html += `<div class="list-group-item d-flex align-items-center justify-content-between" data-key="${key}" style="padding:6px 12px;">`;
        html += `<div class="d-flex align-items-center gap-2">`;
        html += `<input type="checkbox" class="form-check-input prod-col-check" data-col="${key}" ${checked} ${disabledAttr} onchange="updateProdColumnVisibility()">`;
        html += `<span style="font-weight:500;">${col.label}</span>`;
        if (isCheckbox) html += `<span class="text-muted" style="font-size:11px;">（固定）</span>`;
        html += `</div>`;
        html += `<div>`;
        html += `<button class="btn btn-sm btn-outline-secondary" onclick="moveProdColumnUp('${key}')" title="上移">↑</button>`;
        html += `<button class="btn btn-sm btn-outline-secondary" onclick="moveProdColumnDown('${key}')" title="下移">↓</button>`;
        html += `</div>`;
        html += `</div>`;
    });
    container.innerHTML = html;
    const allCheckbox = document.getElementById('prod_col_all');
    if (allCheckbox) {
        const items = document.querySelectorAll('.prod-col-check:not([disabled])');
        const checkedItems = document.querySelectorAll('.prod-col-check:not([disabled]):checked');
        allCheckbox.checked = items.length > 0 && checkedItems.length === items.length;
    }
}

function moveProdColumnUp(key) {
    const order = getProdColumnOrder();
    const idx = order.indexOf(key);
    if (idx <= 0) return;
    [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
    saveProdColumnOrder(order);
    refreshProdColumnSettingsList();
    renderProduction();
}
function moveProdColumnDown(key) {
    const order = getProdColumnOrder();
    const idx = order.indexOf(key);
    if (idx === -1 || idx >= order.length - 1) return;
    [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
    saveProdColumnOrder(order);
    refreshProdColumnSettingsList();
    renderProduction();
}
function updateProdColumnVisibility() {
    const visible = getProdColumnVisible();
    document.querySelectorAll('.prod-col-check').forEach(cb => {
        const col = cb.dataset.col;
        if (cb.disabled) return;
        visible[col] = cb.checked;
    });
    saveProdColumnVisible(visible);
    renderProduction();
}
function toggleProdAllColumns(checked) {
    document.querySelectorAll('.prod-col-check:not([disabled])').forEach(cb => {
        cb.checked = checked;
        const col = cb.dataset.col;
        const visible = getProdColumnVisible();
        visible[col] = checked;
        saveProdColumnVisible(visible);
    });
    renderProduction();
}
function resetProdColumns() {
    if (!confirm('恢复所有列到默认顺序和可见性，列宽也将重置。确定？')) return;
    const defaultOrder = productionColumns.map(c => c.key);
    saveProdColumnOrder(defaultOrder);
    const defaultVisible = {};
    productionColumns.forEach(c => { defaultVisible[c.key] = true; });
    saveProdColumnVisible(defaultVisible);
    localStorage.removeItem(PROD_COLUMN_WIDTHS_KEY);
    renderProduction();
    const modal = bootstrap.Modal.getInstance(document.getElementById('prodColumnSettingsModal'));
    if (modal) modal.hide();
    alert('✅ 列已恢复默认（顺序、可见性、宽度）');
}

// ============================================================
//  核心 API 函数
// ============================================================

async function apiGetProductions() {
    const res = await fetch('/api/productions');
    if (!res.ok) throw new Error('获取生产单失败');
    return res.json();
}

async function apiCreateProduction(data) {
    const res = await fetch('/api/productions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('创建生产单失败');
    return res.json();
}

async function apiUpdateProduction(id, data) {
    const res = await fetch(`/api/productions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('更新生产单失败');
    return res.json();
}

async function apiDeleteProduction(id) {
    const res = await fetch(`/api/productions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('删除生产单失败');
    return res.json();
}

// ============================================================
//  渲染生产列表
// ============================================================

function getProdFilteredList() {
    const filterKeyword = document.getElementById('prodFilterKeyword')?.value?.toLowerCase() || '';
    const filterStage = document.getElementById('prodFilterStage')?.value || '';

    const filterSelects = document.querySelectorAll('.filter-row select');
    const colFilters = {};
    filterSelects.forEach(sel => {
        const col = sel.dataset.col;
        if (col && sel.value) colFilters[col] = sel.value;
    });

    let list = data.productions.filter(p => {
        const order = getOrder(p.orderId);
        if (!order) return false;
        if (p.stage === '已完成-待送货') return false;
        if (p.stage === '已完成') return false;

        let matchKeyword = true;
        if (filterKeyword) {
            const searchText = (order.orderNo || '') + ' ' +
                               (order.productName || '') + ' ' +
                               (order.customerCode || '') + ' ' +
                               (p.stage || '');
            matchKeyword = searchText.toLowerCase().includes(filterKeyword);
        }

        const matchStage = filterStage === '' || p.stage === filterStage;

        let matchCols = true;
        for (const col in colFilters) {
            const val = colFilters[col];
            if (!val) continue;
            let cellVal = '';
            switch (col) {
                case 'status': cellVal = order.status || ''; break;
                case 'stage': cellVal = p.stage || ''; break;
                case 'customerCode': cellVal = order.customerCode || ''; break;
                case 'orderNo': cellVal = order.orderNo || ''; break;
                case 'productCode': cellVal = order.productCode || ''; break;
                case 'productName': cellVal = order.productName || ''; break;
                case 'spec': cellVal = order.spec || ''; break;
                case 'color': cellVal = order.color || ''; break;
                case 'stamp': cellVal = order.stamp || ''; break;
                case 'qty': cellVal = String(order.qty || ''); break;
                case 'materialBoard': cellVal = order.materialBoard || ''; break;
                case 'materialShell': cellVal = order.materialShell || ''; break;
                case 'orderDate': cellVal = order.orderDate || ''; break;
                case 'deliveryDate': cellVal = order.deliveryDate || ''; break;
                case 'boardCode': cellVal = order.boardCode || ''; break;
                case 'shellStock': cellVal = order.shellStock || ''; break;
                case 'progress': cellVal = String(order.progress || ''); break;
                case 'qualityStatus': cellVal = order.qualityStatus || ''; break;
                case 'shipmentSchedule': cellVal = order.shipmentSchedule || ''; break;
                case 'remark': cellVal = order.remark || ''; break;
                default: break;
            }
            if (cellVal !== val) { matchCols = false; break; }
        }
        return matchKeyword && matchStage && matchCols;
    });

    list.sort((a, b) => b.id - a.id);
    return list;
}

function renderProduction() {
    console.log('🔄 执行完整版 renderProduction...');
    
    // 确保高亮管理器已初始化
    if (!productionHighlight) {
        productionHighlight = new HighlightManager('production', {
            getSelectedIds: function() {
                const ids = [];
                document.querySelectorAll('.prod-checkbox:checked').forEach(cb => {
                    const id = parseInt(cb.dataset.prodId);
                    if (!isNaN(id)) ids.push(String(id));
                });
                return ids;
            },
            renderCallback: renderProduction,
            idAttribute: 'data-prod-id'
        });
    }

    // 获取筛选条件
    var filterKeyword = document.getElementById('prodFilterKeyword')?.value?.toLowerCase() || '';
    var filterStage = document.getElementById('prodFilterStage')?.value || '';

    // 获取列筛选（如果有）
    var filterSelects = document.querySelectorAll('.filter-row select');
    var colFilters = {};
    filterSelects.forEach(function(sel) {
        var col = sel.dataset.col;
        if (col && sel.value) colFilters[col] = sel.value;
    });

    // 筛选生产单（排除已完成/已完成-待送货）
    var list = data.productions.filter(function(p) {
        if (p.stage === '已完成-待送货' || p.stage === '已完成') return false;
        var order = getOrder(p.orderId);
        if (!order) return false;

        // ★★★ 兼容驼峰和下划线命名 ★★★
        var customerCode = order.customerCode || order.customer_code || '';
        var orderNo = order.orderNo || order.order_no || '';
        var productCode = order.productCode || order.product_code || '';
        var productName = order.productName || order.product_name || '';
        var spec = order.spec || '';
        var color = order.color || '';
        var stamp = order.stamp || '';
        var qty = order.qty || 0;
        var materialBoard = order.materialBoard || '';
        var materialShell = order.materialShell || '';
        var orderDate = order.orderDate || '';
        var deliveryDate = order.deliveryDate || '';
        var boardCode = order.boardCode || '';
        var shellStock = order.shellStock || '';
        var progress = order.progress || 0;
        var qualityStatus = order.qualityStatus || '';
        var shipmentSchedule = order.shipmentSchedule || '';
        var remark = order.remark || '';
        var partyName = order.partyName || '';
        var partyContact = order.partyContact || '';

        var matchKeyword = true;
        if (filterKeyword) {
            var searchText = orderNo + ' ' + productName + ' ' + customerCode + ' ' + (p.stage || '');
            matchKeyword = searchText.toLowerCase().includes(filterKeyword);
        }

        var matchStage = filterStage === '' || p.stage === filterStage;

        var matchCols = true;
        for (var col in colFilters) {
            var val = colFilters[col];
            if (!val) continue;
            var cellVal = '';
            switch (col) {
                case 'status': cellVal = order.status || ''; break;
                case 'stage': cellVal = p.stage || ''; break;
                case 'customerCode': cellVal = customerCode; break;
                case 'orderNo': cellVal = orderNo; break;
                case 'productCode': cellVal = productCode; break;
                case 'productName': cellVal = productName; break;
                case 'spec': cellVal = spec; break;
                case 'color': cellVal = color; break;
                case 'stamp': cellVal = stamp; break;
                case 'qty': cellVal = String(qty); break;
                case 'materialBoard': cellVal = materialBoard; break;
                case 'materialShell': cellVal = materialShell; break;
                case 'orderDate': cellVal = orderDate; break;
                case 'deliveryDate': cellVal = deliveryDate; break;
                case 'boardCode': cellVal = boardCode; break;
                case 'shellStock': cellVal = shellStock; break;
                case 'progress': cellVal = String(progress); break;
                case 'qualityStatus': cellVal = qualityStatus; break;
                case 'shipmentSchedule': cellVal = shipmentSchedule; break;
                case 'remark': cellVal = remark; break;
                default: break;
            }
            if (cellVal !== val) { matchCols = false; break; }
        }
        return matchKeyword && matchStage && matchCols;
    });

    list.sort(function(a, b) { return b.id - a.id; });

    // 列配置
    var colOrder = getProdColumnOrder();
    var orderedColumns = [];
    colOrder.forEach(function(key) {
        var col = productionColumns.find(function(c) { return c.key === key; });
        if (col) orderedColumns.push(col);
    });
    productionColumns.forEach(function(col) {
        if (!orderedColumns.some(function(c) { return c.key === col.key; })) {
            orderedColumns.push(col);
        }
    });

    var visibleCols = orderedColumns.filter(function(col) {
        if (col.key === 'checkbox') return true;
        return getProdColumnVisible()[col.key] !== false;
    });
    if (!visibleCols.some(function(c) { return c.key === 'actions'; })) {
        var actionsCol = productionColumns.find(function(c) { return c.key === 'actions'; });
        if (actionsCol) visibleCols.push(actionsCol);
    }

    var defaultWidths = {
        'checkbox': 50,
        'status': 80,
        'stage': 100,
        'customerCode': 90,
        'orderNo': 140,
        'productCode': 160,
        'productName': 220,
        'spec': 200,
        'color': 80,
        'stamp': 80,
        'qty': 80,
        'materialBoard': 80,
        'materialShell': 80,
        'orderDate': 110,
        'deliveryDate': 110,
        'boardCode': 100,
        'shellStock': 100,
        'progress': 80,
        'qualityStatus': 90,
        'shipmentSchedule': 120,
        'partyName': 160,
        'partyContact': 100,
        'remark': 180,
        'actions': 160
    };

    // 表头
    var thead = document.getElementById('prodThead');
    if (!thead) return;
    var headerHtml = '<tr>';
    headerHtml += '<th data-col="checkbox" style="width:50px;min-width:50px;max-width:50px;text-align:center;position:sticky;left:0;z-index:25;background:#fafbfc;border-right:1px solid #e9edf2;">';
    headerHtml += '<input type="checkbox" id="selectAllProd" onchange="toggleAllProdRows()" style="width:18px;height:18px;cursor:pointer;accent-color:#0066cc;">';
    headerHtml += '</th>';

    visibleCols.forEach(function(col) {
        if (col.key === 'checkbox') return;
        var isSticky = (col.key === 'remark' || col.key === 'actions');
        var stickyClass = isSticky ? 'sticky-col' : '';
        var remarkClass = col.key === 'remark' ? 'sticky-col-remark' : '';
        var actionsClass = col.key === 'actions' ? 'sticky-col-actions' : '';
        var width = getProdColumnWidth(col.key) || defaultWidths[col.key] || 120;
        if (col.key === 'actions') {
            headerHtml += '<th data-col="' + col.key + '" class="' + stickyClass + ' ' + remarkClass + ' ' + actionsClass + '" style="width:' + width + 'px;min-width:' + width + 'px;">' + col.label + '</th>';
        } else {
            headerHtml += '<th data-col="' + col.key + '" class="' + stickyClass + ' ' + remarkClass + ' ' + actionsClass + '" style="position:relative;width:' + width + 'px;min-width:' + width + 'px;">' + col.label + '</th>';
        }
    });
    headerHtml += '</tr>';

    // 筛选行
    headerHtml += '<tr class="filter-row">';
    headerHtml += '<th style="width:50px;min-width:50px;max-width:50px;position:sticky;left:0;z-index:20;background:#f8fafc;border-right:1px solid #e9edf2;"></th>';
    visibleCols.forEach(function(col) {
        if (col.key === 'checkbox' || col.key === 'actions') {
            headerHtml += '<th></th>';
            return;
        }
        var options = new Set();
        data.productions.forEach(function(p) {
            var order = getOrder(p.orderId);
            if (!order) return;
            // 兼容字段
            var val = '';
            switch (col.key) {
                case 'status': val = order.status || ''; break;
                case 'stage': val = p.stage || ''; break;
                case 'customerCode': val = order.customerCode || order.customer_code || ''; break;
                case 'orderNo': val = order.orderNo || order.order_no || ''; break;
                case 'productCode': val = order.productCode || order.product_code || ''; break;
                case 'productName': val = order.productName || order.product_name || ''; break;
                case 'spec': val = order.spec || ''; break;
                case 'color': val = order.color || ''; break;
                case 'stamp': val = order.stamp || ''; break;
                case 'qty': val = String(order.qty || 0); break;
                case 'materialBoard': val = order.materialBoard || ''; break;
                case 'materialShell': val = order.materialShell || ''; break;
                case 'orderDate': val = order.orderDate || ''; break;
                case 'deliveryDate': val = order.deliveryDate || ''; break;
                case 'boardCode': val = order.boardCode || ''; break;
                case 'shellStock': val = order.shellStock || ''; break;
                case 'progress': val = String(order.progress || 0); break;
                case 'qualityStatus': val = order.qualityStatus || ''; break;
                case 'shipmentSchedule': val = order.shipmentSchedule || ''; break;
                case 'remark': val = order.remark || ''; break;
                default: break;
            }
            if (val) options.add(val);
        });
        var sortedOptions = Array.from(options).sort();
        var selectHtml = '<select data-col="' + col.key + '" class="form-select form-select-sm" style="font-size:12px;border:1px solid #e2e8f0;border-radius:4px;padding:2px 4px;background:#fff;" onchange="renderProduction()"><option value="">全部</option>';
        sortedOptions.forEach(function(opt) {
            selectHtml += '<option value="' + opt + '">' + opt + '</option>';
        });
        selectHtml += '</select>';
        headerHtml += '<th>' + selectHtml + '</th>';
    });
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    // 表格体
    var tbody = document.getElementById('prodBody');
    if (!tbody) return;
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="' + (visibleCols.length + 1) + '" class="text-center text-muted">暂无生产单</td></tr>';
        return;
    }

    var rowsHtml = '';
    list.forEach(function(p) {
        var order = getOrder(p.orderId);
        if (!order) return;
        var highlightColor = productionHighlight ? productionHighlight.getColor(String(p.id)) : '';
        var rowBg = highlightColor || '';

        // ★★★ 读取订单扩展字段（兼容驼峰和下划线） ★★★
        var customerCode = order.customerCode || order.customer_code || '';
        var orderNo = order.orderNo || order.order_no || '';
        var productCode = order.productCode || order.product_code || '';
        var productName = order.productName || order.product_name || '';
        var spec = order.spec || '';
        var color = order.color || '';
        var stamp = order.stamp || '';
        var qty = order.qty || 0;
        var materialBoard = order.materialBoard || '';
        var materialShell = order.materialShell || '';
        var orderDate = order.orderDate || '';
        var deliveryDate = order.deliveryDate || '';
        var boardCode = order.boardCode || '';
        var shellStock = order.shellStock || '';
        var progress = order.progress || 0;
        var qualityStatus = order.qualityStatus || '';
        var shipmentSchedule = order.shipmentSchedule || '';
        var remark = order.remark || '';
        var partyName = order.partyName || '';
        var partyContact = order.partyContact || '';

        var stageColors = {
            '开料': 'bg-soft-secondary',
            '压板材': 'bg-soft-warning',
            '出成品': 'bg-soft-primary',
            '包装待送货': 'bg-soft-success',
            '已完成': 'bg-soft-success',
            '已完成-待送货': 'bg-soft-info'
        };
        var stageClass = stageColors[p.stage] || 'bg-soft-secondary';

        rowsHtml += '<tr data-prod-id="' + p.id + '" onclick="selectProdRow(this, ' + p.id + ')" ondblclick="openProductionDetail(' + p.id + ')" style="cursor:pointer;">';

        rowsHtml += '<td style="text-align:center;width:50px;min-width:50px;max-width:50px;position:sticky;left:0;z-index:5;background:' + rowBg + ';border-right:1px solid #e9edf2;">';
        rowsHtml += '<input type="checkbox" class="prod-checkbox" data-prod-id="' + p.id + '" onclick="event.stopPropagation();" style="width:18px;height:18px;cursor:pointer;accent-color:#0066cc;">';
        rowsHtml += '</td>';

        visibleCols.forEach(function(col) {
            if (col.key === 'checkbox') return;
            if (col.key === 'actions') {
                rowsHtml += '<td class="sticky-col sticky-col-actions" style="min-width:160px;width:160px;overflow:visible;text-overflow:clip;white-space:nowrap;background:' + rowBg + ';position:sticky;right:0;z-index:5;box-shadow:-2px 0 6px rgba(0,0,0,0.06);">';
                rowsHtml += '<button class="btn btn-sm btn-outline-custom" onclick="event.stopPropagation(); openProductionDetail(' + p.id + ')"><i class="bi bi-eye"></i> 查看</button>';
                rowsHtml += '<button class="btn btn-sm btn-outline-custom text-danger" onclick="event.stopPropagation(); if(confirm(\'确认删除此生产单？\')) deleteProduction(' + p.id + ')"><i class="bi bi-trash3"></i> 删除</button>';
                rowsHtml += '</td>';
                return;
            }

            var val = '';
            var extraClass = '';
            if (col.key === 'productName' || col.key === 'spec' || col.key === 'remark' || col.key === 'partyName' || col.key === 'partyContact') {
                extraClass = 'wrap-cell';
            }
            if (col.key === 'productName') extraClass += ' product-name';
            if (col.key === 'spec') extraClass += ' spec-cell';

            var isSticky = (col.key === 'remark' || col.key === 'actions');
            var stickyClass = isSticky ? 'sticky-col' : '';
            var remarkClass = col.key === 'remark' ? 'sticky-col-remark' : '';
            var width = getProdColumnWidth(col.key) || defaultWidths[col.key] || 120;

            switch (col.key) {
                case 'status':
                    val = '<span class="badge-status ' + statusBadge(order.status) + '">' + (order.status || '待生产') + '</span>';
                    break;
                case 'stage':
                    val = '<span class="badge-status ' + stageClass + '">' + (p.stage || '未开始') + '</span>';
                    break;
                case 'customerCode': val = customerCode; break;
                case 'orderNo': val = orderNo; break;
                case 'productCode': val = productCode; break;
                case 'productName': val = productName; break;
                case 'spec': val = spec; break;
                case 'color': val = color; break;
                case 'stamp': val = stamp; break;
                case 'qty': val = qty; break;
                case 'materialBoard': val = materialBoard; break;
                case 'materialShell': val = materialShell; break;
                case 'orderDate': val = orderDate; break;
                case 'deliveryDate': val = deliveryDate; break;
                case 'boardCode': val = boardCode; break;
                case 'shellStock': val = shellStock; break;
                case 'progress': val = progress; break;
                case 'qualityStatus': val = qualityStatus; break;
                case 'shipmentSchedule': val = shipmentSchedule; break;
                case 'partyName': val = getCustomerShortName(partyName); break;
                case 'partyContact': val = partyContact; break;
                case 'remark': val = remark; break;
                default: val = '';
            }

            rowsHtml += '<td class="' + stickyClass + ' ' + remarkClass + ' ' + extraClass + '" style="width:' + width + 'px;min-width:' + width + 'px;background:' + rowBg + ';">' + val + '</td>';
        });

        rowsHtml += '</tr>';
    });

    tbody.innerHTML = rowsHtml;

    // 恢复高亮
    restoreProdHighlight();

    // 列宽拖拽
    setTimeout(function() {
        try {
            initProdColumnResize();
        } catch (e) {
            console.warn('生产管理列宽拖拽初始化失败:', e);
        }
    }, 100);

    console.log('✅ renderProduction 完成，渲染了 ' + list.length + ' 条生产单');
}

function resetProdFilters() {
    document.getElementById('prodFilterKeyword').value = '';
    document.getElementById('prodFilterStage').value = '';
    document.querySelectorAll('.filter-row select').forEach(sel => { sel.value = ''; });
    renderProduction();
}

// ============================================================
//  全选 / 行高亮 / 底色
// ============================================================

function toggleAllProdRows() {
    const checkboxes = document.querySelectorAll('.prod-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
    const headerCheckbox = document.getElementById('selectAllProd');
    if (headerCheckbox) {
        headerCheckbox.checked = !allChecked;
    }
}

function selectProdRow(tr, prodId) {
    if (currentProdHighlightRow && currentProdHighlightRow !== tr) {
        const oldTds = currentProdHighlightRow.querySelectorAll('td');
        oldTds.forEach(td => {
            const orig = td._origBg;
            if (orig) td.style.backgroundColor = orig;
        });
        currentProdHighlightRow.style.backgroundColor = '';
        currentProdHighlightRow = null;
        selectedProductionRowId = null;
    }
    if (selectedProductionRowId === prodId) {
        const tds2 = tr.querySelectorAll('td');
        tds2.forEach(td => {
            const orig = td._origBg;
            if (orig) td.style.backgroundColor = orig;
        });
        tr.style.backgroundColor = '';
        selectedProductionRowId = null;
        currentProdHighlightRow = null;
        return;
    }
    const tds = tr.querySelectorAll('td');
    tds.forEach(td => {
        const bg = td.style.backgroundColor || getComputedStyle(td).backgroundColor;
        td._origBg = bg;
        td.style.backgroundColor = '#d0e4ff';
    });
    tr.style.backgroundColor = '#d0e4ff';
    selectedProductionRowId = prodId;
    currentProdHighlightRow = tr;
}

function restoreProdHighlight() {
    if (!selectedProductionRowId) return;
    const tr = document.querySelector(`tr[data-prod-id="${selectedProductionRowId}"]`);
    if (tr) {
        tr.style.backgroundColor = '#d0e4ff';
        tr.querySelectorAll('td').forEach(td => {
            td.style.backgroundColor = '#d0e4ff';
        });
        currentProdHighlightRow = tr;
    }
}

function applyProdHighlight(color) {
    if (!productionHighlight) {
        alert('高亮功能尚未初始化，请刷新页面后重试');
        return;
    }
    productionHighlight.apply(color);
}
function clearProdHighlight() {
    if (!productionHighlight) {
        alert('高亮功能尚未初始化，请刷新页面后重试');
        return;
    }
    const checkedBoxes = document.querySelectorAll('.prod-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert('请先勾选需要清除底色的生产单');
        return;
    }
    productionHighlight.clear();
}

// ============================================================
//  导出选中生产单
// ============================================================

function exportSelectedProduction() {
    if (typeof XLSX === 'undefined') {
        alert('Excel 库未加载，请刷新页面后重试。');
        return;
    }
    const checkedBoxes = document.querySelectorAll('.prod-checkbox:checked');
    const selectedIds = [];
    checkedBoxes.forEach(cb => {
        const id = parseInt(cb.dataset.prodId);
        if (!isNaN(id)) selectedIds.push(id);
    });
    if (selectedIds.length === 0) {
        alert('请先勾选需要导出的生产单');
        return;
    }
    const selectedProd = data.productions.filter(p => selectedIds.indexOf(p.id) !== -1);
    if (selectedProd.length === 0) {
        alert('没有可导出的数据');
        return;
    }
    const exportData = selectedProd.map(p => {
        const order = getOrder(p.orderId);
        return {
            '生产单号': 'PRD-' + String(p.id).padStart(4, '0'),
            '当前阶段': p.stage || '',
            '关联订单': order ? order.orderNo : '',
            '客户号': order ? order.customerCode : '',
            '产品名称': order ? order.productName : '',
            '规格型号': order ? order.spec : '',
            '颜色': order ? order.color : '',
            '压唛': order ? order.stamp : '',
            '计划数量': p.planQty || 0,
            '合格数量': p.qualifiedQty || 0,
            '状态': order ? order.status : '',
            '开始日期': p.startDate || '',
            '结束日期': p.endDate || '',
            '备注': p.remark || ''
        };
    });
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        const colWidths = Object.keys(exportData[0] || {}).map(key => ({ wch: Math.max(key.length * 2, 12) }));
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, '生产单');
        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `生产单导出_选中_${dateStr}.xlsx`;
        XLSX.writeFile(wb, fileName);
        alert(`✅ 成功导出 ${exportData.length} 条生产单数据！`);
    } catch (err) {
        alert('导出失败：' + err.message);
    }
}

// ============================================================
//  生产详情 CRUD（修复版）
// ============================================================

function openProductionDetail(prodId) {
    const prod = data.productions.find(p => p.id === prodId);
    if (!prod) { alert('生产单不存在'); return; }
    const order = getOrder(prod.orderId);
    if (!order) { alert('关联订单不存在'); return; }
    document.getElementById('prodDetailId').value = prod.id;
    document.getElementById('prodDetailNo').value = 'PRD-' + String(prod.id).padStart(4, '0');
    document.getElementById('prodDetailOrderNo').value = order.orderNo;
    document.getElementById('prodDetailProduct').value = order.productName;
    document.getElementById('prodDetailPlanQty').value = prod.planQty || 0;
    document.getElementById('prodDetailQualified').value = prod.qualifiedQty || 0;
    document.getElementById('prodDetailStage').value = prod.stage || '开料';
    document.getElementById('prodDetailStatus').value = order.status;
    document.getElementById('prodDetailRemark').value = prod.remark || '';
    new bootstrap.Modal(document.getElementById('productionDetailModal')).show();
}

// ★★★ 辅助函数：更新订单状态（使用订单号） ★★★
async function saveOrderStatus(order) {
    // ★★★ 兼容字段名：如果 orderNo 不存在，尝试从 order_no 读取 ★★★
    if (!order) {
        console.warn('⚠️ saveOrderStatus: order 为空');
        return;
    }
    if (!order.orderNo && order.order_no) {
        order.orderNo = order.order_no;
    }
    if (!order.orderNo) {
        console.warn('⚠️ saveOrderStatus: 无法获取订单号', order);
        return;
    }
    
    const extraData = {
        spec: order.spec || '',
        color: order.color || '',
        stamp: order.stamp || '',
        materialBoard: order.materialBoard || '',
        materialShell: order.materialShell || '',
        boardCode: order.boardCode || '',
        shellStock: order.shellStock || '',
        partyName: order.partyName || '',
        partyAddress: order.partyAddress || '',
        partyContact: order.partyContact || '',
        partyFormNo: order.partyFormNo || '',
        syncToPurchase: order.syncToPurchase !== false,
        progress: order.progress || 0,
        qualityStatus: order.qualityStatus || '未质检',
        shipmentStatus: order.shipmentStatus || '待出货',
        source: order.source || 'production',
        outsourceStatus: order.outsourceStatus || '',
        outsourceLocation: order.outsourceLocation || '',
        customFields: order.customFields || {},
        deliveryHistory: order.deliveryHistory || [],
        deliveredQty: order.deliveredQty || 0,
        remainingQty: order.remainingQty || order.qty || 0,
        shipmentSchedule: order.shipmentSchedule || '',
        purchase: order.purchase || { orders: [], remark: '' }
    };

    const updateData = {
        order_no: order.orderNo,
        customer_code: order.customerCode,
        product_code: order.productCode,
        product_name: order.productName,
        qty: order.qty || 0,
        order_date: order.orderDate || '',
        delivery_date: order.deliveryDate || '',
        remark: order.remark || '',
        status: order.status || '待生产',
        extra: JSON.stringify(extraData)
    };

    // ★★★ 使用订单号更新（避免 ID 不同步） ★★★
    const url = '/api/orders/by-order/' + encodeURIComponent(order.orderNo);
    console.log('📤 saveOrderStatus 请求 URL:', url);

    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (!res.ok) {
            let errMsg = '更新订单状态失败（状态码: ' + res.status + '）';
            try {
                const errData = await res.json();
                if (errData && errData.message) errMsg = errData.message;
            } catch (e) {
                const text = await res.text();
                errMsg = text || errMsg;
            }
            throw new Error(errMsg);
        }
        
        const updated = await res.json();
        console.log('✅ saveOrderStatus 成功:', updated);
        
        const parsed = typeof window.parseExtraFields === 'function' ? window.parseExtraFields(updated) : updated;
        const idx = data.orders.findIndex(o => o.orderNo === order.orderNo);
        if (idx !== -1) {
            data.orders[idx] = parsed;
            Object.assign(order, parsed);
        }
        return parsed;
    } catch (error) {
        console.error('❌ saveOrderStatus 失败:', error);
        throw error;
    }
}

// ★★★ 保存生产单详情（修复版） ★★★
async function saveProductionDetail() {
    const id = parseInt(document.getElementById('prodDetailId').value);
    const prod = data.productions.find(p => p.id === id);
    if (!prod) { alert('生产单不存在'); return; }
    
    const qualified = parseInt(document.getElementById('prodDetailQualified').value) || 0;
    const stage = document.getElementById('prodDetailStage').value;
    const remark = document.getElementById('prodDetailRemark').value.trim();

    // 构建更新数据
    const updateData = {
        order_id: prod.orderId,
        order_no: prod.orderNo,
        product_name: prod.productName,
        plan_qty: prod.planQty,
        qualified_qty: qualified,
        stage: stage,
        status: '生产中',
        start_date: prod.startDate || '',
        end_date: prod.endDate || '',
        remark: remark
    };

    try {
        showToast('⏳ 正在保存生产单...', 'info');
        const updated = await apiUpdateProduction(id, updateData);
        
        // 更新本地数据
        const index = data.productions.findIndex(p => p.id === id);
        if (index !== -1) {
            data.productions[index] = {
                ...prod,
                qualifiedQty: updated.qualified_qty,
                stage: updated.stage,
                remark: updated.remark
            };
        }

        // ★★★ 同步更新订单状态 ★★★
        const order = getOrder(prod.orderId);
        if (order) {
            // 根据阶段更新订单状态
            if (stage === '已完成-待送货') {
                order.status = '已完成-待送货';
            } else if (stage === '已完成') {
                order.status = '已完成';
            } else if (stage === '包装待送货') {
                order.status = '待出货';
            } else {
                order.status = '生产中';
            }
            
            if (!order.qualityStatus || order.qualityStatus === '未质检') {
                order.qualityStatus = '质检中';
            }
            if (order.qualityStatus === '质检未通过-返单(生产)') {
                order.qualityStatus = '生产中';
            }

            // ★★★ 确保 source 被设置 ★★★
            order.source = 'production';

            try {
                await saveOrderStatus(order);
            } catch (orderError) {
                console.warn('⚠️ 订单状态更新失败，但生产单已保存:', orderError);
                // 不抛出错误，继续执行
            }
        }

        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }
        
        // 关闭模态框
        const modalEl = document.getElementById('productionDetailModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }
        
        // 刷新生产列表
        renderProduction();
        showToast('✅ 生产单已保存', 'success');
        
    } catch (error) {
        console.error('保存生产单错误:', error);
        // 即使出错，也尝试刷新页面数据
        try {
            const res = await fetch('/api/productions');
            if (res.ok) {
                const prods = await res.json();
                data.productions = prods.map(p => ({
                    id: p.id,
                    orderId: p.order_id,
                    orderNo: p.order_no,
                    productName: p.product_name,
                    planQty: p.plan_qty,
                    qualifiedQty: p.qualified_qty,
                    stage: p.stage,
                    status: p.status,
                    startDate: p.start_date,
                    endDate: p.end_date,
                    remark: p.remark
                }));
                renderProduction();
            }
        } catch (e) { /* 忽略 */ }
        showToast('❌ 保存失败: ' + error.message, 'error');
    }
}

async function deleteProduction(prodId) {
    if (!confirm('确认删除此生产单？')) return;
    try {
        await apiDeleteProduction(prodId);
        data.productions = data.productions.filter(p => p.id !== prodId);
        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }
        renderProduction();
        showToast('✅ 生产单已删除', 'success');
    } catch (error) {
        showToast('❌ 删除失败: ' + error.message, 'error');
        console.error(error);
    }
}

// ★★★ 清空生产单 ★★★
async function clearAllProductions() {
    if (!confirm('确定要清空所有生产单数据吗？此操作不可恢复！')) return;
    try {
        for (const p of data.productions) {
            await apiDeleteProduction(p.id);
        }
        data.productions = [];
        // 将关联订单状态恢复为待生产
        for (const o of data.orders) {
            if (o.status === '生产中' || o.status === '待质检' || o.status === '质检中') {
                o.status = '待生产';
                try {
                    await saveOrderStatus(o);
                } catch (e) {
                    // 忽略单个订单更新失败
                }
            }
        }
        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }
        renderProduction();
        const modal = bootstrap.Modal.getInstance(document.getElementById('prodColumnSettingsModal'));
        if (modal) modal.hide();
        showToast('✅ 所有生产单已清空', 'success');
    } catch (error) {
        showToast('❌ 清空失败: ' + error.message, 'error');
        console.error(error);
    }
}

// ============================================================
//  导出生产单（按月份）
// ============================================================

function exportProductionToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Excel 库未加载，请刷新页面后重试。');
        return;
    }
    const monthVal = document.getElementById('prodExportMonthPicker')?.value || '';
    let list = data.productions.filter(p => {
        const order = getOrder(p.orderId);
        if (!order) return false;
        let matchMonth = true;
        if (monthVal) {
            const [year, month] = monthVal.split('-').map(Number);
            if (!order.orderDate) { matchMonth = false; } else {
                const parts = order.orderDate.split('-');
                if (parts.length < 2) { matchMonth = false; } else {
                    const orderYear = parseInt(parts[0]);
                    const orderMonth = parseInt(parts[1]);
                    if (orderYear !== year || orderMonth !== month) matchMonth = false;
                }
            }
        }
        return matchMonth;
    });
    if (list.length === 0) { alert('没有生产数据可导出（请检查月份筛选）'); return; }
    const exportData = list.map(p => {
        const order = getOrder(p.orderId);
        return {
            '生产单号': 'PRD-' + String(p.id).padStart(4, '0'),
            '当前阶段': p.stage || '',
            '关联订单': order ? order.orderNo : '',
            '客户号': order ? order.customerCode : '',
            '产品名称': order ? order.productName : '',
            '规格型号': order ? order.spec : '',
            '颜色': order ? order.color : '',
            '压唛': order ? order.stamp : '',
            '计划数量': p.planQty || 0,
            '合格数量': p.qualifiedQty || 0,
            '状态': order ? order.status : '',
            '开始日期': p.startDate || '',
            '结束日期': p.endDate || '',
            '备注': p.remark || ''
        };
    });
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        const colWidths = Object.keys(exportData[0] || {}).map(key => ({ wch: Math.max(key.length * 2, 12) }));
        ws['!cols'] = colWidths;
        const dateStr = new Date().toISOString().slice(0, 10);
        const monthLabel = monthVal ? monthVal.replace('-', '年') + '月' : '全部';
        const fileName = `生产单导出_${monthLabel}_${dateStr}.xlsx`;
        XLSX.writeFile(wb, fileName);
        alert(`✅ 成功导出 ${exportData.length} 条生产单数据！`);
    } catch (err) { alert('导出失败：' + err.message); }
}

// ============================================================
//  ★★★ 修复：pushToProduction（从订单管理调用） ★★★
// ============================================================
function prodPushToProduction() {
    var id = parseInt(document.getElementById('detailOrderId').value);
    var order = data.orders.find(function(o) { return o.id === id; });
    if (!order) { alert('订单不存在'); return; }
    
    // 检查是否已推送
    if (data.productions.find(function(p) { return p.orderId === order.id; })) {
        alert('该订单已推送到生产管理');
        return;
    }
    if (order.status === '已完成') { alert('订单已完成，无法推送'); return; }

    // ★★★ 关键修复：先从后端获取最新订单数据，确保 ID 正确 ★★★
    fetch('/api/orders/by-order/' + encodeURIComponent(order.orderNo))
        .then(function(res) {
            if (!res.ok) throw new Error('获取订单失败，请刷新页面');
            return res.json();
        })
        .then(function(latestOrder) {
            // 使用后端返回的订单 ID
            var newProd = {
                order_id: latestOrder.id,  // ★★★ 使用后端 ID ★★★
                order_no: latestOrder.order_no,
                product_name: latestOrder.product_name,
                plan_qty: latestOrder.qty,
                qualified_qty: 0,
                stage: '开料',
                status: '生产中',
                start_date: new Date().toISOString().slice(0, 10),
                end_date: latestOrder.delivery_date || '',
                remark: ''
            };

            return fetch('/api/productions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProd)
            });
        })
        .then(function(response) {
            if (!response.ok) throw new Error('推送生产单失败');
            return response.json();
        })
        .then(function(created) {
            // 更新本地订单数据
            var orderLocal = data.orders.find(function(o) { return o.orderNo === order.orderNo; });
            if (orderLocal) {
                orderLocal.status = '生产中';
                orderLocal.source = 'production';
                // 同步更新 extra 中的状态
                if (typeof window.saveOrderStatus === 'function') {
                    window.saveOrderStatus(orderLocal).catch(function(e) {
                        console.warn('订单状态更新失败:', e);
                    });
                }
            }
            // 添加生产单到本地
            data.productions.push({
                id: created.id,
                orderId: created.order_id,
                orderNo: created.order_no,
                productName: created.product_name,
                planQty: created.plan_qty,
                qualifiedQty: created.qualified_qty,
                stage: created.stage,
                status: created.status,
                startDate: created.start_date,
                endDate: created.end_date,
                remark: created.remark
            });
            if (typeof window.saveDataToStorage === 'function') {
                window.saveDataToStorage();
            }
            closeModal('orderDetailModal');
            if (typeof window.renderAll === 'function') window.renderAll();
            if (typeof window.switchPage === 'function') window.switchPage('production');
            showToast('✅ 已推送到生产管理', 'success');
        })
        .catch(function(error) {
            showToast('❌ 推送失败: ' + error.message, 'error');
            console.error(error);
        });
}

// ============================================================
//  初始化
// ============================================================

function initProduction() {
    console.log('🔄 生产管理初始化...');

    async function loadProductions() {
        try {
            console.log('📡 正在从服务器加载生产数据...');
            const res = await fetch('/api/productions');
            if (res.ok) {
                const prods = await res.json();
                console.log('✅ 从服务器加载了 ' + prods.length + ' 条生产数据');
                data.productions = prods.map(p => ({
                    id: p.id,
                    orderId: p.order_id,
                    orderNo: p.order_no,
                    productName: p.product_name,
                    planQty: p.plan_qty,
                    qualifiedQty: p.qualified_qty,
                    stage: p.stage || '开料',
                    status: p.status || '生产中',
                    startDate: p.start_date || '',
                    endDate: p.end_date || '',
                    remark: p.remark || ''
                }));
                if (typeof window.saveDataToStorage === 'function') {
                    window.saveDataToStorage();
                }
                renderProduction();
            } else {
                console.warn('⚠️ 生产API返回失败，使用本地数据');
                renderProduction();
            }
        } catch (e) {
            console.warn('⚠️ 加载生产数据失败，使用本地数据', e);
            renderProduction();
        }
    }

    loadProductions();

    const filterKeyword = document.getElementById('prodFilterKeyword');
    if (filterKeyword) {
        filterKeyword.addEventListener('input', renderProduction);
    }
    const filterStage = document.getElementById('prodFilterStage');
    if (filterStage) {
        filterStage.addEventListener('change', renderProduction);
    }

    document.querySelectorAll('#prodThead .filter-row select').forEach(function(sel) {
        sel.addEventListener('change', renderProduction);
    });

    console.log('✅ 生产管理初始化完成');
}

// ============================================================
//  暴露全局
// ============================================================

window.initProduction = initProduction;
window.renderProduction = renderProduction;
window.resetProdFilters = resetProdFilters;
window.openProductionDetail = openProductionDetail;
window.saveProductionDetail = saveProductionDetail;
window.deleteProduction = deleteProduction;
window.clearAllProductions = clearAllProductions;
window.exportProductionToExcel = exportProductionToExcel;
window.exportSelectedProduction = exportSelectedProduction;
window.openProdColumnSettings = openProdColumnSettings;
window.updateProdColumnVisibility = updateProdColumnVisibility;
window.toggleProdAllColumns = toggleProdAllColumns;
window.resetProdColumns = resetProdColumns;
window.moveProdColumnUp = moveProdColumnUp;
window.moveProdColumnDown = moveProdColumnDown;
window.toggleAllProdRows = toggleAllProdRows;
window.selectProdRow = selectProdRow;
window.applyProdHighlight = applyProdHighlight;
window.clearProdHighlight = clearProdHighlight;
window.productionHighlight = productionHighlight;
window.saveOrderStatus = saveOrderStatus;
window.prodPushToProduction = prodPushToProduction;

console.log('✅ production.js 已加载（服务器存储版本，已修复推送ID问题）');