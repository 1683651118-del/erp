// ============================================================
//  订单管理模块（完整版 · 服务器存储）
//  包含：列表渲染、列设置、导出、详情、回退、推送、批量操作、Excel导入、粘贴解析等全部功能
// ============================================================

// ★★★ 确保 showToast 存在（后备方案） ★★★
if (typeof showToast === 'undefined') {
    window.showToast = function(message, type) {
        console.log('📢 [Toast]', type, message);
        alert(message);
    };
    console.warn('⚠️ showToast 未加载，已使用备用 alert 替代');
}

const COLUMN_WIDTHS_KEY = 'erp_order_column_widths';
const ORDER_COLUMN_ORDER_KEY = 'erp_order_column_order';

// ============================================================
//  ★★★ 状态颜色映射（确保生产中为橙色） ★★★
// ============================================================

function statusBadge(status) {
    var map = {
        '待生产': 'bg-soft-secondary',
        '生产中': 'bg-soft-warning',
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
        '待外发': 'bg-soft-info',
        '外发中': 'bg-soft-purple',
        '已完成-待出货': 'bg-soft-success',
        '合格': 'bg-soft-success',
        '不合格': 'bg-soft-danger',
        '待对账': 'bg-soft-warning',
        '已对账': 'bg-soft-primary',
        '已结清': 'bg-soft-success',
        '开料': 'bg-soft-secondary',
        '压板材': 'bg-soft-warning',
        '出成品': 'bg-soft-primary',
        '包装待送货': 'bg-soft-success'
    };
    return map[status] || 'bg-soft-secondary';
}

// ============================================================
//  订单管理模块 - 高亮管理器
// ============================================================

const orderHighlight = new HighlightManager('order', {
    getSelectedIds: function() {
        const ids = [];
        document.querySelectorAll('.order-checkbox:checked').forEach(cb => {
            const id = parseInt(cb.dataset.orderId);
            if (!isNaN(id)) ids.push(String(id));
        });
        return ids;
    },
    renderCallback: renderOrders,
    idAttribute: 'data-order-id'
});

// ============================================================
//  全局变量（高亮、单击行高亮）
// ============================================================

var selectedOrderRowId = null;
var currentHighlightRow = null;

// ============================================================
//  工具函数
// ============================================================

function getCustomerShortName(fullName) {
    if (!fullName) return '';
    var nameMap = { '元谱': '元谱', '杰德仕': '杰德仕', '旺米': '旺米' };
    for (var key in nameMap) {
        if (fullName.includes(key)) return nameMap[key];
    }
    var short = fullName.replace(/^东莞市/, '').replace(/(科技|数码|电子)有限公司$/, '').replace(/有限公司$/, '').replace(/公司$/, '');
    return short || fullName.substring(0, 2);
}

function getOrderColumnOrder() {
    try {
        var stored = localStorage.getItem(ORDER_COLUMN_ORDER_KEY);
        if (stored) {
            var order = JSON.parse(stored);
            var allKeys = baseColumns.map(function(c) { return c.key; });
            var missingKeys = allKeys.filter(function(k) { return order.indexOf(k) === -1; });
            if (missingKeys.length > 0) {
                var newOrder = order.concat(missingKeys);
                saveOrderColumnOrder(newOrder);
                return newOrder;
            }
            return order;
        }
    } catch (e) { /* 忽略 */ }
    return baseColumns.map(function(c) { return c.key; });
}

function saveOrderColumnOrder(orderArray) {
    localStorage.setItem(ORDER_COLUMN_ORDER_KEY, JSON.stringify(orderArray));
}

function getColumnWidths() {
    try {
        var stored = localStorage.getItem(COLUMN_WIDTHS_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) { return {}; }
}

function saveColumnWidth(colKey, width) {
    var widths = getColumnWidths();
    widths[colKey] = width;
    localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
}

function getColumnWidth(colKey, defaultWidth) {
    var widths = getColumnWidths();
    return widths[colKey] || defaultWidth;
}

function extractCustomerCodeFromProductCode(productCode) {
    if (!productCode) return '';
    var parts = productCode.split('-');
    if (parts.length >= 3) {
        if (parts.length === 4) return parts[2] || '';
        if (parts.length === 3) return parts[1] || '';
        return parts[parts.length - 2] || '';
    }
    return '';
}

// ============================================================
//  订单列表渲染（核心）
// ============================================================

function renderOrders() {
    console.log('🔄 执行完整版 renderOrders...');
    
    // 获取搜索关键词
    var filterKeyword = document.getElementById('filterKeyword')?.value?.toLowerCase() || '';
    
    // 获取列筛选（如果有）
    var filterSelects = document.querySelectorAll('.filter-row select');
    var colFilters = {};
    filterSelects.forEach(function(sel) {
        var col = sel.dataset.col;
        if (col && sel.value) colFilters[col] = sel.value;
    });

    // 筛选订单
    var list = data.orders.filter(function(o) {
        var matchKeyword = true;
        if (filterKeyword) {
            var searchText = (o.orderNo || o.order_no || '') + ' ' +
                             (o.productName || o.product_name || '') + ' ' +
                             (o.customerCode || o.customer_code || '') + ' ' +
                             (o.productCode || o.product_code || '');
            matchKeyword = searchText.toLowerCase().includes(filterKeyword);
        }
        // 列筛选
        var matchCols = true;
        for (var col in colFilters) {
            var val = colFilters[col];
            if (!val) continue;
            var cellVal = '';
            switch (col) {
                case 'status': cellVal = o.status || ''; break;
                case 'customerCode': cellVal = o.customerCode || o.customer_code || ''; break;
                case 'orderNo': cellVal = o.orderNo || o.order_no || ''; break;
                case 'productCode': cellVal = o.productCode || o.product_code || ''; break;
                case 'productName': cellVal = o.productName || o.product_name || ''; break;
                case 'spec': cellVal = o.spec || ''; break;
                case 'color': cellVal = o.color || ''; break;
                case 'stamp': cellVal = o.stamp || ''; break;
                case 'qty': cellVal = String(o.qty || 0); break;
                case 'materialBoard': cellVal = o.materialBoard || ''; break;
                case 'materialShell': cellVal = o.materialShell || ''; break;
                case 'orderDate': cellVal = o.orderDate || ''; break;
                case 'deliveryDate': cellVal = o.deliveryDate || ''; break;
                case 'boardCode': cellVal = o.boardCode || ''; break;
                case 'shellStock': cellVal = o.shellStock || ''; break;
                case 'progress': cellVal = String(o.progress || 0); break;
                case 'qualityStatus': cellVal = o.qualityStatus || ''; break;
                case 'shipmentSchedule': cellVal = o.shipmentSchedule || ''; break;
                case 'partyName': cellVal = getCustomerShortName(o.partyName || ''); break;
                case 'partyContact': cellVal = o.partyContact || ''; break;
                case 'remark': cellVal = o.remark || ''; break;
                default: break;
            }
            if (cellVal !== val) { matchCols = false; break; }
        }
        return matchKeyword && matchCols;
    });

    // 获取列配置（列顺序与可见性）
    var colOrder = getOrderColumnOrder();
    var orderedColumns = [];
    colOrder.forEach(function(key) {
        var col = baseColumns.find(function(c) { return c.key === key; });
        if (col) orderedColumns.push(col);
    });
    baseColumns.forEach(function(col) {
        if (!orderedColumns.some(function(c) { return c.key === col.key; })) {
            orderedColumns.push(col);
        }
    });
    // 过滤隐藏列
    var dataCols = orderedColumns.filter(function(col) {
        return orderColumnsVisible[col.key] !== false;
    });
    // 确保操作列显示
    if (!dataCols.some(function(c) { return c.key === 'actions'; })) {
        var actionsCol = baseColumns.find(function(c) { return c.key === 'actions'; });
        if (actionsCol) dataCols.push(actionsCol);
    }

    // 默认列宽
    var defaultWidths = {
        'checkbox': 50,
        'status': 140,
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

    // 生成表头
    var thead = document.getElementById('ordersThead');
    if (!thead) {
        console.error('❌ 找不到 ordersThead');
        return;
    }
    var headerHtml = '<tr>';
    headerHtml += '<th data-col="checkbox" style="width:50px;min-width:50px;max-width:50px;text-align:center;position:sticky;left:0;z-index:25;background:#fafbfc;border-right:1px solid #e9edf2;">';
    headerHtml += '<input type="checkbox" id="selectAllOrders" onchange="toggleAllOrdersRows()" style="width:18px;height:18px;cursor:pointer;accent-color:#0066cc;">';
    headerHtml += '</th>';
    dataCols.forEach(function(col) {
        var isSticky = (col.key === 'remark' || col.key === 'actions' || col.key === 'partyName' || col.key === 'partyContact');
        var stickyClass = isSticky ? 'sticky-col' : '';
        var remarkClass = col.key === 'remark' ? 'sticky-col-remark' : '';
        var actionsClass = col.key === 'actions' ? 'sticky-col-actions' : '';
        var width = getColumnWidth(col.key) || defaultWidths[col.key] || 120;
        if (col.key === 'actions') {
            headerHtml += '<th data-col="' + col.key + '" class="' + stickyClass + ' ' + remarkClass + ' ' + actionsClass + '" style="width:' + width + 'px;min-width:' + width + 'px;">' + col.label + '</th>';
        } else {
            headerHtml += '<th data-col="' + col.key + '" class="' + stickyClass + ' ' + remarkClass + ' ' + actionsClass + '" style="position:relative;width:' + width + 'px;min-width:' + width + 'px;">' + col.label + '</th>';
        }
    });
    headerHtml += '</tr>';

    // 筛选行（下拉列表）
    headerHtml += '<tr class="filter-row">';
    headerHtml += '<th style="width:50px;min-width:50px;max-width:50px;position:sticky;left:0;z-index:20;background:#f8fafc;border-right:1px solid #e9edf2;"></th>';
    dataCols.forEach(function(col) {
        if (col.key === 'actions') {
            headerHtml += '<th></th>';
            return;
        }
        var options = new Set();
        data.orders.forEach(function(o) {
            var val = '';
            switch (col.key) {
                case 'status': val = o.status || ''; break;
                case 'customerCode': val = o.customerCode || o.customer_code || ''; break;
                case 'orderNo': val = o.orderNo || o.order_no || ''; break;
                case 'productCode': val = o.productCode || o.product_code || ''; break;
                case 'productName': val = o.productName || o.product_name || ''; break;
                case 'spec': val = o.spec || ''; break;
                case 'color': val = o.color || ''; break;
                case 'stamp': val = o.stamp || ''; break;
                case 'qty': val = String(o.qty || 0); break;
                case 'materialBoard': val = o.materialBoard || ''; break;
                case 'materialShell': val = o.materialShell || ''; break;
                case 'orderDate': val = o.orderDate || ''; break;
                case 'deliveryDate': val = o.deliveryDate || ''; break;
                case 'boardCode': val = o.boardCode || ''; break;
                case 'shellStock': val = o.shellStock || ''; break;
                case 'progress': val = String(o.progress || 0); break;
                case 'qualityStatus': val = o.qualityStatus || ''; break;
                case 'shipmentSchedule': val = o.shipmentSchedule || ''; break;
                case 'partyName': val = getCustomerShortName(o.partyName || ''); break;
                case 'partyContact': val = o.partyContact || ''; break;
                case 'remark': val = o.remark || ''; break;
                default: break;
            }
            if (val) options.add(val);
        });
        var sortedOptions = Array.from(options).sort();
        var selectHtml = '<select data-col="' + col.key + '" class="form-select form-select-sm" style="font-size:12px;border:1px solid #e2e8f0;border-radius:4px;padding:2px 4px;background:#fff;" onchange="renderOrders()"><option value="">全部</option>';
        sortedOptions.forEach(function(opt) {
            selectHtml += '<option value="' + opt + '">' + opt + '</option>';
        });
        selectHtml += '</select>';
        headerHtml += '<th>' + selectHtml + '</th>';
    });
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    // 表格体
    var tbody = document.getElementById('ordersBody');
    if (!tbody) {
        console.error('❌ 找不到 ordersBody');
        return;
    }
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="' + (dataCols.length + 1) + '" class="text-center text-muted">暂无匹配订单</td></tr>';
        return;
    }

    var rowsHtml = '';
    list.forEach(function(o) {
        // 获取底色（如果有高亮）
        var highlightColor = orderHighlight ? orderHighlight.getColor(String(o.id)) : '';
        var rowBg = highlightColor || '';

        rowsHtml += '<tr data-order-id="' + o.id + '" onclick="selectOrderRow(this, ' + o.id + ')" ondblclick="openOrderDetail(' + o.id + ')" style="cursor:pointer;">';

        // 复选框
        rowsHtml += '<td style="text-align:center;width:50px;min-width:50px;max-width:50px;position:sticky;left:0;z-index:5;background:' + rowBg + ';border-right:1px solid #e9edf2;">';
        rowsHtml += '<input type="checkbox" class="order-checkbox" data-order-id="' + o.id + '" onclick="event.stopPropagation();" style="width:18px;height:18px;cursor:pointer;accent-color:#0066cc;">';
        rowsHtml += '</td>';

        // 数据列
        dataCols.forEach(function(col) {
            if (col.key === 'actions') {
                rowsHtml += '<td class="sticky-col sticky-col-actions" style="min-width:160px;width:160px;overflow:visible;text-overflow:clip;white-space:nowrap;background:' + rowBg + ';position:sticky;right:0;z-index:5;box-shadow:-2px 0 6px rgba(0,0,0,0.06);">';
                rowsHtml += '<button class="btn btn-sm btn-outline-custom" onclick="event.stopPropagation(); openOrderDetail(' + o.id + ')" title="编辑"><i class="bi bi-pencil"></i> 编辑</button>';
                rowsHtml += '<button class="btn btn-sm btn-outline-custom text-danger" onclick="event.stopPropagation(); if(confirm(\'确认删除此订单？\')) deleteOrder(' + o.id + ')" title="删除"><i class="bi bi-trash3"></i> 删除</button>';
                rowsHtml += '</td>';
                return;
            }

            var val = '';
            var extraClass = '';
            if (col.key === 'productName' || col.key === 'spec' || col.key === 'partyName' || col.key === 'partyContact' || col.key === 'remark') {
                extraClass = 'wrap-cell';
            }
            if (col.key === 'productName') extraClass += ' product-name';
            if (col.key === 'spec') extraClass += ' spec-cell';

            var isSticky = (col.key === 'remark' || col.key === 'actions' || col.key === 'partyName' || col.key === 'partyContact');
            var stickyClass = isSticky ? 'sticky-col' : '';
            var remarkClass = col.key === 'remark' ? 'sticky-col-remark' : '';
            var actionsClass = col.key === 'actions' ? 'sticky-col-actions' : '';

            var width = getColumnWidth(col.key) || defaultWidths[col.key] || 120;

            switch (col.key) {
                case 'status':
                    var statusColor = '#6c757d';
                    if (o.status && o.status.indexOf('生产中') !== -1) statusColor = '#f39c12';
                    else if (o.status && o.status.indexOf('待外发') !== -1) statusColor = '#17a2b8';
                    else if (o.status && o.status.indexOf('外发中') !== -1) statusColor = '#6f42c1';
                    else if (o.status && o.status.indexOf('待出货') !== -1) statusColor = '#3498db';
                    else if (o.status && (o.status.indexOf('已完成') !== -1 || o.status.indexOf('已出货') !== -1)) statusColor = '#27ae60';
                    else if (o.status && (o.status.indexOf('返单') !== -1 || o.status.indexOf('不合格') !== -1)) statusColor = '#e74c3c';
                    val = '<span class="badge-status" style="background-color:' + statusColor + '!important;color:#fff!important;font-weight:600!important;border-radius:20px!important;padding:4px 12px!important;font-size:12px!important;display:inline-block!important;">' + (o.status || '待生产') + '</span>';
                    break;
                case 'customerCode': val = o.customerCode || o.customer_code || ''; break;
                case 'orderNo': val = o.orderNo || o.order_no || ''; break;
                case 'productCode': val = o.productCode || o.product_code || ''; break;
                case 'productName': val = o.productName || o.product_name || ''; break;
                case 'spec': val = o.spec || ''; break;
                case 'color': val = o.color || ''; break;
                case 'stamp': val = o.stamp || ''; break;
                case 'qty': val = o.qty || 0; break;
                case 'materialBoard': val = o.materialBoard || ''; break;
                case 'materialShell': val = o.materialShell || ''; break;
                case 'orderDate': val = o.orderDate || ''; break;
                case 'deliveryDate': val = o.deliveryDate || ''; break;
                case 'boardCode': val = o.boardCode || ''; break;
                case 'shellStock': val = o.shellStock || ''; break;
                case 'progress': val = o.progress || 0; break;
                case 'qualityStatus': val = o.qualityStatus || ''; break;
                case 'shipmentSchedule': val = o.shipmentSchedule || ''; break;
                case 'partyName': val = getCustomerShortName(o.partyName || ''); break;
                case 'partyContact': val = o.partyContact || ''; break;
                case 'remark': val = o.remark || ''; break;
                default: 
                    if (col.key.startsWith('custom_')) {
                        var cname = col.key.replace('custom_','');
                        val = o.customFields[cname] || '';
                    }
                    break;
            }

            rowsHtml += '<td class="' + stickyClass + ' ' + remarkClass + ' ' + actionsClass + ' ' + extraClass + '" style="width:' + width + 'px;min-width:' + width + 'px;background:' + rowBg + ';">' + val + '</td>';
        });

        rowsHtml += '</tr>';
    });

    tbody.innerHTML = rowsHtml;

    // 更新选中计数
    updateSelectedCount();

    // 列宽拖拽（延迟执行）
    setTimeout(function() {
        try {
            initColumnResize('ordersTable', 'erp_order_column_widths');
        } catch (e) {
            console.warn('列宽拖拽初始化失败:', e);
        }
    }, 100);
}

// ============================================================
//  重置筛选
// ============================================================

function resetFilters() {
    document.getElementById('filterKeyword').value = '';
    document.querySelectorAll('.filter-row select').forEach(function(sel) { sel.value = ''; });
    renderOrders();
}

// ============================================================
//  列设置
// ============================================================

function openOrderColumnSettings() {
    var content = document.getElementById('orderColumnSettingsContent');
    var order = getOrderColumnOrder();
    var html = '<div class="mb-2"><strong>调整列顺序（点击 ↑↓ 移动）</strong></div>';
    html += '<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="order_col_all" onchange="toggleOrderAllColumns(this.checked)"><label class="form-check-label" for="order_col_all">全选</label></div>';
    html += '<div id="orderColumnSortableList" class="list-group">';
    order.forEach(function(key) {
        if (key === 'actions') return;
        var col = baseColumns.find(function(c) { return c.key === key; });
        if (!col) return;
        var checked = orderColumnsVisible[col.key] !== false ? 'checked' : '';
        html += '<div class="list-group-item d-flex align-items-center justify-content-between" data-key="' + key + '" style="padding:6px 12px;">';
        html += '<div class="d-flex align-items-center gap-2"><input type="checkbox" class="form-check-input order-col-check" data-col="' + key + '" ' + checked + ' onchange="updateOrderColumnVisibility()"><span style="font-weight:500;">' + col.label + '</span></div>';
        html += '<div><button class="btn btn-sm btn-outline-secondary" onclick="moveOrderColumnUp(\'' + key + '\')" title="上移">↑</button><button class="btn btn-sm btn-outline-secondary" onclick="moveOrderColumnDown(\'' + key + '\')" title="下移">↓</button></div>';
        html += '</div>';
    });
    html += `
    <hr style="margin: 16px 0;">
    <div class="d-flex justify-content-between align-items-center">
        <span style="font-size: 13px; color: #dc3545; font-weight: 600;">⚠️ 危险操作：清空所有订单数据</span>
        <button class="btn btn-sm btn-outline-danger" onclick="clearAllOrders()">
            <i class="bi bi-trash3"></i> 一键清空
        </button>
    </div>
    <div style="font-size: 12px; color: #6c7a8a; margin-top: 4px;">
        此操作将删除所有订单、外发记录和生产记录，不可恢复！请先备份数据。
    </div>
`;
    html += '</div>';
    content.innerHTML = html;
    new bootstrap.Modal(document.getElementById('orderColumnSettingsModal')).show();
}

function refreshOrderColumnSettingsList() {
    var container = document.getElementById('orderColumnSortableList');
    if (!container) return;
    var order = getOrderColumnOrder();
    var html = '';
    order.forEach(function(key) {
        if (key === 'actions') return;
        var col = baseColumns.find(function(c) { return c.key === key; });
        if (!col) return;
        var checked = orderColumnsVisible[col.key] !== false ? 'checked' : '';
        html += '<div class="list-group-item d-flex align-items-center justify-content-between" data-key="' + key + '" style="padding:6px 12px;">';
        html += '<div class="d-flex align-items-center gap-2"><input type="checkbox" class="form-check-input order-col-check" data-col="' + key + '" ' + checked + ' onchange="updateOrderColumnVisibility()"><span style="font-weight:500;">' + col.label + '</span></div>';
        html += '<div><button class="btn btn-sm btn-outline-secondary" onclick="moveOrderColumnUp(\'' + key + '\')" title="上移">↑</button><button class="btn btn-sm btn-outline-secondary" onclick="moveOrderColumnDown(\'' + key + '\')" title="下移">↓</button></div>';
        html += '</div>';
    });
    container.innerHTML = html;
    var allCheckbox = document.getElementById('order_col_all');
    if (allCheckbox) {
        var items = document.querySelectorAll('.order-col-check');
        var checkedItems = document.querySelectorAll('.order-col-check:checked');
        allCheckbox.checked = items.length > 0 && checkedItems.length === items.length;
    }
}

function moveOrderColumnUp(key) {
    var order = getOrderColumnOrder();
    var idx = order.indexOf(key);
    if (idx <= 0) return;
    var temp = order[idx - 1];
    order[idx - 1] = order[idx];
    order[idx] = temp;
    saveOrderColumnOrder(order);
    refreshOrderColumnSettingsList();
    renderOrders();
}

function moveOrderColumnDown(key) {
    var order = getOrderColumnOrder();
    var idx = order.indexOf(key);
    if (idx === -1 || idx >= order.length - 1) return;
    var temp = order[idx + 1];
    order[idx + 1] = order[idx];
    order[idx] = temp;
    saveOrderColumnOrder(order);
    refreshOrderColumnSettingsList();
    renderOrders();
}

function updateOrderColumnVisibility() {
    document.querySelectorAll('.order-col-check').forEach(function(cb) {
        var col = cb.dataset.col;
        orderColumnsVisible[col] = cb.checked;
    });
    saveDataToStorage();
    renderOrders();
}

function toggleOrderAllColumns(checked) {
    document.querySelectorAll('.order-col-check').forEach(function(cb) {
        cb.checked = checked;
        var col = cb.dataset.col;
        orderColumnsVisible[col] = checked;
    });
    saveDataToStorage();
    renderOrders();
}

function resetOrderColumns() {
    if (!confirm('恢复所有列到默认顺序和可见性，列宽也将重置。确定？')) return;
    baseColumns.forEach(function(col) { if (col.key !== 'actions') orderColumnsVisible[col.key] = true; });
    var defaultOrder = baseColumns.map(function(c) { return c.key; });
    saveOrderColumnOrder(defaultOrder);
    localStorage.removeItem(COLUMN_WIDTHS_KEY);
    saveDataToStorage();
    renderOrders();
    refreshOrderColumnSettingsList();
    var modal = bootstrap.Modal.getInstance(document.getElementById('orderColumnSettingsModal'));
    if (modal) modal.hide();
    alert('✅ 列已恢复默认（顺序、可见性、宽度）');
}

// ============================================================
//  导出 Excel
// ============================================================

function exportOrdersToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Excel 库未加载，请检查网络或刷新页面后重试。');
        return;
    }
    var monthVal = document.getElementById('exportMonthPicker')?.value || '';
    var filterKeyword = document.getElementById('filterKeyword')?.value?.toLowerCase() || '';

    var filterSelects = document.querySelectorAll('.filter-row select');
    var colFilters = {};
    filterSelects.forEach(function(sel) {
        var col = sel.dataset.col;
        if (col && sel.value) colFilters[col] = sel.value;
    });

    var list = data.orders.filter(function(o) {
        var matchKeyword = true;
        if (filterKeyword) {
            var searchText = (o.orderNo || '') + ' ' + 
                             (o.productName || '') + ' ' + 
                             (o.customerCode || '') + ' ' + 
                             (o.productCode || '') + ' ' +
                             (o.partyName || '');
            matchKeyword = searchText.toLowerCase().includes(filterKeyword);
        }

        var matchCols = true;
        for (var col in colFilters) {
            var val = colFilters[col];
            if (!val) continue;
            var cellVal = '';
            switch (col) {
                case 'status': cellVal = o.status || ''; break;
                case 'customerCode': cellVal = o.customerCode || ''; break;
                case 'orderNo': cellVal = o.orderNo || ''; break;
                case 'productCode': cellVal = o.productCode || ''; break;
                case 'productName': cellVal = o.productName || ''; break;
                case 'spec': cellVal = o.spec || ''; break;
                case 'color': cellVal = o.color || ''; break;
                case 'stamp': cellVal = o.stamp || ''; break;
                case 'qty': cellVal = String(o.qty || ''); break;
                case 'materialBoard': cellVal = o.materialBoard || ''; break;
                case 'materialShell': cellVal = o.materialShell || ''; break;
                case 'orderDate': cellVal = o.orderDate || ''; break;
                case 'deliveryDate': cellVal = o.deliveryDate || ''; break;
                case 'boardCode': cellVal = o.boardCode || ''; break;
                case 'shellStock': cellVal = o.shellStock || ''; break;
                case 'progress': cellVal = String(o.progress || ''); break;
                case 'qualityStatus': cellVal = o.qualityStatus || ''; break;
                case 'shipmentSchedule': cellVal = o.shipmentSchedule || ''; break;
                case 'partyName': cellVal = getCustomerShortName(o.partyName || ''); break;
                case 'partyContact': cellVal = o.partyContact || ''; break;
                case 'remark': cellVal = o.remark || ''; break;
                default: 
                    if (col.startsWith('custom_')) {
                        var cname = col.replace('custom_','');
                        cellVal = o.customFields[cname] || '';
                    }
                    break;
            }
            if (cellVal !== val) { matchCols = false; break; }
        }
        var matchMonth = true;
        if (monthVal) {
            var parts2 = monthVal.split('-').map(Number);
            var year = parts2[0], month = parts2[1];
            if (!o.orderDate) { matchMonth = false; } else {
                var parts3 = o.orderDate.split('-');
                if (parts3.length < 2) { matchMonth = false; } else {
                    var orderYear = parseInt(parts3[0]);
                    var orderMonth = parseInt(parts3[1]);
                    if (orderYear !== year || orderMonth !== month) matchMonth = false;
                }
            }
        }
        return matchKeyword && matchCols && matchMonth;
    });

    if (list.length === 0) {
        alert('当前没有匹配的订单可导出（请检查筛选条件和月份）');
        return;
    }

    var headers = [
        '状态', '客户号', '订单号', '产品编号', '产品名称',
        '规格型号', '颜色', '压唛', '订单数量',
        '物料-板材', '物料-机壳', '下单日期', '交货日期',
        '板材编号', '壳子库存', '进度(%)', '质检状态',
        '送货安排', '客户名称', '联系人', '备注',
        '甲方地址', '表单编号', '外发状态', '外发位置',
        '来源', '订单状态'
    ];
    var customCols = data.customColumns || [];
    var detailCustom = detailCustomFields || [];
    customCols.forEach(function(col) { headers.push(col.name); });
    detailCustom.forEach(function(c) { headers.push(c.name); });

    var rows = list.map(function(o) {
        var row = [
            o.status || '',
            o.customerCode || '',
            o.orderNo || '',
            o.productCode || '',
            o.productName || '',
            o.spec || '',
            o.color || '',
            o.stamp || '',
            o.qty || 0,
            o.materialBoard || '',
            o.materialShell || '',
            o.orderDate || '',
            o.deliveryDate || '',
            o.boardCode || '',
            o.shellStock || '',
            o.progress || 0,
            o.qualityStatus || '',
            o.shipmentSchedule || '',
            getCustomerShortName(o.partyName || ''),
            o.partyContact || '',
            o.remark || '',
            o.partyAddress || '',
            o.partyFormNo || '',
            o.outsourceStatus || '',
            o.outsourceLocation || '',
            o.source || '',
            o.shipmentStatus || ''
        ];
        customCols.forEach(function(col) { row.push(o.customFields[col.name] || ''); });
        detailCustom.forEach(function(c) {
            var key = 'custom_' + c.name;
            row.push(o[key] || '');
        });
        return row;
    });

    var sheetData = [headers].concat(rows);
    try {
        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.aoa_to_sheet(sheetData);
        var colWidths = headers.map(function(h, i) {
            var maxLen = h.length;
            for (var r = 0; r < rows.length; r++) {
                var cell = rows[r][i];
                if (cell !== undefined && cell !== null) {
                    var len = String(cell).length;
                    if (len > maxLen) maxLen = len;
                }
            }
            return { wch: Math.min(Math.max(maxLen * 1.2 + 2, 12), 40) };
        });
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, '订单列表');
        var dateStr = new Date().toISOString().slice(0, 10);
        var monthLabel = monthVal ? monthVal.replace('-','年') + '月' : '全部';
        var fileName = '订单导出_' + monthLabel + '_' + dateStr + '.xlsx';
        XLSX.writeFile(wb, fileName);
        alert('✅ 成功导出 ' + list.length + ' 条订单数据！');
    } catch (err) {
        alert('导出失败：' + err.message);
        console.error('导出错误详情：', err);
    }
}

// ============================================================
//  ★★★ 保存订单（服务器存储） ★★★
// ============================================================

async function saveOrder() {
    const customerCode = document.getElementById('ordCustomerCode')?.value?.trim() || '';
    const orderNo = document.getElementById('ordOrderNo')?.value?.trim() || '';
    const productCode = document.getElementById('ordProductCode')?.value?.trim() || '';
    const productName = document.getElementById('ordProductName')?.value?.trim() || '';
    const spec = document.getElementById('ordSpec')?.value?.trim() || '';
    const color = document.getElementById('ordColor')?.value?.trim() || '';
    const stamp = document.getElementById('ordStamp')?.value?.trim() || '';
    const qty = parseInt(document.getElementById('ordQty')?.value) || 0;
    const materialBoard = document.getElementById('ordMaterialBoard')?.value?.trim() || '';
    const materialShell = document.getElementById('ordMaterialShell')?.value?.trim() || '';
    const orderDate = document.getElementById('ordOrderDate')?.value || '';
    const deliveryDate = document.getElementById('ordDeliveryDate')?.value || '';
    const boardCode = document.getElementById('ordBoardCode')?.value?.trim() || '';
    const shellStock = document.getElementById('ordShellStock')?.value?.trim() || '';
    const remark = document.getElementById('ordRemark')?.value?.trim() || '';
    const partyName = document.getElementById('ordPartyName')?.value?.trim() || '';
    const partyContact = document.getElementById('ordPartyContact')?.value?.trim() || '';
    const syncToPurchase = document.getElementById('ordSyncToPurchase')?.checked !== false;

    if (!orderNo || !productName || qty <= 0) {
        alert('请完整填写订单号、产品名称和数量');
        return;
    }

    // ★★★ 修复 extra 字段格式，去掉多余引号 ★★★
    const extraData = {
        spec: (spec || '').replace(/^"|"$/g, '').replace(/\\"/g, '"'),
        color: (color || '').replace(/^"|"$/g, '').replace(/\\"/g, '"'),
        stamp: (stamp || '').replace(/^"|"$/g, '').replace(/\\"/g, '"'),
        materialBoard: (materialBoard || '').replace(/^"|"$/g, '').replace(/\\"/g, '"'),
        materialShell: (materialShell || '').replace(/^"|"$/g, '').replace(/\\"/g, '"'),
        boardCode: (boardCode || '').replace(/^"|"$/g, '').replace(/\\"/g, '"'),
        shellStock: (shellStock || '').replace(/^"|"$/g, '').replace(/\\"/g, '"'),
        partyName: (partyName || '').replace(/^"|"$/g, '').replace(/\\"/g, '"'),
        partyContact: (partyContact || '').replace(/^"|"$/g, '').replace(/\\"/g, '"'),
        syncToPurchase: syncToPurchase,
        progress: 0,
        qualityStatus: '未质检',
        shipmentStatus: '待出货',
        source: 'production',
        outsourceStatus: '',
        outsourceLocation: '',
        customFields: {},
        deliveryHistory: [],
        deliveredQty: 0,
        remainingQty: qty,
        orderNo: orderNo,
        customerCode: customerCode,
        productCode: productCode,
        productName: productName
    };

    const newOrder = {
        order_no: orderNo,
        customer_code: customerCode,
        product_code: productCode,
        product_name: productName,
        qty: qty,
        order_date: orderDate,
        delivery_date: deliveryDate,
        remark: remark,
        status: '待生产',
        extra: JSON.stringify(extraData)
    };

    try {
        showToast('⏳ 正在创建订单...', 'info');
        
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newOrder)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || '创建失败');
        }
        
        const created = await response.json();
        
        const parsed = typeof window.parseExtraFields === 'function' 
            ? window.parseExtraFields(created) 
            : created;
        
        data.orders.push(parsed);
        
        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }
        
        renderOrders();
        
        if (typeof window.updateBadges === 'function') {
            window.updateBadges();
        }

        const modalEl = document.getElementById('orderModal');
        if (modalEl) {
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) {
                modalInstance.hide();
            } else {
                modalEl.classList.remove('show');
                modalEl.style.display = 'none';
            }
        }

        document.querySelectorAll('.modal-backdrop').forEach(function(el) {
            el.remove();
        });
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';

        setTimeout(function() {
            document.querySelectorAll('.modal-backdrop').forEach(function(el) {
                el.remove();
            });
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, 200);

        showToast('✅ 订单创建成功！', 'success');
        
    } catch (error) {
        setTimeout(function() {
            document.querySelectorAll('.modal-backdrop').forEach(function(el) {
                el.remove();
            });
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, 100);
        
        showToast('❌ 创建失败: ' + error.message, 'error');
        console.error('创建订单错误:', error);
    }
}

function deleteOrder(id) {
    if (!confirm('确认删除此订单？')) return;
    
    // ★★★ 改为使用 ID 删除 ★★★
    fetch('/api/orders/' + id, {
        method: 'DELETE'
    })
    .then(function(response) {
        if (!response.ok) {
            return response.json().then(function(data) {
                throw new Error(data.message || '删除失败');
            });
        }
        return response.json();
    })
    .then(function(result) {
        data.orders = data.orders.filter(function(o) { return o.id !== id; });
        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }
        renderOrders();
        if (typeof window.updateBadges === 'function') {
            window.updateBadges();
        }
        showToast('✅ 订单已删除', 'success');
    })
    .catch(function(error) {
        console.error('删除订单错误:', error);
        showToast('❌ 删除失败: ' + error.message, 'error');
    });
}

// ============================================================
//  订单详情（含产品关联）
// ============================================================

function openOrderDetail(orderId) {
    console.log('🔍 openOrderDetail 被调用，订单ID:', orderId);
    var order = data.orders.find(function(o) { return o.id === orderId; });
    if (!order) { 
        alert('未找到订单，ID: ' + orderId); 
        return; 
    }

    if (!order.customFields) order.customFields = {};
    if (!order.deliveryHistory) order.deliveryHistory = [];

    document.getElementById('detailOrderId').value = order.id;
    detailCustomFields.forEach(function(c) {
        var key = 'custom_' + c.name;
        if (order[key] === undefined) order[key] = '';
    });

    renderDetailFields(order);
    renderDeliveryHistory(order);
    detailManageMode = false;
    document.querySelectorAll('.field-delete-btn').forEach(function(btn) { btn.classList.remove('visible'); });

    var extraFields = document.getElementById('shipmentExtraFields');
    if (extraFields) {
        extraFields.style.display = 'block';
        extraFields.innerHTML = `
            <div class="row g-2">
                <div class="col-md-3">
                    <div class="row g-2">
                        <div class="col-md-12">
                            <label class="form-label" style="font-size:12px;color:#6c7a8a;">出货状态</label>
                            <select class="form-select form-select-sm" id="detailShipmentStatus">
                                <option value="待出货">待出货</option>
                                <option value="质检完成-已送货">质检完成-已送货</option>
                                <option value="质检未通过-返单">质检未通过-返单</option>
                                <option value="已送货完成">已送货完成</option>
                            </select>
                        </div>
                    </div>
                    <input type="hidden" id="detailQualityStatus" value="${order.qualityStatus || '待质检'}" />
                    <input type="hidden" id="detailSource" value="${order.source || 'production'}" />
                </div>
                <div class="col-md-9">
                    <div id="detailProductLinkContainer"></div>
                </div>
            </div>
        `;

        var shipStatusEl = document.getElementById('detailShipmentStatus');
        if (shipStatusEl) {
            shipStatusEl.value = order.shipmentStatus || '待出货';
        }
        renderProductLinkSection(order);
    }

    var modalEl = document.getElementById('orderDetailModal');
    if (modalEl) {
        document.querySelectorAll('.modal-backdrop').forEach(function(el) { el.remove(); });
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
        var modal = new bootstrap.Modal(modalEl, { backdrop: true, keyboard: true });
        modal.show();
    } else {
        alert('模态框元素不存在，请检查 index.html');
    }
}

// ============================================================
//  渲染关联产品模块
// ============================================================

function renderProductLinkSection(order) {
    var container = document.getElementById('detailProductLinkContainer');
    if (!container) return;

    var products = getProductList();
    var currentProductCode = order.productCode || '';
    var currentProductName = order.productName || '';
    var selectedName = '';

    var seenNames = {};
    var uniqueProducts = [];
    for (var i = 0; i < products.length; i++) {
        var p = products[i];
        var nameKey = p.name || '';
        if (nameKey && !seenNames[nameKey]) {
            seenNames[nameKey] = true;
            uniqueProducts.push(p);
        }
    }

    uniqueProducts.sort(function(a, b) {
        return (a.customerCode || '').localeCompare(b.customerCode || '');
    });

    var productListJson = JSON.stringify(uniqueProducts.map(function(p) {
        return {
            id: p.id,
            code: p.code || '',
            name: p.name || '',
            customerCode: p.customerCode || '',
            spec: '',
            color: ''
        };
    }));

    if (currentProductName) {
        selectedName = currentProductName;
    } else if (currentProductCode) {
        var found = uniqueProducts.find(function(p) { return p.code === currentProductCode; });
        if (found) selectedName = found.name || '';
    }

    var selectedDisplay = '';
    if (selectedName) {
        selectedDisplay = '当前关联: <strong style="color:#0066cc;">' + selectedName + '</strong>';
    }

    var html = '';
    html += '<div class="detail-field-item" style="background: #f0f7ff; border: 2px solid #0066cc; border-radius: 10px; padding:10px 14px; height:100%;">';
    html += '<span class="field-label" style="color:#0066cc; font-size:12px;"><i class="bi bi-box"></i> 关联产品</span>';
    html += '<div class="field-control" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; position:relative; margin-top:2px;">';
    
    html += '<div style="flex:1; min-width:150px; position:relative;">';
    html += '<input type="text" id="detailProductSearch" class="form-control form-control-sm" style="width:100%; font-size:13px; border:1px solid #0066cc; border-radius:6px; padding:4px 30px 4px 10px; background:#fff;" placeholder="输入产品名称或编号搜索..." autocomplete="off" oninput="filterProductList(this.value)" onfocus="showProductDropdown()" onblur="hideProductDropdown()" />';
    html += '<span style="position:absolute; right:8px; top:50%; transform:translateY(-50%); color:#999; pointer-events:none;"><i class="bi bi-chevron-down"></i></span>';
    html += '<div id="productDropdownList" style="position:absolute; top:100%; left:0; right:0; max-height:200px; overflow-y:auto; background:#fff; border:1px solid #ccc; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:9999; display:none; margin-top:2px;"></div>';
    html += '</div>';
    
    html += '<button type="button" class="btn btn-sm btn-primary-custom" onclick="applyProductFromSearch()" style="white-space:nowrap; padding:2px 12px; font-size:12px;">';
    html += '<i class="bi bi-arrow-right-circle"></i> 应用</button>';
    html += '<button type="button" class="btn btn-sm btn-outline-custom" onclick="clearProductLink()" style="white-space:nowrap; padding:2px 10px; font-size:12px;">';
    html += '<i class="bi bi-x-circle"></i> 清除</button>';
    html += '<button type="button" class="btn btn-sm btn-outline-custom" onclick="previewProductCard()" style="white-space:nowrap; border-color:#6f42c1; color:#6f42c1; padding:2px 10px; font-size:12px;" title="预览产品信息卡">';
    html += '<i class="bi bi-eye"></i> 预览</button>';
    html += '</div>';
    
    html += '<div style="font-size:11px; color:#6c7a8a; margin-top:2px;">';
    html += '💡 输入关键词搜索产品（支持名称、编号、客户号）';
    if (selectedDisplay) {
        html += ' | ' + selectedDisplay;
    }
    html += '</div>';
    html += '</div>';

    html += '<input type="hidden" id="productDataJson" value="' + productListJson.replace(/"/g, '&quot;') + '" />';

    container.innerHTML = html;

    var searchInput = document.getElementById('detailProductSearch');
    if (searchInput && selectedName) {
        searchInput.value = selectedName;
    }
}

function renderDeliveryHistory(order) {
    var container = document.getElementById('deliveryHistoryContainer');
    if (!container) return;
    var history = order.deliveryHistory || [];
    if (history.length === 0) {
        container.innerHTML = '<div class="text-muted text-center py-2">暂无送货记录</div>';
        return;
    }
    var html = '<div class="table-responsive mt-2"><table class="table table-sm table-bordered" style="font-size:13px;"><thead><tr><th style="text-align:center;">序号</th><th style="text-align:center;">送货日期</th><th style="text-align:center;">送货单号</th><th style="text-align:center;">本次数量</th><th style="text-align:center;">累计已送</th></tr></thead><tbody>';
    history.forEach(function(item, index) {
        html += '<tr><td style="text-align:center;">' + (index + 1) + '</td><td style="text-align:center;">' + (item.date || '') + '</td><td style="text-align:center;">' + (item.deliveryNo || '') + '</td><td style="text-align:center;font-weight:bold;color:#0066cc;">' + (item.qty || 0) + '</td><td style="text-align:center;">' + (item.cumulativeQty || 0) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ============================================================
//  产品库关联（自定义下拉搜索）
// ============================================================

function getProductList() {
    var products = [];
    if (typeof data !== 'undefined' && data.products) {
        products = data.products;
    } else {
        try {
            var stored = localStorage.getItem('erp_production_data');
            if (stored) {
                var parsed = JSON.parse(stored);
                products = parsed.products || [];
            }
        } catch(e) {}
    }
    return products;
}

function getProductListData() {
    try {
        var jsonEl = document.getElementById('productDataJson');
        if (jsonEl) {
            var decoded = jsonEl.value.replace(/&quot;/g, '"');
            return JSON.parse(decoded);
        }
    } catch(e) {}
    return [];
}

function filterProductList(keyword) {
    var dropdown = document.getElementById('productDropdownList');
    if (!dropdown) return;
    
    var products = getProductListData();
    var lowerKeyword = (keyword || '').toLowerCase().trim();
    
    var filtered = products;
    if (lowerKeyword) {
        filtered = products.filter(function(p) {
            return (p.name && p.name.toLowerCase().includes(lowerKeyword)) ||
                   (p.code && p.code.toLowerCase().includes(lowerKeyword)) ||
                   (p.customerCode && p.customerCode.includes(lowerKeyword));
        });
    }
    
    var seen = {};
    var unique = [];
    for (var i = 0; i < filtered.length; i++) {
        var key = filtered[i].name || '';
        if (key && !seen[key]) {
            seen[key] = true;
            unique.push(filtered[i]);
        }
    }
    filtered = unique;
    
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding:10px 12px; color:#999; text-align:center;">没有匹配的产品</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    var html = '';
    var maxShow = Math.min(filtered.length, 20);
    for (var j = 0; j < maxShow; j++) {
        var p = filtered[j];
        var displayText = (p.customerCode || '') + ' - ' + p.name;
        html += '<div style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #f0f2f5; font-size:13px;" onmousedown="selectProduct(' + p.id + ', \'' + p.name.replace(/'/g, "\\'") + '\')" onmouseover="this.style.backgroundColor=\'#f0f7ff\'" onmouseout="this.style.backgroundColor=\'transparent\'">';
        html += displayText;
        html += '</div>';
    }
    if (filtered.length > 20) {
        html += '<div style="padding:8px 12px; color:#999; text-align:center; font-size:12px;">... 还有 ' + (filtered.length - 20) + ' 个产品</div>';
    }
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
}

function showProductDropdown() {
    var dropdown = document.getElementById('productDropdownList');
    if (!dropdown) return;
    var searchInput = document.getElementById('detailProductSearch');
    if (!searchInput) return;
    filterProductList(searchInput.value);
}

function hideProductDropdown() {
    setTimeout(function() {
        var dropdown = document.getElementById('productDropdownList');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }, 200);
}

function selectProduct(productId, productName) {
    var searchInput = document.getElementById('detailProductSearch');
    if (searchInput) {
        searchInput.value = productName;
        searchInput.dataset.selectedId = productId;
    }
    var dropdown = document.getElementById('productDropdownList');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    applyProductFromSearch();
}

function applyProductFromSearch() {
    var searchInput = document.getElementById('detailProductSearch');
    if (!searchInput) {
        alert('搜索框未找到，请刷新页面');
        return;
    }

    var inputValue = searchInput.value.trim();
    if (!inputValue) {
        alert('请输入或选择产品');
        return;
    }

    var orderId = parseInt(document.getElementById('detailOrderId').value);
    var order = data.orders.find(function(o) { return o.id === orderId; });
    if (!order) {
        alert('订单不存在');
        return;
    }

    var matchedProduct = null;
    var lowerInput = inputValue.toLowerCase();

    matchedProduct = data.products.find(function(p) {
        return p.name === inputValue || p.code === inputValue;
    });

    if (!matchedProduct) {
        var candidates = data.products.filter(function(p) {
            return (p.name && p.name.toLowerCase().includes(lowerInput)) ||
                   (p.code && p.code.toLowerCase().includes(lowerInput)) ||
                   (p.customerCode && p.customerCode.includes(inputValue));
        });
        
        var seen = {};
        var uniqueCandidates = [];
        for (var i = 0; i < candidates.length; i++) {
            var key = candidates[i].name || '';
            if (key && !seen[key]) {
                seen[key] = true;
                uniqueCandidates.push(candidates[i]);
            }
        }
        
        if (uniqueCandidates.length === 1) {
            matchedProduct = uniqueCandidates[0];
        } else if (uniqueCandidates.length > 1) {
            var msg = '找到多个匹配产品，请选择：\n';
            for (var j = 0; j < Math.min(uniqueCandidates.length, 10); j++) {
                var p = uniqueCandidates[j];
                msg += (j + 1) + '. ' + (p.customerCode || '') + ' - ' + p.name + '\n';
            }
            if (uniqueCandidates.length > 10) msg += '... 共 ' + uniqueCandidates.length + ' 个';
            alert(msg + '\n\n请输入更精确的关键词');
            return;
        }
    }

    if (!matchedProduct) {
        alert('未找到匹配的产品，请重新输入关键词搜索');
        return;
    }

    var productCode = matchedProduct.code || '';
    var productName = matchedProduct.name || '';
    var customerCode = matchedProduct.customerCode || '';

    var spec = '';
    var color = '';
    if (matchedProduct.magnetDetail) {
        try {
            var magnetData = JSON.parse(matchedProduct.magnetDetail);
            if (Array.isArray(magnetData) && magnetData.length > 0) {
                var firstRow = magnetData[0];
                if (firstRow && firstRow.length >= 2) {
                    spec = firstRow[1] || '';
                }
            }
        } catch(e) {}
    }
    if (matchedProduct.desc) {
        var descParts = matchedProduct.desc.split(' ');
        for (var k = 0; k < descParts.length; k++) {
            if (/^(红|蓝|绿|黑|白|灰|紫|粉|金|银|深灰|浅灰|米色|干邑|玫瑰金|星光色)/.test(descParts[k])) {
                color = descParts[k];
                break;
            }
        }
    }

    var productCodeField = document.getElementById('detail_productCode');
    var productNameField = document.getElementById('detail_productName');
    var specField = document.getElementById('detail_spec');
    var colorField = document.getElementById('detail_color');
    var customerCodeField = document.getElementById('detail_customerCode');

    if (productCodeField) productCodeField.value = productCode;
    if (productNameField) productNameField.value = productName;
    if (specField && spec) specField.value = spec;
    if (colorField && color) colorField.value = color;
    if (customerCodeField) customerCodeField.value = customerCode;

    order.productCode = productCode;
    order.productName = productName;
    order.spec = spec || order.spec || '';
    order.color = color || order.color || '';
    order.customerCode = customerCode || order.customerCode || '';

    searchInput.value = productName;

    var hint = document.querySelector('#detailProductLinkContainer .detail-field-item .field-label + div + div');
    if (hint) {
        hint.innerHTML = '💡 输入关键词搜索产品（支持名称、编号、客户号） | 当前关联: <strong style="color:#0066cc;">' + productName + '</strong>';
    }

    saveDataToStorage();
    renderDetailFields(order);
    renderProductLinkSection(order);
    var newSearchInput = document.getElementById('detailProductSearch');
    if (newSearchInput) {
        newSearchInput.value = productName;
    }

    alert('✅ 已应用产品信息到订单！');
}

function clearProductLink() {
    if (!confirm('确定清除产品关联吗？（将清空产品编号、名称、规格、颜色、客户号）')) return;

    var orderId = parseInt(document.getElementById('detailOrderId').value);
    var order = data.orders.find(function(o) { return o.id === orderId; });
    if (!order) return;

    order.productCode = '';
    order.productName = '';
    order.spec = '';
    order.color = '';
    order.customerCode = '';

    var searchInput = document.getElementById('detailProductSearch');
    if (searchInput) searchInput.value = '';

    saveDataToStorage();
    renderDetailFields(order);
    renderProductLinkSection(order);
    alert('✅ 已清除产品关联');
}

// ============================================================
//  预览产品信息卡
// ============================================================

function previewProductCard() {
    console.log('🔍 previewProductCard 被调用');

    var orderId = parseInt(document.getElementById('detailOrderId').value);
    var order = data.orders.find(function(o) { return o.id === orderId; });
    if (!order) {
        alert('订单不存在');
        return;
    }

    console.log('📦 当前订单:', order.orderNo, '产品名称:', order.productName, '产品编码:', order.productCode);

    var product = null;
    if (order.productCode) {
        product = data.products.find(function(p) { return p.code === order.productCode; });
    }
    if (!product && order.productName) {
        product = data.products.find(function(p) { return p.name === order.productName; });
    }
    if (!product && order.productName) {
        var nameParts = order.productName.split(' ');
        for (var i = 0; i < nameParts.length; i++) {
            var part = nameParts[i];
            if (part.length > 3) {
                var found = data.products.find(function(p) {
                    return p.name && p.name.includes(part);
                });
                if (found) {
                    product = found;
                    break;
                }
            }
        }
    }

    if (!product) {
        alert('当前订单未关联产品，请先在「关联产品」中选择并应用产品');
        return;
    }

    console.log('✅ 找到产品:', product.name, 'ID:', product.id);

    var modalId = 'productPreviewModal';
    var modalEl = document.getElementById(modalId);
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal fade';
        modalEl.tabIndex = -1;
        modalEl.setAttribute('data-bs-backdrop', 'static');
        modalEl.innerHTML = `
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header" style="background:#f0f7ff; border-bottom:2px solid #0066cc;">
                        <h5 class="modal-title"><i class="bi bi-box" style="color:#0066cc;"></i> 产品信息卡</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="productPreviewBody" style="max-height:70vh; overflow-y:auto; padding:20px;">
                        <div class="text-center py-4 text-muted">加载中...</div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
        console.log('✅ 产品预览模态框已创建');
    }

    var body = document.getElementById('productPreviewBody');
    if (!body) {
        alert('页面加载异常，请刷新后重试');
        return;
    }

    var html = '';
    html += '<div style="padding:0;">';

    html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 16px; margin-bottom:16px; padding:12px 16px; background:#f8fafc; border-radius:8px;">';
    html += '<div><strong>产品编码：</strong>' + (product.code || '-') + '</div>';
    html += '<div><strong>产品名称：</strong>' + (product.name || '-') + '</div>';
    html += '<div><strong>客户号：</strong>' + (product.customerCode || '-') + '</div>';
    html += '<div><strong>单位：</strong>' + (product.unit || '个') + '</div>';
    html += '</div>';

    var magnetHtml = '';
    if (product.magnetDetail) {
        try {
            var magnetData = JSON.parse(product.magnetDetail);
            if (Array.isArray(magnetData) && magnetData.length > 0) {
                magnetHtml = '<table class="table table-sm table-bordered" style="font-size:13px; margin-bottom:0;"><thead style="background:#f0f4f8;"><tr><th>磁性</th><th>尺寸规格</th><th>数量</th><th>备注</th></tr></thead><tbody>';
                magnetData.forEach(function(row) {
                    if (row && row.length >= 4) {
                        magnetHtml += '<tr><td>' + (row[0] || '') + '</td><td>' + (row[1] || '') + '</td><td>' + (row[2] || '') + '</td><td>' + (row[3] || '') + '</td></tr>';
                    }
                });
                magnetHtml += '</tbody></table>';
            } else {
                magnetHtml = '<div class="text-muted">暂无磁石数据</div>';
            }
        } catch(e) {
            magnetHtml = '<div class="text-muted">磁石数据格式异常</div>';
        }
    } else {
        magnetHtml = '<div class="text-muted">暂无磁石数据</div>';
    }

    var materialHtml = '';
    if (product.materialDetail && product.materialDetail.length > 0) {
        materialHtml = '<table class="table table-sm table-bordered" style="font-size:13px; margin-bottom:0;"><thead style="background:#f0f4f8;"><tr><th>物料</th><th>颜色</th><th>个数/码</th><th>备注</th></tr></thead><tbody>';
        product.materialDetail.forEach(function(row) {
            if (row && row.length >= 4) {
                materialHtml += '<tr><td>' + (row[0] || '') + '</td><td>' + (row[1] || '') + '</td><td>' + (row[2] || '') + '</td><td>' + (row[3] || '') + '</td></tr>';
            }
        });
        materialHtml += '</tbody></table>';
    } else {
        materialHtml = '<div class="text-muted">暂无物料数据</div>';
    }

    html += '<div style="display:flex; flex-wrap:wrap; gap:16px;">';
    html += '<div style="flex:1; min-width:280px;"><h6 style="margin-bottom:6px;">🧲 磁石明细</h6><div style="max-height:200px; overflow-y:auto;">' + magnetHtml + '</div></div>';
    html += '<div style="flex:1; min-width:280px;"><h6 style="margin-bottom:6px;">📦 物料明细</h6><div style="max-height:200px; overflow-y:auto;">' + materialHtml + '</div></div>';
    html += '</div>';

    if (product.images && product.images.length > 0) {
        html += '<hr style="margin:12px 0;" />';
        html += '<h6 style="margin-bottom:6px;">📷 产品图片</h6>';
        html += '<div style="display:flex; flex-wrap:wrap; gap:8px;">';
        product.images.slice(0, 8).forEach(function(img) {
            html += '<img src="' + img + '" style="width:80px; height:80px; object-fit:cover; border-radius:4px; border:1px solid #e9edf2;" />';
        });
        if (product.images.length > 8) {
            html += '<div style="display:flex; align-items:center; justify-content:center; width:80px; height:80px; background:#f0f2f5; border-radius:4px; font-size:12px; color:#999;">+' + (product.images.length - 8) + ' 张</div>';
        }
        html += '</div>';
    }

    html += '</div>';
    body.innerHTML = html;

    var modal = new bootstrap.Modal(modalEl);
    modal.show();
    console.log('✅ 产品预览模态框已显示');
}

// ============================================================
//  渲染详情字段
// ============================================================

function renderDetailFields(order) {
    var container = document.getElementById('detailFieldsContainer');
    if (!container) return;

    // 确保订单对象包含所有扩展字段
    if (!order.spec) order.spec = '';
    if (!order.color) order.color = '';
    if (!order.stamp) order.stamp = '';
    if (!order.materialBoard) order.materialBoard = '';
    if (!order.materialShell) order.materialShell = '';
    if (!order.boardCode) order.boardCode = '';
    if (!order.shellStock) order.shellStock = '';
    if (!order.partyName) order.partyName = '';
    if (!order.partyAddress) order.partyAddress = '';
    if (!order.partyContact) order.partyContact = '';
    if (!order.partyFormNo) order.partyFormNo = '';
    if (!order.remark) order.remark = '';
    if (order.progress === undefined || order.progress === null) order.progress = 0;
    if (!order.qualityStatus) order.qualityStatus = '未质检';
    if (!order.shipmentStatus) order.shipmentStatus = '待出货';
    if (!order.customFields) order.customFields = {};
    if (!order.deliveryHistory) order.deliveryHistory = [];

    // 获取所有字段定义（内置 + 自定义）
    var allFields = detailFieldDefs.concat(detailCustomFields.map(function(c) {
        return { key: 'custom_' + c.name, label: c.name, type: c.type, isCustom: true };
    }));

    var html = '';
    var specialKeys = ['stamp', 'qty', 'materialBoard', 'materialShell', 'boardCode', 'shellStock', 'partyName', 'partyFormNo', 'partyContact', 'partyAddress', 'orderDate', 'deliveryDate', 'status', 'remark', 'progress'];
    var specialFieldsHtml = [];
    var otherFieldsHtml = '';

    allFields.forEach(function(def) {
        if (detailFieldsVisible[def.key] === false) return;
        
        // 从订单对象中取值（兼容驼峰和下划线）
        var val = order[def.key];
        // 如果值为 undefined 或 null，尝试用下划线版本
        if (val === undefined || val === null) {
            var altKey = def.key.replace(/([A-Z])/g, '_$1').toLowerCase();
            val = order[altKey];
        }
        if (val === undefined || val === null) val = '';

        var deleteBtn = '<span class="field-delete-btn ' + (detailManageMode ? 'visible' : '') + '" onclick="deleteDetailField(\'' + def.key + '\')"><i class="bi bi-x-circle"></i></span>';
        var controlHtml = '';
        var fieldId = 'detail_' + def.key;

        switch (def.type) {
            case 'textarea':
                controlHtml = '<textarea class="form-control" id="' + fieldId + '" rows="2" style="resize:vertical;font-size:14px;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;background:#fff;width:100%;">' + val + '</textarea>';
                break;
            case 'select':
                if (def.key === 'status') {
                    controlHtml = '<select class="form-select" id="' + fieldId + '" style="font-size:14px;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;background:#fff;width:100%;"><option value="待生产" ' + (val === '待生产' ? 'selected' : '') + '>待生产</option><option value="生产中" ' + (val === '生产中' ? 'selected' : '') + '>生产中</option><option value="待质检" ' + (val === '待质检' ? 'selected' : '') + '>待质检</option><option value="待出货" ' + (val === '待出货' ? 'selected' : '') + '>待出货</option><option value="已完成" ' + (val === '已完成' ? 'selected' : '') + '>已完成</option></select>';
                } else if (def.key === 'qualityStatus') {
                    controlHtml = '<select class="form-select" id="' + fieldId + '" style="font-size:14px;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;background:#fff;width:100%;"><option value="未质检" ' + (val === '未质检' ? 'selected' : '') + '>未质检</option><option value="质检中" ' + (val === '质检中' ? 'selected' : '') + '>质检中</option><option value="质检合格" ' + (val === '质检合格' ? 'selected' : '') + '>质检合格</option><option value="质检不合格" ' + (val === '质检不合格' ? 'selected' : '') + '>质检不合格</option></select>';
                } else if (def.key === 'shipmentStatus') {
                    controlHtml = '<select class="form-select" id="' + fieldId + '" style="font-size:14px;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;background:#fff;width:100%;"><option value="待出货" ' + (val === '待出货' ? 'selected' : '') + '>待出货</option><option value="质检完成-已送货" ' + (val === '质检完成-已送货' ? 'selected' : '') + '>质检完成-已送货</option><option value="质检未通过-返单" ' + (val === '质检未通过-返单' ? 'selected' : '') + '>质检未通过-返单</option><option value="已送货完成" ' + (val === '已送货完成' ? 'selected' : '') + '>已送货完成</option></select>';
                }
                break;
            case 'date':
                controlHtml = '<input type="date" class="form-control" id="' + fieldId + '" value="' + val + '" style="font-size:14px;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;background:#fff;width:100%;" />';
                break;
            case 'number':
                controlHtml = '<input type="number" class="form-control" id="' + fieldId + '" value="' + val + '" style="font-size:14px;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;background:#fff;width:100%;" />';
                break;
            default:
                controlHtml = '<input type="text" class="form-control" id="' + fieldId + '" value="' + val + '" style="font-size:14px;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;background:#fff;width:100%;" />';
        }

        var fieldHtml = '<div class="detail-field-item" style="padding:6px 8px; min-height:52px;"><span class="field-label">' + def.label + '</span><div class="field-control">' + controlHtml + '</div>' + deleteBtn + '</div>';

        if (specialKeys.indexOf(def.key) !== -1) {
            specialFieldsHtml.push(fieldHtml);
        } else {
            otherFieldsHtml += fieldHtml;
        }
    });

    html += otherFieldsHtml;
    if (specialFieldsHtml.length > 0) {
        html += '<hr style="margin:12px 0;" />';
        html += '<div style="grid-column: 1 / -1; width: 100%; display:grid; grid-template-columns: repeat(5, 1fr); gap:6px 10px; margin-bottom:8px;">';
        specialFieldsHtml.forEach(function(fieldHtml) {
            html += fieldHtml;
        });
        html += '</div>';
    }

    container.innerHTML = html;
    document.querySelectorAll('.field-delete-btn').forEach(function(btn) {
        btn.classList.toggle('visible', detailManageMode);
    });
}

function toggleDetailManage() {
    detailManageMode = !detailManageMode;
    var orderId = parseInt(document.getElementById('detailOrderId').value);
    if (orderId) {
        var order = data.orders.find(function(o) { return o.id === orderId; });
        if (order) renderDetailFields(order);
    }
}

function deleteDetailField(key) {
    var label = '';
    var found = detailFieldDefs.find(function(f) { return f.key === key; });
    if (found) label = found.label;
    if (!label) label = key;
    if (!confirm('确定要删除字段 "' + label + '" 吗？')) return;
    detailFieldsVisible[key] = false;
    saveDataToStorage();
    var orderId = parseInt(document.getElementById('detailOrderId').value);
    var order = data.orders.find(function(o) { return o.id === orderId; });
    if (order) renderDetailFields(order);
}

function openRecoverDetailModal() {
    var container = document.getElementById('recoverDetailList');
    var html = '';
    var allKeys = detailFieldDefs.map(function(f) { return f.key; }).concat(detailCustomFields.map(function(c) { return 'custom_' + c.name; }));
    var hasDeleted = false;
    allKeys.forEach(function(key) {
        if (detailFieldsVisible[key] === false) {
            var label = '';
            var found = detailFieldDefs.find(function(f) { return f.key === key; });
            if (found) label = found.label;
            if (!label) {
                var found2 = detailCustomFields.find(function(c) { return 'custom_' + c.name === key; });
                if (found2) label = found2.name;
            }
            if (!label) label = key;
            html += '<div class="recover-item"><input type="checkbox" class="form-check-input" id="recover_' + key + '" value="' + key + '" /><label for="recover_' + key + '">' + label + '</label></div>';
            hasDeleted = true;
        }
    });
    if (!hasDeleted) html = '<p class="text-muted text-center">没有已删除的字段</p>';
    container.innerHTML = html;
    new bootstrap.Modal(document.getElementById('recoverDetailModal')).show();
}

function recoverDetailFields() {
    var checks = document.querySelectorAll('#recoverDetailList input:checked');
    if (checks.length === 0) { alert('请选择要恢复的字段'); return; }
    checks.forEach(function(cb) { detailFieldsVisible[cb.value] = true; });
    saveDataToStorage();
    closeModal('recoverDetailModal');
    var orderId = parseInt(document.getElementById('detailOrderId').value);
    var order = data.orders.find(function(o) { return o.id === orderId; });
    if (order) renderDetailFields(order);
    alert('✅ 已恢复选中字段');
}

function openAddDetailFieldModal() {
    document.getElementById('newDetailFieldName').value = '';
    new bootstrap.Modal(document.getElementById('addDetailFieldModal')).show();
}

function addDetailCustomField() {
    var name = document.getElementById('newDetailFieldName').value.trim();
    if (!name) { alert('请输入字段名称'); return; }
    if (detailCustomFields.some(function(c) { return c.name === name; })) { alert('字段已存在'); return; }
    if (detailFieldDefs.some(function(f) { return f.label === name; })) { alert('该名称与内置字段冲突'); return; }
    var type = document.getElementById('newDetailFieldType').value;
    var key = 'custom_' + name;
    detailCustomFields.push({ name: name, type: type });
    detailFieldsVisible[key] = true;
    data.orders.forEach(function(o) { if (o[key] === undefined) o[key] = ''; });
    saveDataToStorage();
    closeModal('addDetailFieldModal');
    var orderId = parseInt(document.getElementById('detailOrderId').value);
    var order = data.orders.find(function(o) { return o.id === orderId; });
    if (order) renderDetailFields(order);
    alert('✅ 已添加自定义字段 "' + name + '"');
}

// ============================================================
//  ★★★ 保存订单详情（服务器存储） ★★★
// ============================================================

async function saveOrderDetail() {
    const id = parseInt(document.getElementById('detailOrderId').value);
    const order = data.orders.find(o => o.id === id);
    if (!order) { alert('订单不存在'); return; }

    // 收集所有字段
    const allFields = detailFieldDefs.concat(detailCustomFields.map(c => {
        return { key: 'custom_' + c.name };
    }));
    allFields.forEach(def => {
        if (detailFieldsVisible[def.key] === false) return;
        const el = document.getElementById('detail_' + def.key);
        if (el) order[def.key] = el.value.trim();
    });

    // 出货状态
    const shipStatusEl = document.getElementById('detailShipmentStatus');
    if (shipStatusEl) {
        order.shipmentStatus = shipStatusEl.value;
    }
    const qualityStatusEl = document.getElementById('detailQualityStatus');
    if (qualityStatusEl) {
        order.qualityStatus = qualityStatusEl.value;
    }

    // 构建更新数据
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
        extra: JSON.stringify({
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
            remainingQty: order.remainingQty || order.qty || 0
        })
    };

    try {
        const response = await fetch(`/api/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        if (!response.ok) throw new Error('更新失败');
        const updated = await response.json();
        const parsed = typeof window.parseExtraFields === 'function' 
            ? window.parseExtraFields(updated) 
            : updated;
        const index = data.orders.findIndex(o => o.id === id);
        if (index !== -1) data.orders[index] = parsed;
        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }
        renderOrders();
        closeModal('orderDetailModal');
        showToast('✅ 订单已更新', 'success');
    } catch (error) {
        showToast('❌ 更新失败: ' + error.message, 'error');
        console.error(error);
    }
}

// ============================================================
//  推送生产/外发
// ============================================================

function pushToProduction() {
    var id = parseInt(document.getElementById('detailOrderId').value);
    var order = data.orders.find(function(o) { return o.id === id; });
    if (!order) { alert('订单不存在'); return; }
    if (data.productions.find(function(p) { return p.orderId === order.id; })) { alert('该订单已推送到生产管理'); return; }
    if (order.status === '已完成') { alert('订单已完成，无法推送'); return; }

    // 直接用当前订单数据创建生产单，无需再请求后端获取
    var newProd = {
        order_id: order.id,
        order_no: order.orderNo || order.order_no,
        product_name: order.productName || order.product_name,
        plan_qty: order.qty || 0,
        qualified_qty: 0,
        stage: '开料',
        status: '生产中',
        start_date: new Date().toISOString().slice(0, 10),
        end_date: order.deliveryDate || '',
        remark: ''
    };

    fetch('/api/productions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProd)
    })
    .then(function(response) {
        if (!response.ok) throw new Error('推送生产单失败');
        return response.json();
    })
    .then(function(created) {
        // 更新本地订单状态
        var orderLocal = data.orders.find(function(o) { return o.id === order.id; });
        if (orderLocal) {
            orderLocal.status = '生产中';
            orderLocal.source = 'production';
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

function showSupplierSelector(callback) {
    var suppliers = [];
    try {
        var stored = localStorage.getItem('erp_suppliers');
        if (stored) {
            var parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                suppliers = parsed.map(function(s) { return s.name; }).filter(Boolean);
            }
        }
    } catch(e) {
        console.warn('读取供应商列表失败:', e);
    }
    if (suppliers.length === 0) {
        suppliers = ['华沃', '宏远外发加工厂', '永磁科技', '强磁材料'];
    }
    suppliers = Array.from(new Set(suppliers)).sort();

    var modalId = 'supplierSelectorModal';
    var existing = document.getElementById(modalId);
    if (existing) existing.remove();

    var modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-sm">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="bi bi-building"></i> 选择外发供应商</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">供应商名称</label>
                            <select class="form-select" id="supplierSelect" style="font-size:14px;">
                                <option value="">-- 请选择 --</option>
                                ${suppliers.map(function(s) {
                                    return '<option value="' + s + '">' + s + '</option>';
                                }).join('')}
                                <option value="__other__">其他（手动输入）</option>
                            </select>
                        </div>
                        <div class="mb-3" id="supplierOtherDiv" style="display:none;">
                            <label class="form-label">请输入供应商名称</label>
                            <input type="text" class="form-control" id="supplierOtherInput" placeholder="请输入供应商名称" />
                        </div>
                        <div class="mb-3">
                            <label class="form-label">外发（存放位置）</label>
                            <input type="text" class="form-control" id="locationInput" placeholder="自动填充供应商名称" />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button class="btn btn-primary-custom" id="confirmSupplierBtn">确认</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var modalEl = document.getElementById(modalId);
    var modal = new bootstrap.Modal(modalEl);
    modal.show();

    var supplierSelect = document.getElementById('supplierSelect');
    var supplierOtherDiv = document.getElementById('supplierOtherDiv');
    var supplierOtherInput = document.getElementById('supplierOtherInput');
    var locationInput = document.getElementById('locationInput');

    supplierSelect.addEventListener('change', function() {
        var val = this.value;
        if (val === '__other__') {
            supplierOtherDiv.style.display = 'block';
            var otherVal = supplierOtherInput.value.trim();
            locationInput.value = otherVal || '';
        } else {
            supplierOtherDiv.style.display = 'none';
            locationInput.value = val;
        }
    });

    supplierOtherInput.addEventListener('input', function() {
        locationInput.value = this.value.trim();
    });

    document.getElementById('confirmSupplierBtn').addEventListener('click', function() {
        var select = supplierSelect;
        var supplier = '';
        if (select.value === '__other__') {
            supplier = supplierOtherInput.value.trim();
        } else {
            supplier = select.value;
        }
        var location = locationInput.value.trim();
        if (!location) {
            location = supplier;
        }
        if (!supplier) {
            alert('请选择或输入供应商名称');
            return;
        }
        var bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
        if (callback) callback({ supplier: supplier, location: location });
    });

    modalEl.addEventListener('hidden.bs.modal', function() {
        if (callback) callback(null);
    });
}

function pushToOutsource() {
    var id = parseInt(document.getElementById('detailOrderId').value);
    var order = data.orders.find(function(o) { return o.id === id; });
    if (!order) { alert('订单不存在'); return; }

    // ★★★ 兼容字段名：确保 order.orderNo 存在 ★★★
    if (!order.orderNo && order.order_no) {
        order.orderNo = order.order_no;
    }

    var existing = data.outsourceOrders.find(function(os) { return os.orderId === order.id && os.status !== '已完成-待出货'; });
    if (existing) { alert('该订单已有进行中的外发记录，不能重复推送'); return; }

    showSupplierSelector(function(result) {
        if (!result) return;

        var now = new Date();
        var dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        var count = data.outsourceOrders.length + 1;
        var outsourceNo = 'WF' + dateStr + String(count).padStart(4, '0');

        // 直接用当前订单数据，无需额外请求
        var newOutData = {
            order_id: order.id,
            outsource_no: outsourceNo,
            status: '待外发',
            location: result.location,
            outsource_date: now.toISOString().slice(0, 10),
            supplier: result.supplier,
            return_date: '',
            remark: ''
        };

        fetch('/api/outsource', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newOutData)
        })
        .then(function(response) {
            if (!response.ok) throw new Error('创建外发记录失败');
            return response.json();
        })
        .then(function(created) {
            var newOut = {
                id: created.id,
                orderId: created.order_id,
                outsourceNo: created.outsource_no,
                status: created.status,
                location: created.location,
                outsourceDate: created.outsource_date,
                supplier: created.supplier,
                returnDate: created.return_date,
                remark: created.remark
            };
            data.outsourceOrders.push(newOut);
            order.outsourceStatus = '待外发';
            order.outsourceLocation = result.location;
            order.source = 'outsource';
            order.status = '外发中';
            if (order.remainingQty === undefined || order.remainingQty === 0) {
                order.remainingQty = order.qty || 0;
            }
            if (order.deliveredQty === undefined) {
                order.deliveredQty = 0;
            }
            if (typeof window.saveOrderStatus === 'function') {
                window.saveOrderStatus(order);
            }
            if (typeof window.saveDataToStorage === 'function') {
                window.saveDataToStorage();
            }
            closeModal('orderDetailModal');
            if (typeof window.renderAll === 'function') window.renderAll();
            if (typeof window.switchPage === 'function') window.switchPage('outsource');
            showToast('✅ 已推送到外发管理', 'success');
        })
        .catch(function(error) {
            showToast('❌ 推送失败: ' + error.message, 'error');
            console.error(error);
        });
    });
}

function batchPushToOutsource() {
    var checkedBoxes = document.querySelectorAll('.order-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert('请先勾选需要推送的订单');
        return;
    }

    var selectedOrders = [];
    checkedBoxes.forEach(function(cb) {
        var id = parseInt(cb.dataset.orderId);
        var order = data.orders.find(function(o) { return o.id === id; });
        if (order) {
            var existing = data.outsourceOrders.find(function(os) {
                return os.orderId === order.id && os.status !== '已完成-待出货';
            });
            if (existing) return;
            if (order.status === '已完成') return;
            selectedOrders.push(order);
        }
    });

    if (selectedOrders.length === 0) {
        alert('没有可推送的订单（可能已推送到外发或已完成）');
        return;
    }

    showSupplierSelector(function(result) {
        if (!result) return;

        var now = new Date();
        var dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        var createdCount = 0;

        selectedOrders.forEach(function(order) {
            var existing = data.outsourceOrders.find(function(os) {
                return os.orderId === order.id && os.status !== '已完成-待出货';
            });
            if (existing) return;
            if (order.status === '已完成') return;

            var count = data.outsourceOrders.length + 1;
            var outsourceNo = 'WF' + dateStr + String(count).padStart(4, '0');

            var newOut = {
                id: data._nextId.outsource++,
                orderId: order.id,
                outsourceNo: outsourceNo,
                status: '待外发',
                location: result.location,
                outsourceDate: now.toISOString().slice(0, 10),
                supplier: result.supplier,
                returnDate: '',
                remark: ''
            };
            data.outsourceOrders.push(newOut);
            order.outsourceStatus = '待外发';
            order.outsourceLocation = result.location;
            order.source = 'outsource';
            order.status = '外发中';
            if (order.remainingQty === undefined || order.remainingQty === 0) { order.remainingQty = order.qty || 0; }
            if (order.deliveredQty === undefined) { order.deliveredQty = 0; }
            createdCount++;
        });

        if (createdCount === 0) {
            alert('没有订单被成功推送（可能已有外发记录）');
            return;
        }

        saveDataToStorage();
        renderAll();
        var toastMsg = '✅ 成功推送 ' + createdCount + ' 个订单到外发管理';
        if (typeof showToast === 'function') {
            showToast(toastMsg, 'success');
        } else {
            alert(toastMsg);
        }
        switchPage('outsource');
    });
}

function batchPushToProduction() {
    var checkedBoxes = document.querySelectorAll('.order-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert('请先勾选需要推送的订单');
        return;
    }

    var selectedOrders = [];
    checkedBoxes.forEach(function(cb) {
        var id = parseInt(cb.dataset.orderId);
        var order = data.orders.find(function(o) { return o.id === id; });
        if (order) {
            var existing = data.productions.find(function(p) {
                return p.orderId === order.id;
            });
            if (existing) return;
            if (order.status === '已完成') return;
            selectedOrders.push(order);
        }
    });

    if (selectedOrders.length === 0) {
        alert('没有可推送的订单（可能已推送到生产或已完成）');
        return;
    }

    if (!confirm('确认将选中的 ' + selectedOrders.length + ' 个订单推送到生产管理？')) return;

    var createdCount = 0;
    selectedOrders.forEach(function(order) {
        var existing = data.productions.find(function(p) {
            return p.orderId === order.id;
        });
        if (existing) return;
        if (order.status === '已完成') return;

        var newProd = {
            id: data._nextId.production++,
            orderId: order.id,
            orderNo: order.orderNo,
            productName: order.productName,
            planQty: order.qty,
            qualifiedQty: 0,
            status: '生产中',
            stage: '开料',
            startDate: new Date().toISOString().slice(0, 10),
            endDate: order.deliveryDate || '',
            remark: ''
        };
        data.productions.push(newProd);
        order.status = '生产中';
        order.source = 'production';
        if (order.remainingQty === undefined || order.remainingQty === 0) { order.remainingQty = order.qty || 0; }
        if (order.deliveredQty === undefined) { order.deliveredQty = 0; }
        createdCount++;
    });

    if (createdCount === 0) {
        alert('没有订单被成功推送（可能已推送到生产）');
        return;
    }

    saveDataToStorage();
    renderAll();
    var toastMsg = '✅ 成功推送 ' + createdCount + ' 个订单到生产管理';
    if (typeof showToast === 'function') {
        showToast(toastMsg, 'success');
    } else {
        alert(toastMsg);
    }
    switchPage('production');
}

// ============================================================
//  Excel 批量导入功能（完整实现）
// ============================================================

function parseContractExcel(rows) {
    var result = { 
        partyName: '', 
        partyAddress: '', 
        partyContact: '', 
        partyFormNo: '', 
        orderNo: '', 
        orderDate: '', 
        deliveryDate: '', 
        productCode: '', 
        productName: '', 
        spec: '', 
        qty: '', 
        color: '', 
        customerCode: '' 
    };

    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (!row || row.length === 0) continue;
        var rowStr = row.map(function(c) { return c !== undefined && c !== null ? String(c) : ''; }).join(' ');
        var rowText = rowStr.trim();

        if (rowText.includes('甲方(需方)') || rowText.includes('甲方（需方）')) {
            var fullText = rowText.replace(/\s+/g, ' ');
            var match = fullText.match(/甲方[（(]需方[)）][：:]\s*([^\n\r,，。]{2,40})/);
            if (match) result.partyName = match[1].trim();
            var addrMatch = fullText.match(/地址[：:]\s*([^\n\r,，。]{2,50})/);
            if (addrMatch) result.partyAddress = addrMatch[1].trim();
            var contactMatch = fullText.match(/联系人[：:]\s*([^\n\r,，。]{2,20})/);
            if (contactMatch) result.partyContact = contactMatch[1].trim();
            continue;
        }
        if (rowText.includes('表单编号')) {
            var match2 = rowText.match(/表单编号[：:]\s*([A-Za-z0-9\-]{6,20})/);
            if (match2) result.partyFormNo = match2[1].trim();
            continue;
        }
        if (rowText.includes('采购单号') || rowText.includes('PO')) {
            var match3 = rowText.match(/(?:采购单号|PO)[：:]\s*([A-Za-z0-9\-]{6,20})/i);
            if (match3) result.orderNo = match3[1].trim();
            continue;
        }
        if (rowText.includes('订购日期') || rowText.includes('日期')) {
            var match4 = rowText.match(/(?:订购日期|日期)[：:]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
            if (match4) { result.orderDate = match4[1] + '-' + String(parseInt(match4[2])).padStart(2, '0') + '-' + String(parseInt(match4[3])).padStart(2, '0'); }
            continue;
        }
        if (rowText.includes('交货日期') || rowText.includes('交期')) {
            var match5 = rowText.match(/(?:交货日期|交期)[：:]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
            if (match5) { result.deliveryDate = match5[1] + '-' + String(parseInt(match5[2])).padStart(2, '0') + '-' + String(parseInt(match5[3])).padStart(2, '0'); }
            continue;
        }
    }

    var tableStart = -1;
    for (var j = 0; j < rows.length; j++) {
        var row2 = rows[j];
        if (!row2 || row2.length === 0) continue;
        var rowStr2 = row2.map(function(c) { return c !== undefined && c !== null ? String(c) : ''; }).join(' ');
        if (rowStr2.includes('序号') && rowStr2.includes('物料编码') && rowStr2.includes('物料名称')) {
            tableStart = j;
            break;
        }
    }

    if (tableStart === -1) {
        for (var j2 = 0; j2 < rows.length; j2++) {
            var row3 = rows[j2];
            if (!row3 || row3.length === 0) continue;
            var rowStr3 = row3.map(function(c) { return c !== undefined && c !== null ? String(c) : ''; }).join(' ');
            if (rowStr3.includes('产品编码') && rowStr3.includes('产品名称') && rowStr3.includes('数量')) {
                tableStart = j2;
                break;
            }
        }
    }

    if (tableStart !== -1) {
        var rawText = '';
        for (var k = tableStart + 1; k < rows.length; k++) {
            var row4 = rows[k];
            if (!row4 || row4.length === 0) continue;
            var rowStr4 = row4.map(function(c) { return c !== undefined && c !== null ? String(c) : ''; }).join(' ');
            if (rowStr4.includes('合计') || rowStr4.includes('合同条款')) { break; }
            var cells = row4.filter(function(c) { return c !== undefined && c !== null && String(c).trim() !== ''; }).map(function(c) { return String(c).trim(); });
            if (cells.length) { rawText += cells.join(' ') + ' '; }
        }
        rawText = rawText.replace(/\s+/g, ' ').trim();

        var code = '';
        var codeMatch = rawText.match(/(10-)?([A-Za-z0-9]+[-][A-Za-z0-9]+[-][A-Za-z0-9]+)/);
        if (codeMatch) {
            var full = codeMatch[0];
            if (full.startsWith('10-')) {
                var parts4 = full.split('-');
                if (parts4.length === 4 && parts4[3].length < 3) {
                    var rest = rawText.substring(rawText.indexOf(full) + full.length);
                    var extra = rest.match(/\b(\d{1,4})\b/);
                    if (extra) full = full + extra[1];
                }
            }
            if (full.length < 12) {
                var altMatch = rawText.match(/[A-Za-z0-9]+[-][A-Za-z0-9]+[-][A-Za-z0-9]{2,}/);
                if (altMatch && altMatch[0].length > full.length) full = altMatch[0];
            }
            code = full;
        }
        if (!code) {
            var alt2 = rawText.match(/[A-Za-z0-9]{2,}[-][A-Za-z0-9]{2,}[-][A-Za-z0-9]{2,}/);
            if (alt2) code = alt2[0];
        }
        result.productCode = code;
        if (code) result.customerCode = extractCustomerCodeFromProductCode(code);

        if (code) {
            var idx = rawText.indexOf(code);
            var remaining = rawText.substring(idx + code.length).trim();
            remaining = remaining.replace(/^\d*\s*/, '');
            var specKeywords = ['三折', '侧吸', '电压', '皮套', '壳', 'PC', 'TPU', '肤感', '仿超', '贴'];
            var specStart = -1;
            for (var kwIdx = 0; kwIdx < specKeywords.length; kwIdx++) {
                var pos = remaining.indexOf(specKeywords[kwIdx]);
                if (pos !== -1 && (specStart === -1 || pos < specStart)) specStart = pos;
            }
            if (specStart !== -1) {
                var namePart = remaining.substring(0, specStart).trim();
                namePart = namePart.replace(/\d+\s*$/, '').trim();
                if (namePart.length > 2) result.productName = namePart;
                var specPart = remaining.substring(specStart).trim();
                specPart = specPart.replace(/\d+\s*$/, '').trim();
                specPart = specPart.replace(/\s*个\s*$/, '').trim();
                if (specPart.length > 3) result.spec = specPart;
            } else {
                var namePart2 = remaining;
                namePart2 = namePart2.replace(/\d+\s*$/, '').trim();
                if (namePart2.length > 2) result.productName = namePart2;
            }
        }

        var qtyMatch = rawText.match(/\b(\d{2,6})\s*(?:个|件|PCS|pcs|$)/i);
        if (qtyMatch) { result.qty = qtyMatch[1]; } else {
            var nums = rawText.match(/\b(\d{2,6})\b/g);
            if (nums) {
                var candidates = nums.map(Number).filter(function(n) { return n >= 10 && n <= 99999 && !(n >= 2024 && n <= 2030); });
                if (candidates.length > 0) result.qty = String(Math.max.apply(null, candidates));
            }
        }

        var colorList = ['天蓝色', '玫红色', '玫瑰金', '深蓝色', '浅蓝色', '天蓝', '玫红', '深蓝', '浅蓝', '红色', '绿色', '蓝色', '黑色', '白色', '灰色', '紫色', '粉色', '橙色', '黄色', '深灰', '星光', '米色', '干邑', '金色', '银色'];
        var sortedColors = colorList.slice().sort(function(a, b) { return b.length - a.length; });
        var colorRegex = new RegExp(sortedColors.join('|'));
        var colorMatch = null;
        if (result.spec) { var m1 = result.spec.match(colorRegex); if (m1) colorMatch = m1[0]; }
        if (!colorMatch && result.productName) { var m2 = result.productName.match(colorRegex); if (m2) colorMatch = m2[0]; }
        if (!colorMatch) { var m3 = rawText.match(colorRegex); if (m3) colorMatch = m3[0]; }
        result.color = colorMatch || '';
    }
    return result;
}

function parseContractExcelBatch(rows) {
    var result = {
        partyName: '',
        partyAddress: '',
        partyContact: '',
        orderNo: '',
        orderDate: '',
        deliveryDate: '',
        items: []
    };

    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (!row || row.length === 0) continue;
        var rowStr = row.map(function(c) { return c !== undefined && c !== null ? String(c) : ''; }).join(' ');
        var rowText = rowStr.trim();

        if (rowText.includes('甲方(需方)') || rowText.includes('甲方（需方）')) {
            var fullText = rowText.replace(/\s+/g, ' ');
            var match = fullText.match(/甲方[（(]需方[)）][：:]\s*([^\n\r,，。]{2,40})/);
            if (match) result.partyName = match[1].trim();
            var addrMatch = fullText.match(/地址[：:]\s*([^\n\r,，。]{2,50})/);
            if (addrMatch) result.partyAddress = addrMatch[1].trim();
            var contactMatch = fullText.match(/联系人[：:]\s*([^\n\r,，。]{2,20})/);
            if (contactMatch) result.partyContact = contactMatch[1].trim();
            continue;
        }
        if (rowText.includes('订单编号') || rowText.includes('采购单号')) {
            var match2 = rowText.match(/(?:订单编号|采购单号)[：:]\s*([A-Za-z0-9\-]{6,20})/);
            if (match2) result.orderNo = match2[1].trim();
            continue;
        }
        if (rowText.includes('交货日期')) {
            var match3 = rowText.match(/交货日期[：:]\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
            if (match3) {
                result.deliveryDate = match3[1] + '-' + String(parseInt(match3[2])).padStart(2, '0') + '-' + String(parseInt(match3[3])).padStart(2, '0');
            }
            continue;
        }
        if (rowText.includes('采购日期') || rowText.includes('订购日期')) {
            var match4 = rowText.match(/(?:采购日期|订购日期)[：:]\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
            if (match4) {
                result.orderDate = match4[1] + '-' + String(parseInt(match4[2])).padStart(2, '0') + '-' + String(parseInt(match4[3])).padStart(2, '0');
            }
        }
    }

    var tableStart = -1;
    var headerRow = null;
    for (var j = 0; j < rows.length; j++) {
        var row2 = rows[j];
        if (!row2 || row2.length === 0) continue;
        var rowStr2 = row2.map(function(c) { return c !== undefined && c !== null ? String(c) : ''; }).join(' ');
        if (rowStr2.includes('产品编码') && rowStr2.includes('产品名称') && rowStr2.includes('数量')) {
            tableStart = j;
            headerRow = row2;
            break;
        }
        if (rowStr2.includes('序号') && rowStr2.includes('物料编码') && rowStr2.includes('规格型号')) {
            tableStart = j;
            headerRow = row2;
            break;
        }
    }

    if (tableStart === -1) {
        return result;
    }

    var colMap = {};
    if (headerRow) {
        for (var ci = 0; ci < headerRow.length; ci++) {
            var val = (headerRow[ci] || '').trim();
            if (val.includes('产品编码') || val === '编码') colMap['productCode'] = ci;
            else if (val.includes('产品名称') || val === '名称') colMap['productName'] = ci;
            else if (val.includes('规格型号') || val === '规格') colMap['spec'] = ci;
            else if (val.includes('数量') || val === 'Qty') colMap['qty'] = ci;
            else if (val.includes('单位')) colMap['unit'] = ci;
            else if (val.includes('含税') || val.includes('单价')) colMap['price'] = ci;
            else if (val.includes('金额')) colMap['amount'] = ci;
            else if (val.includes('备注')) colMap['remark'] = ci;
            else if (val.includes('颜色')) colMap['color'] = ci;
        }
    }

    var items = [];
    for (var k = tableStart + 1; k < rows.length; k++) {
        var row3 = rows[k];
        if (!row3 || row3.length === 0) continue;
        var rowStr3 = row3.map(function(c) { return c !== undefined && c !== null ? String(c) : ''; }).join(' ');
        if (rowStr3.includes('合计') || rowStr3.includes('合计：')) break;
        if (rowStr3.trim() === '' || rowStr3 === 'nan') continue;

        var productCode = colMap['productCode'] !== undefined ? String(row3[colMap['productCode']] || '').trim() : '';
        var productName = colMap['productName'] !== undefined ? String(row3[colMap['productName']] || '').trim() : '';
        var spec = colMap['spec'] !== undefined ? String(row3[colMap['spec']] || '').trim() : '';
        var qty = colMap['qty'] !== undefined ? parseInt(row3[colMap['qty']]) || 0 : 0;
        var remark = colMap['remark'] !== undefined ? String(row3[colMap['remark']] || '').trim() : '';
        var color = colMap['color'] !== undefined ? String(row3[colMap['color']] || '').trim() : '';

        if (!productCode && !productName) continue;
        if (qty <= 0) continue;

        if (!color && productName) {
            var colorMatch = productName.match(/(深绿|黑色|砂粉色|薰衣草紫色|紫色|深蓝色|白冰蓝|灰色|红色|蓝色|绿色|黄色|粉色|白色|深灰|浅灰|米色|干邑|玫瑰金|星光色)/);
            if (colorMatch) color = colorMatch[1];
        }

        var stamp = '';
        if (spec) {
            var stampMatch = spec.match(/logo\s*\(([^)]+)\)/);
            if (stampMatch) stamp = stampMatch[1];
            var stampMatch2 = spec.match(/内部压印logo\s*\(([^)]+)\)/);
            if (stampMatch2) stamp = stampMatch2[1];
        }

        items.push({
            productCode: productCode,
            productName: productName,
            spec: spec,
            qty: qty,
            color: color,
            stamp: stamp,
            remark: remark
        });
    }

    result.items = items;
    return result;
}

function displayExcelResult(result) {
    var container = document.getElementById('excelResultContent');
    var html = '<table class="table table-sm"><thead><tr><th>字段</th><th>值</th></tr></thead><tbody>';
    var fields = [
        { key: 'partyName', label: '客户名称' },
        { key: 'partyAddress', label: '客户地址' },
        { key: 'partyContact', label: '联系人' },
        { key: 'partyFormNo', label: '表单编号' },
        { key: 'orderNo', label: '采购单号' },
        { key: 'orderDate', label: '订购日期' },
        { key: 'deliveryDate', label: '交货日期' },
        { key: 'productCode', label: '物料编码' },
        { key: 'customerCode', label: '客户号' },
        { key: 'productName', label: '产品名称' },
        { key: 'spec', label: '规格型号' },
        { key: 'qty', label: '数量' },
        { key: 'color', label: '颜色' }
    ];
    var hasData = false;
    for (var f = 0; f < fields.length; f++) {
        if (result[fields[f].key]) {
            html += '<tr><td><strong>' + fields[f].label + '</strong></td><td>' + result[fields[f].key] + '</td></tr>';
            hasData = true;
        }
    }
    if (!hasData) html += '<tr><td colspan="2" class="text-muted">未能解析到有效数据</td></tr>';
    html += '</tbody></table>';
    container.innerHTML = html;
    document.getElementById('excelParseResult').style.display = 'block';
    var batchBtn = document.getElementById('batchImportBtn');
    if (batchBtn) batchBtn.style.display = 'block';
}

function displayExcelResultBatch(result) {
    var container = document.getElementById('excelResultContent');
    var html = '<div style="margin-bottom:8px;"><strong>📋 共解析到 ' + result.items.length + ' 个产品明细</strong></div>';
    html += '<div style="max-height:200px;overflow-y:auto;border:1px solid #e9edf2;border-radius:6px;padding:4px 0;">';
    html += '<table style="font-size:12px;width:100%;border-collapse:collapse;">';
    html += '<thead><tr style="background:#f0f4f8;">';
    html += '<th style="padding:2px 6px;text-align:left;border-bottom:1px solid #ddd;">#</th>';
    html += '<th style="padding:2px 6px;text-align:left;border-bottom:1px solid #ddd;">产品编码</th>';
    html += '<th style="padding:2px 6px;text-align:left;border-bottom:1px solid #ddd;">产品名称</th>';
    html += '<th style="padding:2px 6px;text-align:center;border-bottom:1px solid #ddd;">数量</th>';
    html += '</tr></thead><tbody>';
    result.items.slice(0, 30).forEach(function(item, index) {
        html += '<tr>';
        html += '<td style="padding:2px 6px;border-bottom:1px solid #eee;">' + (index + 1) + '</td>';
        html += '<td style="padding:2px 6px;border-bottom:1px solid #eee;font-family:monospace;font-size:11px;">' + (item.productCode || '-') + '</td>';
        html += '<td style="padding:2px 6px;border-bottom:1px solid #eee;">' + (item.productName || '-') + '</td>';
        html += '<td style="padding:2px 6px;border-bottom:1px solid #eee;text-align:center;font-weight:600;">' + (item.qty || 0) + '</td>';
        html += '</tr>';
    });
    if (result.items.length > 30) {
        html += '<tr><td colspan="4" style="padding:4px 6px;text-align:center;color:#999;font-size:11px;">... 还有 ' + (result.items.length - 30) + ' 个</td></tr>';
    }
    html += '</tbody></table></div>';
    var totalQty = result.items.reduce(function(sum, item) { return sum + (item.qty || 0); }, 0);
    html += '<div style="margin-top:6px;font-size:12px;color:#6c7a8a;">';
    html += '👤 客户：' + (result.partyName || '未识别') + ' | ';
    html += '📋 订单号：' + (result.orderNo || '自动生成') + ' | ';
    html += '📦 总数量：' + totalQty;
    html += '</div>';
    container.innerHTML = html;
    document.getElementById('excelParseResult').style.display = 'block';
    var batchBtn = document.getElementById('batchImportBtn');
    if (batchBtn) batchBtn.style.display = 'block';
}

function applyExcelResult() {
    if (!excelParsedData) { alert('请先上传并解析Excel'); return; }
    
    if (excelParsedData.items && excelParsedData.items.length > 1) {
        if (!confirm('检测到 ' + excelParsedData.items.length + ' 个产品明细，是否使用批量导入？\n点击"确定"批量导入，点击"取消"只导入第一个产品')) {
            var firstItem = excelParsedData.items[0];
            var singleData = {
                partyName: excelParsedData.partyName,
                partyAddress: excelParsedData.partyAddress,
                partyContact: excelParsedData.partyContact,
                orderNo: excelParsedData.orderNo,
                orderDate: excelParsedData.orderDate,
                deliveryDate: excelParsedData.deliveryDate,
                productCode: firstItem.productCode,
                productName: firstItem.productName,
                spec: firstItem.spec,
                qty: firstItem.qty,
                color: firstItem.color,
                customerCode: extractCustomerCodeFromProductCode(firstItem.productCode)
            };
            applySingleExcelResult(singleData);
            var excelModal2 = bootstrap.Modal.getInstance(document.getElementById('excelImportModal'));
            if (excelModal2) excelModal2.hide();
            return;
        } else {
            applyExcelResultBatch();
            return;
        }
    }
    
    var r = excelParsedData;
    var excelModal = bootstrap.Modal.getInstance(document.getElementById('excelImportModal'));
    if (excelModal) excelModal.hide();
    var orderModal = new bootstrap.Modal(document.getElementById('orderModal'));
    orderModal.show();

    applySingleExcelResult(r);
}

function applySingleExcelResult(r) {
    var partyNameInput = document.getElementById('ordPartyName');
    var partyContactInput = document.getElementById('ordPartyContact');
    if (partyNameInput && r.partyName) partyNameInput.value = r.partyName;
    if (partyContactInput && r.partyContact) partyContactInput.value = r.partyContact;
    if (r.partyName || r.partyContact) {
        window._excelExtraData = { partyName: r.partyName || '', partyContact: r.partyContact || '' };
        var remark = document.getElementById('ordRemark').value || '';
        if (remark) remark += ' ';
        remark += '客户:' + r.partyName + ' 联系人:' + r.partyContact;
        document.getElementById('ordRemark').value = remark;
    }
    if (r.customerCode) document.getElementById('ordCustomerCode').value = r.customerCode;
    if (r.orderNo) document.getElementById('ordOrderNo').value = r.orderNo;
    if (r.orderDate) document.getElementById('ordOrderDate').value = r.orderDate;
    if (r.deliveryDate) document.getElementById('ordDeliveryDate').value = r.deliveryDate;
    if (r.productCode) document.getElementById('ordProductCode').value = r.productCode;
    if (r.productName) document.getElementById('ordProductName').value = r.productName;
    if (r.spec) document.getElementById('ordSpec').value = r.spec;
    if (r.qty) document.getElementById('ordQty').value = r.qty;
    if (r.color) document.getElementById('ordColor').value = r.color;
    if (!document.getElementById('ordOrderDate').value) {
        document.getElementById('ordOrderDate').value = new Date().toISOString().slice(0, 10);
    }
    if (!document.getElementById('ordDeliveryDate').value) {
        var d = new Date();
        d.setDate(d.getDate() + 7);
        document.getElementById('ordDeliveryDate').value = d.toISOString().slice(0, 10);
    }
}

function applyExcelResultBatch() {
    if (!excelParsedData || !excelParsedData.items || excelParsedData.items.length === 0) {
        alert('请先上传并解析Excel，未解析到有效数据');
        return;
    }

    var parsedData = excelParsedData;
    var items = parsedData.items;

    if (items.length === 0) {
        alert('未解析到物料明细');
        return;
    }

    var previewMsg = '📋 共解析到 ' + items.length + ' 个产品明细\n\n';
    previewMsg += '客户：' + (parsedData.partyName || '未识别') + '\n';
    previewMsg += '订单号：' + (parsedData.orderNo || '自动生成') + '\n';
    previewMsg += '交货日期：' + (parsedData.deliveryDate || '未指定') + '\n\n';
    previewMsg += '前5个产品：\n';
    items.slice(0, 5).forEach(function(item, idx) {
        previewMsg += (idx + 1) + '. ' + (item.productCode || '无编码') + ' - ' + (item.productName || '无名称') + ' x' + (item.qty || 0) + '\n';
    });
    if (items.length > 5) {
        previewMsg += '... 还有 ' + (items.length - 5) + ' 个\n';
    }
    previewMsg += '\n确认批量创建订单？';
    if (!confirm(previewMsg)) return;

    var excelModal = bootstrap.Modal.getInstance(document.getElementById('excelImportModal'));
    if (excelModal) excelModal.hide();

    var createdCount = 0;
    var failedCount = 0;
    var baseOrderNo = parsedData.orderNo || ('PO' + new Date().toISOString().slice(0,10).replace(/-/g,'') + String(Date.now()).slice(-4));

    if (baseOrderNo.indexOf('-') === -1) {
        baseOrderNo = baseOrderNo + '-01';
    }

    if (typeof showToast === 'function') {
        showToast('⏳ 正在批量创建 ' + items.length + ' 个订单...', 'info');
    }

    var promises = [];
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var index = i;

        var subNumber = String(index + 1).padStart(2, '0');
        var baseWithoutSub = baseOrderNo.replace(/-\d{2}$/, '');
        var orderNo = baseWithoutSub + '-' + subNumber;

        var customerCode = item.customerCode || '';
        if (!customerCode && item.productCode) {
            customerCode = extractCustomerCodeFromProductCode(item.productCode) || '';
        }
        if (!customerCode && item.productName) {
            var nameMatch = item.productName.match(/^(\d{4})/);
            if (nameMatch) customerCode = nameMatch[1];
        }
        if (!customerCode) customerCode = '5409';

        var cleanSpec = (item.spec || '').replace(/^"|"$/g, '').replace(/\\"/g, '"');
        var cleanColor = (item.color || '').replace(/^"|"$/g, '').replace(/\\"/g, '"');
        var cleanStamp = (item.stamp || '').replace(/^"|"$/g, '').replace(/\\"/g, '"');
        var cleanPartyName = (parsedData.partyName || '').replace(/^"|"$/g, '').replace(/\\"/g, '"');
        var cleanPartyAddress = (parsedData.partyAddress || '').replace(/^"|"$/g, '').replace(/\\"/g, '"');
        var cleanPartyContact = (parsedData.partyContact || '').replace(/^"|"$/g, '').replace(/\\"/g, '"');

        var extraData = {
            spec: cleanSpec,
            color: cleanColor,
            stamp: cleanStamp,
            materialBoard: '',
            materialShell: '',
            boardCode: '',
            shellStock: '',
            partyName: cleanPartyName,
            partyAddress: cleanPartyAddress,
            partyContact: cleanPartyContact,
            partyFormNo: '',
            syncToPurchase: true,
            progress: 0,
            qualityStatus: '未质检',
            shipmentStatus: '待出货',
            source: 'production',
            outsourceStatus: '',
            outsourceLocation: '',
            customFields: {},
            deliveryHistory: [],
            deliveredQty: 0,
            remainingQty: item.qty || 0,
            shipmentSchedule: '',
            purchase: { orders: [], remark: '' }
        };

        var requestBody = {
            order_no: orderNo,
            customer_code: customerCode,
            product_code: item.productCode || '',
            product_name: item.productName || '',
            qty: item.qty || 0,
            order_date: parsedData.orderDate || new Date().toISOString().slice(0, 10),
            delivery_date: parsedData.deliveryDate || '',
            remark: item.remark || '',
            status: '待生产',
            extra: JSON.stringify(extraData)
        };

        console.log('📤 创建订单:', orderNo, '产品:', item.productName);

        var promise = fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        })
        .then(function(response) {
            if (!response.ok) {
                return response.text().then(function(text) {
                    console.error('❌ 响应错误:', text);
                    throw new Error(text || '创建失败');
                });
            }
            return response.json();
        })
        .then(function(created) {
            var parsed = typeof window.parseExtraFields === 'function' 
                ? window.parseExtraFields(created) 
                : created;
            data.orders.push(parsed);
            createdCount++;
            console.log('✅ 订单创建成功:', orderNo);
        })
        .catch(function(err) {
            failedCount++;
            console.error('❌ 订单创建失败:', orderNo, err.message);
        });

        promises.push(promise);
    }

    Promise.all(promises)
        .then(function() {
            if (typeof window.saveDataToStorage === 'function') {
                window.saveDataToStorage();
            }
            
            setTimeout(function() {
                try {
                    if (typeof window.renderOrders === 'function') {
                        window.renderOrders();
                    }
                    var badge = document.getElementById('orderBadge');
                    if (badge) badge.textContent = data.orders.length;
                } catch (e) {
                    console.warn('刷新订单列表失败:', e);
                }
            }, 300);

            if (failedCount === 0) {
                var msg = '✅ 批量导入完成！成功创建 ' + createdCount + ' 个订单';
                if (typeof showToast === 'function') {
                    showToast(msg, 'success');
                } else {
                    alert(msg);
                }
            } else {
                var msg2 = '⚠️ 批量导入完成，' + failedCount + ' 个订单创建失败，成功 ' + createdCount + ' 个';
                if (typeof showToast === 'function') {
                    showToast(msg2, 'warning');
                } else {
                    alert(msg2);
                }
            }
            excelParsedData = null;

            // ★★★ 1.5秒后自动刷新页面 ★★★
            setTimeout(function() {
                location.reload();
            }, 1500);
        })
        .catch(function(err) {
            var errMsg = '❌ 批量导入失败：' + err.message;
            if (typeof showToast === 'function') {
                showToast(errMsg, 'error');
            } else {
                alert(errMsg);
            }
        });
}

function clearExcelResult() {
    document.getElementById('excelFileInput').value = '';
    document.getElementById('excelParseResult').style.display = 'none';
    excelParsedData = null;
    var batchBtn = document.getElementById('batchImportBtn');
    if (batchBtn) batchBtn.style.display = 'none';
}

function openExcelImport() {
    document.getElementById('excelFileInput').value = '';
    document.getElementById('excelParseResult').style.display = 'none';
    excelParsedData = null;

    var modalBody = document.querySelector('#excelImportModal .modal-body');
    if (modalBody) {
        var existingBtn = document.getElementById('batchImportBtn');
        if (!existingBtn) {
            var btnDiv = document.createElement('div');
            btnDiv.id = 'batchImportBtn';
            btnDiv.className = 'mt-3';
            btnDiv.innerHTML = '<button class="btn btn-success" onclick="applyExcelResultBatch()" id="batchImportBtnClick"><i class="bi bi-list-ul"></i> 批量导入所有物料</button>';
            var parseResult = document.getElementById('excelParseResult');
            if (parseResult) {
                modalBody.insertBefore(btnDiv, parseResult.nextSibling);
            } else {
                modalBody.appendChild(btnDiv);
            }
        }
    }

    var input = document.getElementById('excelFileInput');
    if (input) {
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var dataBytes = new Uint8Array(ev.target.result);
                    var workbook = XLSX.read(dataBytes, { type: 'array' });
                    var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    var json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                    var batchResult = parseContractExcelBatch(json);
                    if (batchResult.items && batchResult.items.length > 0) {
                        excelParsedData = batchResult;
                        displayExcelResultBatch(batchResult);
                    } else {
                        var singleResult = parseContractExcel(json);
                        if (singleResult && (singleResult.partyName || singleResult.orderNo || singleResult.productName || singleResult.qty)) {
                            excelParsedData = singleResult;
                            displayExcelResult(singleResult);
                        } else {
                            alert('未能解析出有效信息，请确认文件格式');
                        }
                    }
                } catch(err) {
                    alert('Excel解析失败：' + err.message);
                }
            };
            reader.readAsArrayBuffer(file);
        };
    }

    new bootstrap.Modal(document.getElementById('excelImportModal')).show();
}

// ============================================================
//  粘贴解析
// ============================================================

function extractOrderInfoFromText(text) {
    var result = { productCode: '', productName: '', spec: '', qty: '', color: '', orderNo: '', partyName: '', partyContact: '', orderDate: '', deliveryDate: '', customerCode: '' };

    var partyMatch = text.match(/甲方[（(]需方[)）][：:]\s*([^\n\r,，。]{2,30})/);
    if (partyMatch) result.partyName = partyMatch[1].trim();
    var contactMatch = text.match(/联系人[：:]\s*([^\n\r,，。]{2,10})/);
    if (contactMatch) result.partyContact = contactMatch[1].trim();

    var orderMatch = text.match(/(?:采购单号|订单号|PO)[：:]\s*([A-Za-z0-9\-]{6,20})/i);
    if (orderMatch && !/^(YP-|FM-|CG-)/i.test(orderMatch[1])) { result.orderNo = orderMatch[1].trim(); }

    var dateMatch = text.match(/(?:订购日期|日期)[：:]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (dateMatch) { result.orderDate = dateMatch[1] + '-' + String(parseInt(dateMatch[2])).padStart(2, '0') + '-' + String(parseInt(dateMatch[3])).padStart(2, '0'); }

    var delivMatch = text.match(/(?:交货日期|交期)[：:]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (delivMatch) { result.deliveryDate = delivMatch[1] + '-' + String(parseInt(delivMatch[2])).padStart(2, '0') + '-' + String(parseInt(delivMatch[3])).padStart(2, '0'); }

    var productCode = '';
    var codeDirect = text.match(/(?:物料编码|编码)[：:]\s*([A-Za-z0-9\-]{6,})/i);
    if (codeDirect) productCode = codeDirect[1].trim();

    if (!productCode || productCode.length < 12) {
        var allFragments = [];
        var fragmentRegex = /([A-Za-z]{2,}[-]?\d{2,}[-]?\d{2,}[-]?\d{0,2})/g;
        var match;
        while ((match = fragmentRegex.exec(text)) !== null) {
            var fragment = match[1];
            if (/^(YP-FM|FM-CG|YP-|FM-|CG-)/i.test(fragment)) continue;
            if (fragment.length < 5) continue;
            allFragments.push(fragment);
        }
        if (allFragments.length > 0) {
            var combined = '';
            for (var fi = 0; fi < allFragments.length; fi++) {
                var f = allFragments[fi];
                if (f.endsWith('-')) combined += f;
                else if (combined && combined.endsWith('-')) combined += f;
                else if (combined) combined += '-' + f;
                else combined = f;
            }
            combined = combined.replace(/--+/g, '-');
            if (combined.length > 0) productCode = combined;
        }
    }

    if (productCode) {
        result.productCode = productCode;
        result.customerCode = extractCustomerCodeFromProductCode(productCode);
    }
    return result;
}

function parsePasteText() {
    var textarea = document.getElementById('pasteText');
    var preview = document.getElementById('pasteParsePreview');
    var content = document.getElementById('pasteParseContent');
    var rawText = textarea.value.trim();
    if (!rawText) { alert('请先粘贴文字内容（可从图片OCR识别后复制）'); return; }

    var result = extractOrderInfoFromText(rawText);
    console.log('解析结果:', result);

    if (!result.productName && !result.productCode && !result.qty && !result.orderNo) {
        preview.style.display = 'block';
        content.innerHTML = '<span class="text-danger">⚠️ 未能识别出有效信息，请确认文字内容是否完整</span>';
        return;
    }

    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:14px;">';
    var fields = [
        { key: 'orderNo', label: '📋 订单号' },
        { key: 'partyName', label: '🏢 客户名称' },
        { key: 'partyContact', label: '👤 联系人' },
        { key: 'orderDate', label: '📅 下单日期' },
        { key: 'deliveryDate', label: '📅 交货日期' },
        { key: 'productCode', label: '🔢 物料编码' },
        { key: 'customerCode', label: '🏷️ 客户号' },
        { key: 'productName', label: '📦 产品名称' },
        { key: 'spec', label: '📐 规格型号' },
        { key: 'color', label: '🎨 颜色' },
        { key: 'qty', label: '🔢 数量' }
    ];
    var hasData = false;
    for (var fi2 = 0; fi2 < fields.length; fi2++) {
        if (result[fields[fi2].key]) {
            html += '<div style="padding:4px 8px;background:#f0f4f8;border-radius:4px;border-left:3px solid #0066cc;"><strong>' + fields[fi2].label + '</strong><br><span style="color:#1a2a3a;word-break:break-all;">' + result[fields[fi2].key] + '</span></div>';
            hasData = true;
        }
    }
    html += '</div>';
    if (!hasData) { html = '<span class="text-warning">未能识别到关键字段，请检查文字内容</span>'; } else {
        html += '<div class="mt-3"><button class="btn btn-sm btn-primary-custom" onclick="applyPasteResult()"><i class="bi bi-magic"></i> 填充到表单</button></div>';
    }
    preview.style.display = 'block';
    content.innerHTML = html;
    window._pasteParseResult = result;
}

function applyPasteResult() {
    var result = window._pasteParseResult;
    if (!result) { alert('请先点击"解析文字填充"按钮解析内容'); return; }
    var hasData = result.productCode || result.productName || result.qty || result.orderNo;
    if (!hasData) { alert('解析结果为空，请确认粘贴的文字内容正确'); return; }

    var partyNameInput = document.getElementById('ordPartyName');
    var partyContactInput = document.getElementById('ordPartyContact');
    if (partyNameInput && result.partyName) partyNameInput.value = result.partyName;
    if (partyContactInput && result.partyContact) partyContactInput.value = result.partyContact;
    if (result.partyName || result.partyContact) {
        window._pasteExtraData = { partyName: result.partyName || '', partyContact: result.partyContact || '' };
        var remark2 = document.getElementById('ordRemark').value || '';
        if (remark2) remark2 += ' ';
        remark2 += '客户:' + result.partyName + ' 联系人:' + result.partyContact;
        document.getElementById('ordRemark').value = remark2;
    }
    if (result.customerCode) document.getElementById('ordCustomerCode').value = result.customerCode;
    if (result.productCode) document.getElementById('ordProductCode').value = result.productCode;
    if (result.productName) document.getElementById('ordProductName').value = result.productName;
    if (result.spec) document.getElementById('ordSpec').value = result.spec;
    if (result.qty) document.getElementById('ordQty').value = result.qty;
    if (result.color) document.getElementById('ordColor').value = result.color;
    if (result.orderNo) document.getElementById('ordOrderNo').value = result.orderNo;
    if (result.orderDate) document.getElementById('ordOrderDate').value = result.orderDate;
    if (result.deliveryDate) document.getElementById('ordDeliveryDate').value = result.deliveryDate;

    if (!document.getElementById('ordOrderNo').value) {
        var now3 = new Date();
        var dateStr3 = now3.getFullYear() + String(now3.getMonth() + 1).padStart(2, '0') + String(now3.getDate()).padStart(2, '0');
        var count3 = (data.orders || []).length + 1;
        document.getElementById('ordOrderNo').value = 'PO' + dateStr3 + String(count3).padStart(4, '0');
    }
    if (!document.getElementById('ordOrderDate').value) {
        document.getElementById('ordOrderDate').value = new Date().toISOString().slice(0, 10);
    }
    if (!document.getElementById('ordDeliveryDate').value) {
        var d2 = new Date();
        d2.setDate(d2.getDate() + 7);
        document.getElementById('ordDeliveryDate').value = d2.toISOString().slice(0, 10);
    }
    document.getElementById('pasteParsePreview').style.display = 'none';
    alert('✅ 已从文字中提取信息并填充到表单，请核对后提交！');
}

// ============================================================
//  初始化
// ============================================================

function initOrders() {
    renderOrders();
    var filterKeyword = document.getElementById('filterKeyword');
    if (filterKeyword) filterKeyword.addEventListener('input', renderOrders);
}

// ============================================================
//  复选框全选、导出选中、单击高亮、底色操作
// ============================================================

function toggleAllOrdersRows() {
    var checkboxes = document.querySelectorAll('.order-checkbox');
    var allChecked = true;
    checkboxes.forEach(function(cb) {
        if (!cb.checked) allChecked = false;
    });
    checkboxes.forEach(function(cb) {
        cb.checked = !allChecked;
    });
    var headerCheckbox = document.getElementById('selectAllOrders');
    if (headerCheckbox) {
        headerCheckbox.checked = !allChecked;
    }
}

function exportSelectedOrders() {
    if (typeof XLSX === 'undefined') {
        alert('Excel 库未加载，请刷新页面后重试。');
        return;
    }
    var checkedBoxes = document.querySelectorAll('.order-checkbox:checked');
    var selectedIds = [];
    checkedBoxes.forEach(function(cb) {
        var id = parseInt(cb.dataset.orderId);
        if (!isNaN(id)) selectedIds.push(id);
    });
    if (selectedIds.length === 0) {
        alert('请先勾选需要导出的订单');
        return;
    }
    var selectedOrders = data.orders.filter(function(o) {
        return selectedIds.indexOf(o.id) !== -1;
    });
    if (selectedOrders.length === 0) {
        alert('没有可导出的数据');
        return;
    }
    exportOrdersToExcelWithData(selectedOrders);
}

function exportOrdersToExcelWithData(orderList) {
    var headers = [
        '状态', '客户号', '订单号', '产品编号', '产品名称',
        '规格型号', '颜色', '压唛', '订单数量',
        '物料-板材', '物料-机壳', '下单日期', '交货日期',
        '板材编号', '壳子库存', '进度(%)', '质检状态',
        '送货安排', '客户名称', '联系人', '备注',
        '甲方地址', '表单编号', '外发状态', '外发位置',
        '来源', '订单状态'
    ];
    var customCols = data.customColumns || [];
    var detailCustom = detailCustomFields || [];
    customCols.forEach(function(col) { headers.push(col.name); });
    detailCustom.forEach(function(c) { headers.push(c.name); });

    var rows = orderList.map(function(o) {
        var row = [
            o.status || '',
            o.customerCode || '',
            o.orderNo || '',
            o.productCode || '',
            o.productName || '',
            o.spec || '',
            o.color || '',
            o.stamp || '',
            o.qty || 0,
            o.materialBoard || '',
            o.materialShell || '',
            o.orderDate || '',
            o.deliveryDate || '',
            o.boardCode || '',
            o.shellStock || '',
            o.progress || 0,
            o.qualityStatus || '',
            o.shipmentSchedule || '',
            getCustomerShortName(o.partyName || ''),
            o.partyContact || '',
            o.remark || '',
            o.partyAddress || '',
            o.partyFormNo || '',
            o.outsourceStatus || '',
            o.outsourceLocation || '',
            o.source || '',
            o.shipmentStatus || ''
        ];
        customCols.forEach(function(col) { row.push(o.customFields[col.name] || ''); });
        detailCustom.forEach(function(c) {
            var key = 'custom_' + c.name;
            row.push(o[key] || '');
        });
        return row;
    });

    var sheetData = [headers].concat(rows);
    try {
        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.aoa_to_sheet(sheetData);
        var colWidths = headers.map(function(h, i) {
            var maxLen = h.length;
            for (var r = 0; r < rows.length; r++) {
                var cell = rows[r][i];
                if (cell !== undefined && cell !== null) {
                    var len = String(cell).length;
                    if (len > maxLen) maxLen = len;
                }
            }
            return { wch: Math.min(Math.max(maxLen * 1.2 + 2, 12), 40) };
        });
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, '订单列表');
        var dateStr = new Date().toISOString().slice(0, 10);
        var fileName = '订单导出_选中_' + dateStr + '.xlsx';
        XLSX.writeFile(wb, fileName);
        alert('✅ 成功导出 ' + rows.length + ' 条订单数据！');
    } catch (err) {
        alert('导出失败：' + err.message);
        console.error('导出错误详情：', err);
    }
}

function selectOrderRow(tr, orderId) {
    if (currentHighlightRow && currentHighlightRow !== tr) {
        var oldTds = currentHighlightRow.querySelectorAll('td');
        oldTds.forEach(function(td) {
            var orig = td._origBg;
            if (orig) td.style.backgroundColor = orig;
        });
        currentHighlightRow.style.backgroundColor = '';
        currentHighlightRow = null;
        selectedOrderRowId = null;
    }

    if (selectedOrderRowId === orderId) {
        var tds2 = tr.querySelectorAll('td');
        tds2.forEach(function(td) {
            var orig = td._origBg;
            if (orig) td.style.backgroundColor = orig;
        });
        tr.style.backgroundColor = '';
        selectedOrderRowId = null;
        currentHighlightRow = null;
        return;
    }

    var tds = tr.querySelectorAll('td');
    tds.forEach(function(td) {
        var bg = td.style.backgroundColor || getComputedStyle(td).backgroundColor;
        td._origBg = bg;
        td.style.backgroundColor = '#d0e4ff';
    });
    tr.style.backgroundColor = '#d0e4ff';
    selectedOrderRowId = orderId;
    currentHighlightRow = tr;
}

function applyOrderHighlight(color) {
    if (!orderHighlight) {
        alert('高亮功能尚未初始化，请刷新页面后重试');
        return;
    }
    orderHighlight.apply(color);
}

function clearOrderHighlight() {
    if (!orderHighlight) {
        alert('高亮功能尚未初始化，请刷新页面后重试');
        return;
    }
    var checkedBoxes = document.querySelectorAll('.order-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert('请先勾选需要清除底色的订单');
        return;
    }
    orderHighlight.clear();
}

function exportOrderDetail() {
    alert('📤 导出订单详情功能开发中');
}

// ============================================================
//  批量设置订单
// ============================================================

function openBatchSettings() {
    var checkedBoxes = document.querySelectorAll('.order-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert('请先勾选需要批量设置的订单');
        return;
    }

    var selectedIds = [];
    checkedBoxes.forEach(function(cb) {
        var id = parseInt(cb.dataset.orderId);
        if (!isNaN(id)) selectedIds.push(id);
    });

    if (selectedIds.length === 0) {
        alert('请先勾选需要批量设置的订单');
        return;
    }

    var modalId = 'batchSettingsModal';
    var existing = document.getElementById(modalId);
    if (existing) existing.remove();

    var modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header" style="background:#f0f0f8;border-bottom:2px solid #6f42c1;">
                        <h5 class="modal-title"><i class="bi bi-sliders2" style="color:#6f42c1;"></i> 批量设置订单</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
                        <div style="margin-bottom:12px;padding:8px 12px;background:#f8fafc;border-radius:8px;border:1px solid #e9edf2;">
                            <span style="font-weight:600;">已选订单：</span>
                            <span style="color:#0066cc;font-weight:700;">${selectedIds.length}</span> 个
                            <span style="font-size:12px;color:#6c7a8a;margin-left:8px;">
                                （订单号：${selectedIds.slice(0,5).map(function(id) {
                                    var order = data.orders.find(function(o) { return o.id === id; });
                                    return order ? order.orderNo : '';
                                }).filter(Boolean).join('、')}${selectedIds.length > 5 ? ' 等' : ''}）
                            </span>
                        </div>
                        <div style="font-size:13px;color:#6c7a8a;margin-bottom:12px;">
                            <i class="bi bi-info-circle"></i> 只填写需要修改的字段，留空表示不修改
                        </div>
                        <form id="batchSettingsForm">
                            <div class="row g-3">
                                <div class="col-md-4">
                                    <label class="form-label">订单状态</label>
                                    <select class="form-select" id="batchStatus">
                                        <option value="">—— 不修改 ——</option>
                                        <option value="待生产">待生产</option>
                                        <option value="生产中">生产中</option>
                                        <option value="待质检">待质检</option>
                                        <option value="待出货">待出货</option>
                                        <option value="已完成">已完成</option>
                                    </select>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">质检状态</label>
                                    <select class="form-select" id="batchQualityStatus">
                                        <option value="">—— 不修改 ——</option>
                                        <option value="未质检">未质检</option>
                                        <option value="质检中">质检中</option>
                                        <option value="质检合格">质检合格</option>
                                        <option value="质检不合格">质检不合格</option>
                                    </select>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">生产进度(%)</label>
                                    <input type="number" class="form-control" id="batchProgress" placeholder="0-100" min="0" max="100" />
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">交货日期</label>
                                    <input type="date" class="form-control" id="batchDeliveryDate" />
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">送货安排</label>
                                    <input type="date" class="form-control" id="batchShipmentSchedule" />
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">下单日期</label>
                                    <input type="date" class="form-control" id="batchOrderDate" />
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">物料-板材</label>
                                    <input type="text" class="form-control" id="batchMaterialBoard" placeholder="如：√ 或 已齐" />
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">物料-机壳</label>
                                    <input type="text" class="form-control" id="batchMaterialShell" placeholder="如：√ 或 已齐" />
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">客户名称</label>
                                    <input type="text" class="form-control" id="batchPartyName" placeholder="客户名称" />
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">联系人</label>
                                    <input type="text" class="form-control" id="batchPartyContact" placeholder="联系人" />
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label">备注</label>
                                    <textarea class="form-control" id="batchRemark" rows="2" placeholder="批量备注内容..."></textarea>
                                    <div style="margin-top:4px;font-size:12px;color:#6c7a8a;">
                                        <span class="badge bg-soft-secondary" style="cursor:pointer;" onclick="appendBatchRemark('【已质检】')">添加【已质检】</span>
                                        <span class="badge bg-soft-secondary" style="cursor:pointer;margin-left:4px;" onclick="appendBatchRemark('【已发货】')">添加【已发货】</span>
                                        <span class="badge bg-soft-secondary" style="cursor:pointer;margin-left:4px;" onclick="appendBatchRemark('【待确认】')">添加【待确认】</span>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button class="btn btn-primary-custom" onclick="confirmBatchSettings(${selectedIds.length})" style="background:#6f42c1;border-color:#6f42c1;">
                            <i class="bi bi-check-lg"></i> 确认批量设置
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var modalEl = document.getElementById(modalId);
    var modal = new bootstrap.Modal(modalEl);
    modal.show();

    window._batchSelectedIds = selectedIds;
}

function appendBatchRemark(tag) {
    var textarea = document.getElementById('batchRemark');
    if (!textarea) return;
    var current = textarea.value;
    if (current) {
        textarea.value = current + ' ' + tag;
    } else {
        textarea.value = tag;
    }
}

function confirmBatchSettings(count) {
    var ids = window._batchSelectedIds || [];
    if (ids.length === 0) {
        alert('没有选中的订单');
        return;
    }

    var updates = {};
    var hasUpdate = false;

    var status = document.getElementById('batchStatus').value;
    if (status) { updates.status = status; hasUpdate = true; }

    var qualityStatus = document.getElementById('batchQualityStatus').value;
    if (qualityStatus) { updates.qualityStatus = qualityStatus; hasUpdate = true; }

    var progress = document.getElementById('batchProgress').value;
    if (progress !== '' && progress !== null) {
        var p = parseInt(progress);
        if (!isNaN(p) && p >= 0 && p <= 100) {
            updates.progress = p;
            hasUpdate = true;
        } else if (progress !== '') {
            alert('请输入0-100之间的有效数字');
            return;
        }
    }

    var deliveryDate = document.getElementById('batchDeliveryDate').value;
    if (deliveryDate) { updates.deliveryDate = deliveryDate; hasUpdate = true; }

    var shipmentSchedule = document.getElementById('batchShipmentSchedule').value;
    if (shipmentSchedule) { updates.shipmentSchedule = shipmentSchedule; hasUpdate = true; }

    var orderDate = document.getElementById('batchOrderDate').value;
    if (orderDate) { updates.orderDate = orderDate; hasUpdate = true; }

    var materialBoard = document.getElementById('batchMaterialBoard').value.trim();
    if (materialBoard) { updates.materialBoard = materialBoard; hasUpdate = true; }

    var materialShell = document.getElementById('batchMaterialShell').value.trim();
    if (materialShell) { updates.materialShell = materialShell; hasUpdate = true; }

    var partyName = document.getElementById('batchPartyName').value.trim();
    if (partyName) { updates.partyName = partyName; hasUpdate = true; }

    var partyContact = document.getElementById('batchPartyContact').value.trim();
    if (partyContact) { updates.partyContact = partyContact; hasUpdate = true; }

    var remark = document.getElementById('batchRemark').value.trim();
    if (remark) { updates.remark = remark; hasUpdate = true; }

    if (!hasUpdate) {
        alert('请至少设置一个要修改的字段');
        return;
    }

    var fieldNames = [];
    if (updates.status) fieldNames.push('状态');
    if (updates.qualityStatus) fieldNames.push('质检状态');
    if (updates.progress !== undefined) fieldNames.push('生产进度');
    if (updates.deliveryDate) fieldNames.push('交货日期');
    if (updates.shipmentSchedule) fieldNames.push('送货安排');
    if (updates.orderDate) fieldNames.push('下单日期');
    if (updates.materialBoard) fieldNames.push('物料-板材');
    if (updates.materialShell) fieldNames.push('物料-机壳');
    if (updates.partyName) fieldNames.push('客户名称');
    if (updates.partyContact) fieldNames.push('联系人');
    if (updates.remark) fieldNames.push('备注');

    var confirmMsg = '确认对选中的 ' + ids.length + ' 个订单批量设置以下字段？\n\n';
    confirmMsg += '📋 将修改：' + fieldNames.join('、') + '\n\n';
    if (updates.status) confirmMsg += '状态 → ' + updates.status + '\n';
    if (updates.qualityStatus) confirmMsg += '质检状态 → ' + updates.qualityStatus + '\n';
    if (updates.progress !== undefined) confirmMsg += '生产进度 → ' + updates.progress + '%\n';
    if (updates.deliveryDate) confirmMsg += '交货日期 → ' + updates.deliveryDate + '\n';
    if (updates.shipmentSchedule) confirmMsg += '送货安排 → ' + updates.shipmentSchedule + '\n';
    if (updates.orderDate) confirmMsg += '下单日期 → ' + updates.orderDate + '\n';
    if (updates.materialBoard) confirmMsg += '物料-板材 → ' + updates.materialBoard + '\n';
    if (updates.materialShell) confirmMsg += '物料-机壳 → ' + updates.materialShell + '\n';
    if (updates.partyName) confirmMsg += '客户名称 → ' + updates.partyName + '\n';
    if (updates.partyContact) confirmMsg += '联系人 → ' + updates.partyContact + '\n';
    if (updates.remark) confirmMsg += '备注 → ' + updates.remark + '\n';

    if (!confirm(confirmMsg)) return;

    var updatedCount = 0;
    ids.forEach(function(id) {
        var order = data.orders.find(function(o) { return o.id === id; });
        if (!order) return;

        if (updates.status) order.status = updates.status;
        if (updates.qualityStatus) order.qualityStatus = updates.qualityStatus;
        if (updates.progress !== undefined) order.progress = updates.progress;
        if (updates.deliveryDate) order.deliveryDate = updates.deliveryDate;
        if (updates.shipmentSchedule) order.shipmentSchedule = updates.shipmentSchedule;
        if (updates.orderDate) order.orderDate = updates.orderDate;
        if (updates.materialBoard) order.materialBoard = updates.materialBoard;
        if (updates.materialShell) order.materialShell = updates.materialShell;
        if (updates.partyName) order.partyName = updates.partyName;
        if (updates.partyContact) order.partyContact = updates.partyContact;
        if (updates.remark) {
            if (order.remark) {
                order.remark = order.remark + ' ' + updates.remark;
            } else {
                order.remark = updates.remark;
            }
        }

        updatedCount++;
    });

    saveDataToStorage();

    var modalEl = document.getElementById('batchSettingsModal');
    if (modalEl) {
        var modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    renderOrders();

    document.querySelectorAll('.order-checkbox').forEach(function(cb) { cb.checked = false; });
    var headerCheckbox = document.getElementById('selectAllOrders');
    if (headerCheckbox) headerCheckbox.checked = false;

    var toastMsg = '✅ 成功批量更新 ' + updatedCount + ' 个订单';
    if (typeof showToast === 'function') {
        showToast(toastMsg, 'success');
    } else {
        alert(toastMsg);
    }
    window._batchSelectedIds = null;
}

// ★★★ 清空所有订单 ★★★
function clearAllOrders() {
    if (!confirm('⚠️ 确定要清空所有订单吗？此操作不可恢复！')) return;
    if (!confirm('再次确认：所有订单、外发记录、生产记录将被永久删除！')) return;

    fetch('/api/orders/clear', {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            // 清空本地数据
            data.orders = [];
            data.outsourceOrders = [];
            data.productions = [];
            if (typeof window.saveDataToStorage === 'function') {
                window.saveDataToStorage();
            }
            renderOrders();
            if (typeof window.updateBadges === 'function') {
                window.updateBadges();
            }
            showToast('✅ 所有订单已清空', 'success');
            // 关闭列设置模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('orderColumnSettingsModal'));
            if (modal) modal.hide();
        } else {
            showToast('❌ 清空失败: ' + (data.message || '未知错误'), 'error');
        }
    })
    .catch(error => {
        console.error('清空订单错误:', error);
        showToast('❌ 清空失败: ' + error.message, 'error');
    });
}

// ============================================================
//  ★★★ 暴露所有函数到全局 ★★★
// ============================================================

window.initOrders = initOrders;
window.renderOrders = renderOrders;
window.resetFilters = resetFilters;
window.openOrderColumnSettings = openOrderColumnSettings;
window.refreshOrderColumnSettingsList = refreshOrderColumnSettingsList;
window.moveOrderColumnUp = moveOrderColumnUp;
window.moveOrderColumnDown = moveOrderColumnDown;
window.updateOrderColumnVisibility = updateOrderColumnVisibility;
window.toggleOrderAllColumns = toggleOrderAllColumns;
window.resetOrderColumns = resetOrderColumns;
window.exportOrdersToExcel = exportOrdersToExcel;
window.saveOrder = saveOrder;
window.deleteOrder = deleteOrder;
window.openOrderDetail = openOrderDetail;
window.saveOrderDetail = saveOrderDetail;
window.renderDeliveryHistory = renderDeliveryHistory;
window.renderProductLinkSection = renderProductLinkSection;
window.pushToProduction = pushToProduction;
window.pushToOutsource = pushToOutsource;
window.batchPushToOutsource = batchPushToOutsource;
window.batchPushToProduction = batchPushToProduction;
window.showSupplierSelector = showSupplierSelector;
window.exportOrderDetail = exportOrderDetail;
window.openExcelImport = openExcelImport;
window.applyExcelResult = applyExcelResult;
window.applyExcelResultBatch = applyExcelResultBatch;
window.clearExcelResult = clearExcelResult;
window.parsePasteText = parsePasteText;
window.applyPasteResult = applyPasteResult;
window.extractOrderInfoFromText = extractOrderInfoFromText;
window.toggleDetailManage = toggleDetailManage;
window.deleteDetailField = deleteDetailField;
window.openRecoverDetailModal = openRecoverDetailModal;
window.recoverDetailFields = recoverDetailFields;
window.openAddDetailFieldModal = openAddDetailFieldModal;
window.addDetailCustomField = addDetailCustomField;
window.parseContractExcel = parseContractExcel;
window.parseContractExcelBatch = parseContractExcelBatch;
window.displayExcelResult = displayExcelResult;
window.displayExcelResultBatch = displayExcelResultBatch;
window.applySingleExcelResult = applySingleExcelResult;
window.extractCustomerCodeFromProductCode = extractCustomerCodeFromProductCode;
window.getCustomerShortName = getCustomerShortName;
window.applyProductFromSearch = applyProductFromSearch;
window.clearProductLink = clearProductLink;
window.filterProductList = filterProductList;
window.showProductDropdown = showProductDropdown;
window.hideProductDropdown = hideProductDropdown;
window.selectProduct = selectProduct;
window.getProductListData = getProductListData;
window.getProductList = getProductList;
window.previewProductCard = previewProductCard;
window.toggleAllOrdersRows = toggleAllOrdersRows;
window.exportSelectedOrders = exportSelectedOrders;
window.exportOrdersToExcelWithData = exportOrdersToExcelWithData;
window.selectOrderRow = selectOrderRow;
window.applyOrderHighlight = applyOrderHighlight;
window.clearOrderHighlight = clearOrderHighlight;
window.openBatchSettings = openBatchSettings;
window.confirmBatchSettings = confirmBatchSettings;
window.appendBatchRemark = appendBatchRemark;
window.statusBadge = statusBadge;
window.showToast = showToast;
window.clearAllOrders = clearAllOrders;

console.log('✅ orders.js 已完整加载，所有函数已暴露');