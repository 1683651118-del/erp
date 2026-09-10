// ============================================================
//  库存管理模块（完整版 · 服务器存储）
//  功能：库存列表、入库/出库（成品/板材/壳子）、流水、列设置、底色、复选框、导出
//  所有产品数据通过产品 API 操作，流水通过库存 API 操作
// ============================================================

// ★★★ 确保 showToast 存在 ★★★
if (typeof showToast === 'undefined') {
    window.showToast = function(message, type = 'success') {
        console.log('📢 [Toast]', type, message);
        alert(message);
    };
    console.warn('⚠️ showToast 未加载，已使用备用 alert 替代');
}

console.log('🔄 库存管理模块加载中...');

// ============================================================
//  列设置 - 配置常量
// ============================================================
var INVENTORY_COLUMN_ORDER_KEY = 'erp_inventory_column_order';
var INVENTORY_COLUMN_WIDTHS_KEY = 'erp_inventory_column_widths';
var INVENTORY_COLUMN_VISIBLE_KEY = 'erp_inventory_column_visible';

var inventoryColumnDefs = [
    { key: 'checkbox', label: '☑' },
    { key: 'code', label: '产品编码' },
    { key: 'name', label: '产品名称' },
    { key: 'customerCode', label: '客户号' },
    { key: 'stock', label: '当前库存' },
    { key: 'minStock', label: '最低库存' },
    { key: 'status', label: '状态' },
    { key: 'shellStock', label: '壳子库存' },
    { key: 'shellLocation', label: '壳子位置' },
    { key: 'boardStock', label: '板材库存' },
    { key: 'boardLocation', label: '板材位置' },
    { key: 'remark', label: '备注' },
    { key: 'actions', label: '操作' }
];

var defaultInventoryWidths = {
    'checkbox': 44,
    'code': 150,
    'name': 180,
    'customerCode': 80,
    'stock': 90,
    'minStock': 90,
    'status': 100,
    'shellStock': 90,
    'shellLocation': 120,
    'boardStock': 90,
    'boardLocation': 120,
    'remark': 140,
    'actions': 200
};

var defaultInventoryOrder = inventoryColumnDefs.map(function(c) { return c.key; });

var defaultInventoryVisible = {};
inventoryColumnDefs.forEach(function(c) { defaultInventoryVisible[c.key] = true; });

// ============================================================
//  列设置 - 读写函数
// ============================================================
function getInventoryColumnOrder() {
    try {
        var stored = localStorage.getItem(INVENTORY_COLUMN_ORDER_KEY);
        if (stored) {
            var order = JSON.parse(stored);
            var allKeys = inventoryColumnDefs.map(function(c) { return c.key; });
            var missingKeys = allKeys.filter(function(k) { return order.indexOf(k) === -1; });
            if (missingKeys.length > 0) {
                var newOrder = order.concat(missingKeys);
                saveInventoryColumnOrder(newOrder);
                return newOrder;
            }
            return order;
        }
    } catch (e) {}
    return defaultInventoryOrder.slice();
}

function saveInventoryColumnOrder(orderArray) {
    localStorage.setItem(INVENTORY_COLUMN_ORDER_KEY, JSON.stringify(orderArray));
}

function getInventoryColumnWidths() {
    try {
        var stored = localStorage.getItem(INVENTORY_COLUMN_WIDTHS_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) { return {}; }
}

function saveInventoryColumnWidth(colKey, width) {
    var widths = getInventoryColumnWidths();
    widths[colKey] = width;
    localStorage.setItem(INVENTORY_COLUMN_WIDTHS_KEY, JSON.stringify(widths));
}

function getInventoryColumnWidth(colKey) {
    var widths = getInventoryColumnWidths();
    return widths[colKey] || defaultInventoryWidths[colKey] || 100;
}

function getInventoryColumnVisible() {
    try {
        var stored = localStorage.getItem(INVENTORY_COLUMN_VISIBLE_KEY);
        if (stored) {
            var visible = JSON.parse(stored);
            inventoryColumnDefs.forEach(function(c) {
                if (visible[c.key] === undefined) visible[c.key] = true;
            });
            return visible;
        }
    } catch (e) {}
    var defaultVisible = {};
    inventoryColumnDefs.forEach(function(c) { defaultVisible[c.key] = true; });
    return defaultVisible;
}

function saveInventoryColumnVisible(visibleObj) {
    localStorage.setItem(INVENTORY_COLUMN_VISIBLE_KEY, JSON.stringify(visibleObj));
}

// ============================================================
//  高亮管理 - 延迟初始化
// ============================================================
var inventoryHighlight = null;

// ============================================================
//  列宽拖拽初始化
// ============================================================
function initInventoryColumnResize() {
    var table = document.querySelector('#inventoryList table');
    if (!table) return;
    var oldHandles = table.querySelectorAll('.col-resize-handle');
    oldHandles.forEach(function(h) { h.remove(); });
    var headers = table.querySelectorAll('thead th');
    var dragData = null;
    var ghostLine = null;

    if (!document.getElementById('colResizeGhost')) {
        ghostLine = document.createElement('div');
        ghostLine.id = 'colResizeGhost';
        ghostLine.className = 'col-resize-ghost';
        document.body.appendChild(ghostLine);
    } else {
        ghostLine = document.getElementById('colResizeGhost');
    }

    headers.forEach(function(th, index) {
        var colKey = th.dataset.col;
        if (!colKey) return;
        if (colKey === 'checkbox') return;

        var savedWidth = getInventoryColumnWidth(colKey);
        if (savedWidth) {
            th.style.width = savedWidth + 'px';
            th.style.minWidth = savedWidth + 'px';
            var colIndex = index;
            table.querySelectorAll('tbody tr').forEach(function(row) {
                var td = row.querySelectorAll('td')[colIndex];
                if (td) {
                    td.style.width = savedWidth + 'px';
                    td.style.minWidth = savedWidth + 'px';
                }
            });
        }

        var handle = document.createElement('div');
        handle.className = 'col-resize-handle';
        handle.dataset.index = index;
        handle.dataset.col = colKey;
        handle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var tableEl = this.closest('table');
            var colIndex = parseInt(this.dataset.index);
            var colKey = this.dataset.col;
            var thEl = tableEl.querySelectorAll('thead th')[colIndex];
            var startX = e.clientX;
            var startWidth = thEl.offsetWidth;

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
        var delta = e.clientX - dragData.startX;
        var newWidth = dragData.startWidth + delta;
        newWidth = Math.max(40, newWidth);
        newWidth = Math.min(350, newWidth);

        dragData.thEl.style.width = newWidth + 'px';
        dragData.thEl.style.minWidth = newWidth + 'px';

        var tableEl = dragData.thEl.closest('table');
        var colIndex = dragData.colIndex;
        tableEl.querySelectorAll('tbody tr').forEach(function(row) {
            var td = row.querySelectorAll('td')[colIndex];
            if (td) {
                td.style.width = newWidth + 'px';
                td.style.minWidth = newWidth + 'px';
            }
        });

        ghostLine.style.left = e.clientX + 'px';
    }

    function onMouseUp(e) {
        if (!dragData) return;
        var newWidth = dragData.thEl.offsetWidth;
        saveInventoryColumnWidth(dragData.colKey, newWidth);

        document.body.classList.remove('resizing');
        if (dragData.handle) {
            dragData.handle.classList.remove('dragging');
        }
        ghostLine.classList.remove('visible');

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        dragData = null;

        renderInventory();
    }
}

// ============================================================
//  列设置 - 模态框
// ============================================================

function openInventoryColumnSettings() {
    var content = document.getElementById('inventoryColumnSettingsContent');
    if (!content) return;

    var order = getInventoryColumnOrder();
    var visible = getInventoryColumnVisible();

    var html = '<div class="mb-2"><strong>调整列顺序（点击 ↑↓ 移动）</strong></div>';
    html += '<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="inventory_col_all" onchange="toggleInventoryAllColumns(this.checked)"><label class="form-check-label" for="inventory_col_all">全选</label></div>';
    html += '<div id="inventoryColumnSortableList" class="list-group">';

    order.forEach(function(key) {
        var col = inventoryColumnDefs.find(function(c) { return c.key === key; });
        if (!col) return;
        var isCheckbox = key === 'checkbox';
        var checked = (visible[key] !== false) ? 'checked' : '';
        var disabledAttr = isCheckbox ? 'disabled' : '';
        html += '<div class="list-group-item d-flex align-items-center justify-content-between" data-key="' + key + '" style="padding:6px 12px;">';
        html += '<div class="d-flex align-items-center gap-2">';
        html += '<input type="checkbox" class="form-check-input inventory-col-check" data-col="' + key + '" ' + checked + ' ' + disabledAttr + ' onchange="updateInventoryColumnVisibility()">';
        html += '<span style="font-weight:500;">' + col.label + '</span>';
        if (isCheckbox) html += '<span class="text-muted" style="font-size:11px;">（固定）</span>';
        html += '</div>';
        html += '<div>';
        html += '<button class="btn btn-sm btn-outline-secondary" onclick="moveInventoryColumnUp(\'' + key + '\')" title="上移">↑</button>';
        html += '<button class="btn btn-sm btn-outline-secondary" onclick="moveInventoryColumnDown(\'' + key + '\')" title="下移">↓</button>';
        html += '</div>';
        html += '</div>';
    });

    html += '</div>';
    content.innerHTML = html;

    var modal = new bootstrap.Modal(document.getElementById('inventoryColumnSettingsModal'));
    modal.show();
}

function refreshInventoryColumnSettingsList() {
    var container = document.getElementById('inventoryColumnSortableList');
    if (!container) return;
    var order = getInventoryColumnOrder();
    var visible = getInventoryColumnVisible();
    var html = '';

    order.forEach(function(key) {
        var col = inventoryColumnDefs.find(function(c) { return c.key === key; });
        if (!col) return;
        var isCheckbox = key === 'checkbox';
        var checked = (visible[key] !== false) ? 'checked' : '';
        var disabledAttr = isCheckbox ? 'disabled' : '';
        html += '<div class="list-group-item d-flex align-items-center justify-content-between" data-key="' + key + '" style="padding:6px 12px;">';
        html += '<div class="d-flex align-items-center gap-2">';
        html += '<input type="checkbox" class="form-check-input inventory-col-check" data-col="' + key + '" ' + checked + ' ' + disabledAttr + ' onchange="updateInventoryColumnVisibility()">';
        html += '<span style="font-weight:500;">' + col.label + '</span>';
        if (isCheckbox) html += '<span class="text-muted" style="font-size:11px;">（固定）</span>';
        html += '</div>';
        html += '<div>';
        html += '<button class="btn btn-sm btn-outline-secondary" onclick="moveInventoryColumnUp(\'' + key + '\')" title="上移">↑</button>';
        html += '<button class="btn btn-sm btn-outline-secondary" onclick="moveInventoryColumnDown(\'' + key + '\')" title="下移">↓</button>';
        html += '</div>';
        html += '</div>';
    });

    container.innerHTML = html;

    var allCheckbox = document.getElementById('inventory_col_all');
    if (allCheckbox) {
        var items = document.querySelectorAll('.inventory-col-check:not([disabled])');
        var checkedItems = document.querySelectorAll('.inventory-col-check:not([disabled]):checked');
        allCheckbox.checked = items.length > 0 && checkedItems.length === items.length;
    }
}

function moveInventoryColumnUp(key) {
    var order = getInventoryColumnOrder();
    var idx = order.indexOf(key);
    if (idx <= 0) return;
    var temp = order[idx - 1];
    order[idx - 1] = order[idx];
    order[idx] = temp;
    saveInventoryColumnOrder(order);
    refreshInventoryColumnSettingsList();
    renderInventory();
}

function moveInventoryColumnDown(key) {
    var order = getInventoryColumnOrder();
    var idx = order.indexOf(key);
    if (idx === -1 || idx >= order.length - 1) return;
    var temp = order[idx + 1];
    order[idx + 1] = order[idx];
    order[idx] = temp;
    saveInventoryColumnOrder(order);
    refreshInventoryColumnSettingsList();
    renderInventory();
}

function updateInventoryColumnVisibility() {
    var visible = getInventoryColumnVisible();
    document.querySelectorAll('.inventory-col-check').forEach(function(cb) {
        var col = cb.dataset.col;
        if (cb.disabled) return;
        visible[col] = cb.checked;
    });
    saveInventoryColumnVisible(visible);
    renderInventory();
}

function toggleInventoryAllColumns(checked) {
    document.querySelectorAll('.inventory-col-check:not([disabled])').forEach(function(cb) {
        cb.checked = checked;
        var col = cb.dataset.col;
        var visible = getInventoryColumnVisible();
        visible[col] = checked;
        saveInventoryColumnVisible(visible);
    });
    renderInventory();
}

function resetInventoryColumns() {
    if (!confirm('恢复所有列到默认顺序和可见性，列宽也将重置。确定？')) return;
    saveInventoryColumnOrder(defaultInventoryOrder.slice());
    var defaultVisible = {};
    inventoryColumnDefs.forEach(function(c) { defaultVisible[c.key] = true; });
    saveInventoryColumnVisible(defaultVisible);
    localStorage.removeItem(INVENTORY_COLUMN_WIDTHS_KEY);
    renderInventory();
    var modal = bootstrap.Modal.getInstance(document.getElementById('inventoryColumnSettingsModal'));
    if (modal) modal.hide();
    alert('✅ 列已恢复默认（顺序、可见性、宽度）');
}

// ============================================================
//  数据初始化
// ============================================================
function ensureInventoryData() {
    if (!data.products) data.products = [];
    if (!data.inventoryLogs) data.inventoryLogs = [];
    if (!data._nextId) data._nextId = {};
    if (!data._nextId.inventoryLog) data._nextId.inventoryLog = 1;

    data.products.forEach(function(product) {
        if (product.stock === undefined) product.stock = 0;
        if (product.minStock === undefined) product.minStock = 0;
        if (product.shellStock === undefined) product.shellStock = 0;
        if (product.shellLocation === undefined) product.shellLocation = '';
        if (product.boardStock === undefined) product.boardStock = 0;
        if (product.boardLocation === undefined) product.boardLocation = '';
        if (product.remark === undefined) product.remark = '';
    });
    if (typeof window.saveDataToStorage === 'function') {
        window.saveDataToStorage();
    }
}

// ============================================================
//  获取数据
// ============================================================
function getInventoryProducts() {
    ensureInventoryData();
    return data.products;
}

function isProductLowStock(productId) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) return false;
    var minStock = product.minStock || 0;
    return minStock > 0 && (product.stock || 0) < minStock;
}

function getMaterialStock(productId, materialType) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) return 0;
    switch (materialType) {
        case 'product': return product.stock || 0;
        case 'board': return product.boardStock || 0;
        case 'shell': return product.shellStock || 0;
        default: return 0;
    }
}

function getMaterialTypeLabel(type) {
    var map = {
        'product': '成品',
        'board': '板材',
        'shell': '壳子',
        'adjust': '调整'
    };
    return map[type] || type;
}

// ============================================================
//  ★★★ 核心 API 函数 ★★★
// ============================================================

// 更新产品（通过产品 API）
async function apiUpdateProduct(productId, updateData) {
    var res = await fetch('/api/products/' + productId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
    });
    if (!res.ok) {
        var errText = await res.text();
        throw new Error(errText || '更新产品失败');
    }
    return res.json();
}

// 记录库存流水
async function apiAddInventoryLog(logData) {
    var res = await fetch('/api/inventory/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
    });
    if (!res.ok) {
        var errText = await res.text();
        throw new Error(errText || '记录流水失败');
    }
    return res.json();
}

// 获取库存流水
async function apiGetInventoryLogs() {
    var res = await fetch('/api/inventory/logs');
    if (!res.ok) throw new Error('获取流水失败');
    return res.json();
}

// 获取产品列表（从 data 中获取，因为 app.js 已加载）
// 不需要额外 API

// ============================================================
//  库存流水（支持调整类型）
// ============================================================
async function addInventoryLog(productId, type, qty, remark, materialType, beforeQty, afterQty, location) {
    ensureInventoryData();
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) {
        showToast('❌ 产品不存在', 'error');
        return false;
    }

    var matType = materialType || 'product';
    var before = (beforeQty !== undefined) ? beforeQty : getMaterialStock(productId, matType);
    var after = (afterQty !== undefined) ? afterQty : (type === 'in' ? before + qty : before - qty);

    if (type !== 'adjust' && after < 0) {
        showToast('❌ 库存不足！当前库存：' + before + '，出库数量：' + qty, 'error');
        return false;
    }

    try {
        // ★★★ 更新产品库存 ★★★
        var extra = {};
        try {
            extra = JSON.parse(product.extra || '{}');
        } catch(e) { extra = {}; }

        if (matType === 'product') {
            extra.stock = after;
            product.stock = after;
        } else if (matType === 'board') {
            extra.boardStock = after;
            product.boardStock = after;
            if (location) {
                extra.boardLocation = location;
                product.boardLocation = location;
            }
        } else if (matType === 'shell') {
            extra.shellStock = after;
            product.shellStock = after;
            if (location) {
                extra.shellLocation = location;
                product.shellLocation = location;
            }
        }

        // 构建产品更新数据
        var productUpdateData = {
            code: product.code,
            name: product.name,
            spec: product.spec || '',
            customer_code: product.customerCode || '',
            stock: matType === 'product' ? after : (product.stock || 0),
            status: product.status || '在库',
            remark: product.remark || '',
            extra: JSON.stringify(extra)
        };

        await apiUpdateProduct(productId, productUpdateData);

        // ★★★ 记录流水 ★★★
        var logData = {
            product_id: productId,
            product_name: product.name || '',
            product_code: product.code || '',
            customer_code: product.customerCode || '',
            material_type: matType,
            type: type,
            qty: qty,
            before_qty: before,
            after_qty: after,
            location: location || '',
            remark: remark || (type === 'adjust' ? '手动调整' : ''),
            operator: '管理员'
        };

        var log = await apiAddInventoryLog(logData);

        // 更新本地 data 中的库存流水
        if (!data.inventoryLogs) data.inventoryLogs = [];
        data.inventoryLogs.push({
            id: log.id,
            productId: log.product_id,
            productName: log.product_name,
            productCode: log.product_code,
            customerCode: log.customer_code,
            materialType: log.material_type,
            materialTypeLabel: getMaterialTypeLabel(log.material_type),
            type: log.type,
            qty: log.qty,
            beforeQty: log.before_qty,
            afterQty: log.after_qty,
            remark: log.remark,
            location: log.location,
            operator: log.operator,
            createdAt: log.created_at
        });

        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }

        return true;
    } catch (error) {
        showToast('❌ 操作失败: ' + error.message, 'error');
        console.error('库存操作错误:', error);
        return false;
    }
}

function getInventoryLogs() {
    ensureInventoryData();
    return data.inventoryLogs || [];
}

// ============================================================
//  多色底色管理
// ============================================================
function getInventoryHighlightColor(rowId) {
    if (inventoryHighlight) {
        return inventoryHighlight.getColor(rowId);
    }
    return null;
}

// ============================================================
//  复选框联动
// ============================================================
function getSelectedInventoryRows() {
    var checkboxes = document.querySelectorAll('.inventory-checkbox:checked');
    var ids = [];
    checkboxes.forEach(function(cb) {
        var id = cb.dataset.rowId;
        if (id) ids.push(id);
    });
    return ids;
}

function updateInventorySelectedCount() {
    var count = getSelectedInventoryRows().length;
    var el = document.getElementById('selectedInventoryCount');
    if (el) el.textContent = '已选 ' + count + ' 行';
}

function toggleAllInventoryRows() {
    var visibleCheckboxes = document.querySelectorAll('.inventory-checkbox');
    var allChecked = true;
    visibleCheckboxes.forEach(function(cb) {
        if (!cb.checked) allChecked = false;
    });
    visibleCheckboxes.forEach(function(cb) {
        cb.checked = !allChecked;
    });
    updateInventorySelectedCount();
}

// ============================================================
//  备注编辑
// ============================================================
async function saveInventoryRemark(rowId, value) {
    var productId = parseInt(rowId.replace('inv_', ''));
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) return;

    try {
        product.remark = value;
        var extra = {};
        try {
            extra = JSON.parse(product.extra || '{}');
        } catch(e) { extra = {}; }
        extra.remark = value;

        var updateData = {
            code: product.code,
            name: product.name,
            spec: product.spec || '',
            customer_code: product.customerCode || '',
            stock: product.stock || 0,
            status: product.status || '在库',
            remark: value,
            extra: JSON.stringify(extra)
        };

        await apiUpdateProduct(productId, updateData);
        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }
    } catch (error) {
        showToast('❌ 保存备注失败: ' + error.message, 'error');
        console.error(error);
    }
}

function scrollInputIntoView(input) {
    requestAnimationFrame(function() {
        try {
            var container = input.closest('.table-responsive');
            if (!container) {
                container = input.closest('div[style*="overflow"]');
            }
            if (container) {
                var inputRect = input.getBoundingClientRect();
                var containerRect = container.getBoundingClientRect();
                if (inputRect.left < containerRect.left || inputRect.right > containerRect.right) {
                    input.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            } else {
                input.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
            input.select();
        } catch (e) {
            console.warn('滚动到输入框失败:', e);
        }
    });
}

// ============================================================
//  渲染统计
// ============================================================
function renderInventoryStats(products) {
    var totalSku = products.length;
    var totalStock = 0;
    var lowStockCount = 0;
    var boardStock = 0;
    var shellStock = 0;

    products.forEach(function(p) {
        totalStock += (p.stock || 0);
        boardStock += (p.boardStock || 0);
        shellStock += (p.shellStock || 0);
        if (isProductLowStock(p.id)) lowStockCount++;
    });

    var logs = getInventoryLogs();

    document.getElementById('statTotalSku').textContent = totalSku;
    document.getElementById('statTotalStock').textContent = totalStock;
    document.getElementById('statBoardStock').textContent = boardStock;
    document.getElementById('statLowStock').textContent = lowStockCount;
    document.getElementById('statLogCount').textContent = logs.length;
    document.getElementById('inventoryTotalCount').textContent = '共 ' + totalSku + ' 个产品';
}

// ============================================================
//  单击行高亮
// ============================================================
var selectedInventoryRowId = null;
var currentHighlightRow = null;

function selectInventoryRow(rowId) {
    if (selectedInventoryRowId === rowId) {
        selectedInventoryRowId = null;
        if (currentHighlightRow) {
            var oldBg = currentHighlightRow._originalBg || '';
            currentHighlightRow.style.backgroundColor = oldBg;
            currentHighlightRow.querySelectorAll('td').forEach(function(td) {
                td.style.backgroundColor = oldBg;
            });
            currentHighlightRow = null;
        }
        return;
    }

    if (currentHighlightRow) {
        var oldBg = currentHighlightRow._originalBg || '';
        currentHighlightRow.style.backgroundColor = oldBg;
        currentHighlightRow.querySelectorAll('td').forEach(function(td) {
            td.style.backgroundColor = oldBg;
        });
        currentHighlightRow = null;
    }

    selectedInventoryRowId = rowId;
    var tr = document.querySelector('tr[data-row-id="' + rowId + '"]');
    if (tr) {
        var firstTd = tr.querySelector('td');
        if (firstTd) {
            var computedBg = getComputedStyle(firstTd).backgroundColor;
            tr._originalBg = computedBg;
        } else {
            tr._originalBg = '';
        }
        tr.style.backgroundColor = '#d0e4ff';
        tr.querySelectorAll('td').forEach(function(td) {
            td.style.backgroundColor = '#d0e4ff';
        });
        currentHighlightRow = tr;
    }
}

function restoreInventoryHighlight() {
    if (!selectedInventoryRowId) return;
    var tr = document.querySelector('tr[data-row-id="' + selectedInventoryRowId + '"]');
    if (tr) {
        tr.style.backgroundColor = '#d0e4ff';
        tr.querySelectorAll('td').forEach(function(td) {
            td.style.backgroundColor = '#d0e4ff';
        });
        currentHighlightRow = tr;
    }
}

// ============================================================
//  渲染库存列表
// ============================================================
function renderInventory() {
    ensureInventoryData();

    if (!inventoryHighlight) {
        inventoryHighlight = new HighlightManager('inventory', {
            getSelectedIds: function() {
                var ids = [];
                document.querySelectorAll('.inventory-checkbox:checked').forEach(function(cb) {
                    var id = cb.dataset.rowId;
                    if (id) ids.push(String(id));
                });
                return ids;
            },
            renderCallback: renderInventory,
            idAttribute: 'data-row-id'
        });
    }

    var searchKeyword = document.getElementById('inventorySearchInput')?.value?.toLowerCase() || '';
    var filterStatus = document.getElementById('inventoryFilterStatus')?.value || '';

    var products = data.products.filter(function(p) {
        var matchSearch = true;
        if (searchKeyword) {
            matchSearch = (p.name || '').toLowerCase().includes(searchKeyword) ||
                          (p.code || '').toLowerCase().includes(searchKeyword) ||
                          (p.customerCode || '').toLowerCase().includes(searchKeyword);
        }
        var matchStatus = true;
        if (filterStatus === 'low') {
            matchStatus = isProductLowStock(p.id);
        } else if (filterStatus === 'normal') {
            matchStatus = !isProductLowStock(p.id);
        }
        return matchSearch && matchStatus;
    });

    renderInventoryStats(products);

    var container = document.getElementById('inventoryList');
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">📋 暂无匹配的产品</div>';
        return;
    }

    var colOrder = getInventoryColumnOrder();
    var colVisible = getInventoryColumnVisible();

    var visibleCols = [];
    colOrder.forEach(function(key) {
        if (colVisible[key] !== false) {
            var colDef = inventoryColumnDefs.find(function(c) { return c.key === key; });
            if (colDef) visibleCols.push(colDef);
        }
    });

    var checkboxCol = inventoryColumnDefs.find(function(c) { return c.key === 'checkbox'; });
    if (checkboxCol) {
        visibleCols = visibleCols.filter(function(c) { return c.key !== 'checkbox'; });
        visibleCols.unshift(checkboxCol);
    }

    var html = '';
    html += '<div class="table-responsive">';
    html += '<table class="inventory-table">';
    html += '<thead><tr>';

    visibleCols.forEach(function(col) {
        var width = getInventoryColumnWidth(col.key);
        var isCheckbox = col.key === 'checkbox';
        var dataCol = col.key;
        if (isCheckbox) {
            html += '<th data-col="' + dataCol + '" style="width:' + width + 'px;min-width:' + width + 'px;text-align:center;position:sticky;left:0;z-index:15;background:#f8fafc;">';
            html += '<input type="checkbox" class="inventory-checkbox" onchange="toggleAllInventoryRows()" style="width:20px;height:20px;accent-color:#0066cc;cursor:pointer;" />';
            html += '</th>';
        } else {
            html += '<th data-col="' + dataCol + '" style="width:' + width + 'px;min-width:' + width + 'px;padding:6px 8px;text-align:center;position:relative;background:#f8afc;">';
            html += col.label;
            html += '</th>';
        }
    });

    html += '</tr></thead><tbody>';

    var rowIdPrefix = 'inv_';

    products.forEach(function(p) {
        var rowId = rowIdPrefix + p.id;
        var isLow = isProductLowStock(p.id);
        var stock = p.stock || 0;
        var minStock = p.minStock || 0;

        var statusHtml = isLow
            ? '<span class="badge bg-soft-danger" style="color:#dc3545;font-weight:700;">⚠️ 低库存</span>'
            : '<span class="badge bg-soft-success" style="color:#28a745;">✅ 正常</span>';

        var stockClass = isLow ? 'stock-low' : 'stock-normal';

        var highlightColor = inventoryHighlight ? inventoryHighlight.getColor(rowId) : '';
        var rowBg = highlightColor || '#fff';

        html += '<tr style="background-color:' + rowBg + ';" data-row-id="' + rowId + '" onclick="selectInventoryRow(\'' + rowId + '\')">';

        visibleCols.forEach(function(col) {
            var key = col.key;
            var width = getInventoryColumnWidth(key);
            var tdBg = highlightColor || '#fff';

            if (key === 'checkbox') {
                html += '<td style="padding:4px 4px;text-align:center;width:' + width + 'px;min-width:' + width + 'px;position:sticky;left:0;z-index:5;background:' + tdBg + ';">';
                html += '<input type="checkbox" class="inventory-checkbox" data-row-id="' + rowId + '" onclick="event.stopPropagation();" onchange="updateInventorySelectedCount()" style="width:20px;height:20px;accent-color:#0066cc;cursor:pointer;" />';
                html += '</td>';
                return;
            }

            var val = '';
            var extraStyle = '';

            switch (key) {
                case 'code':
                    val = '<code style="font-size:12px;">' + (p.code || '-') + '</code>';
                    break;
                case 'name':
                    val = '<strong>' + (p.name || '-') + '</strong>';
                    extraStyle = 'text-align:left;';
                    break;
                case 'customerCode':
                    val = p.customerCode || '-';
                    break;
                case 'stock':
                    val = '<span class="' + stockClass + '" style="font-size:16px;">' + stock + '</span>';
                    break;
                case 'minStock':
                    val = minStock > 0 ? minStock : '-';
                    break;
                case 'status':
                    val = statusHtml;
                    break;
                case 'shellStock':
                    val = p.shellStock || 0;
                    break;
                case 'shellLocation':
                    val = p.shellLocation || '-';
                    extraStyle = 'font-size:13px;color:#555;';
                    break;
                case 'boardStock':
                    val = p.boardStock || 0;
                    break;
                case 'boardLocation':
                    val = p.boardLocation || '-';
                    extraStyle = 'font-size:13px;color:#555;';
                    break;
                case 'remark':
                    var remarkValue = p.remark || '';
                    val = '<input type="text" class="inventory-remark-input" value="' + remarkValue.replace(/"/g, '&quot;') + '" placeholder="输入备注..." data-row-id="' + rowId + '" onchange="saveInventoryRemark(this.dataset.rowId, this.value)" onfocus="this.select()" onclick="event.stopPropagation(); scrollInputIntoView(this)" style="width:100%;border:none;background:transparent;font-weight:500;font-size:13px;text-align:center;outline:none;padding:2px 4px;border-radius:4px;" onfocusin="this.style.background=\'#fff9e6\';this.style.border=\'1px solid #f5a623\';" onfocusout="this.style.background=\'transparent\';this.style.border=\'none\';" />';
                    extraStyle = 'max-width:150px;';
                    break;
                case 'actions':
                    val = '';
                    val += '<button class="btn btn-sm btn-outline-custom" onclick="event.stopPropagation(); openInboundForProduct(' + p.id + ')" style="color:#28a745;border-color:#28a745;padding:2px 10px;font-size:12px;" title="入库"><i class="bi bi-arrow-down-circle"></i></button>';
                    val += '<button class="btn btn-sm btn-outline-custom" onclick="event.stopPropagation(); openOutboundForProduct(' + p.id + ')" style="color:#dc3545;border-color:#dc3545;padding:2px 10px;font-size:12px;margin-left:4px;" title="出库"><i class="bi bi-arrow-up-circle"></i></button>';
                    val += '<button class="btn btn-sm btn-outline-custom" onclick="event.stopPropagation(); openSetMinStock(' + p.id + ')" style="padding:2px 8px;font-size:12px;margin-left:4px;" title="设置最低库存"><i class="bi bi-gear"></i></button>';
                    val += '<button class="btn btn-sm btn-outline-custom" onclick="event.stopPropagation(); viewProductLogs(' + p.id + ')" style="padding:2px 8px;font-size:12px;margin-left:4px;" title="查看流水"><i class="bi bi-clock-history"></i></button>';
                    break;
                default:
                    val = '';
            }

            html += '<td style="padding:4px 8px;text-align:center;width:' + width + 'px;min-width:' + width + 'px;vertical-align:middle;background:' + tdBg + ';' + extraStyle + '">' + val + '</td>';
        });

        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
    updateInventorySelectedCount();

    restoreInventoryHighlight();

    setTimeout(function() {
        try {
            initInventoryColumnResize();
        } catch (e) {
            console.warn('列宽拖拽初始化失败:', e);
        }
    }, 100);
}

// ============================================================
//  多色底色存根
// ============================================================
window.applyInventoryHighlight = function(color) {
    if (inventoryHighlight) {
        inventoryHighlight.apply(color);
    } else {
        alert('高亮功能尚未初始化，请先切换到库存管理页面');
    }
};

window.clearInventoryHighlight = function() {
    if (inventoryHighlight) {
        inventoryHighlight.clear();
    } else {
        alert('高亮功能尚未初始化，请先切换到库存管理页面');
    }
};

// ============================================================
//  入库/出库/设置最低库存/流水查看
// ============================================================

function populateProductSelect(selectId, selectedId) {
    var select = document.getElementById(selectId);
    if (!select) return;
    var currentValue = selectedId || select.value;
    var products = data.products || [];
    var html = '<option value="">-- 请选择产品 --</option>';
    products.forEach(function(p) {
        var label = (p.code || '') + ' - ' + (p.name || '') + ' (库存:' + (p.stock || 0) + ')';
        var selected = (p.id == currentValue) ? 'selected' : '';
        html += '<option value="' + p.id + '" ' + selected + '>' + label + '</option>';
    });
    select.innerHTML = html;
    if (currentValue) select.value = currentValue;
}

function openInboundModal() {
    populateProductSelect('inboundProduct');
    document.getElementById('inboundQty').value = '';
    document.getElementById('inboundRemark').value = '';
    document.getElementById('inboundLocation').value = '';
    document.getElementById('inboundCurrentStock').textContent = '当前库存：0';
    document.getElementById('inboundMaterialType').value = 'product';
    onInboundTypeChange();
    var modalEl = document.getElementById('inboundModal');
    if (!modalEl) { console.error('inboundModal not found'); return; }
    var modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function openInboundForProduct(productId) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) return;
    populateProductSelect('inboundProduct', productId);
    document.getElementById('inboundQty').value = '';
    document.getElementById('inboundRemark').value = '';
    document.getElementById('inboundLocation').value = '';
    document.getElementById('inboundMaterialType').value = 'product';
    onInboundTypeChange();
    var stock = getMaterialStock(productId, 'product');
    document.getElementById('inboundCurrentStock').textContent = '当前库存：' + stock;
    var modalEl = document.getElementById('inboundModal');
    if (!modalEl) { console.error('inboundModal not found'); return; }
    var modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function onInboundTypeChange() {
    var productId = parseInt(document.getElementById('inboundProduct').value);
    var materialType = document.getElementById('inboundMaterialType').value;
    var locationField = document.getElementById('inboundLocation');
    if (materialType === 'board' || materialType === 'shell') {
        locationField.placeholder = '请输入存放位置（必填）';
        locationField.required = true;
    } else {
        locationField.placeholder = '（仅板材/壳子需要）';
        locationField.required = false;
    }
    if (productId) {
        var stock = getMaterialStock(productId, materialType);
        document.getElementById('inboundCurrentStock').textContent = '当前库存：' + stock;
    } else {
        document.getElementById('inboundCurrentStock').textContent = '当前库存：0';
    }
}

async function confirmInbound() {
    var productId = parseInt(document.getElementById('inboundProduct').value);
    var qty = parseInt(document.getElementById('inboundQty').value);
    var remark = document.getElementById('inboundRemark').value.trim();
    var materialType = document.getElementById('inboundMaterialType').value || 'product';
    var location = document.getElementById('inboundLocation').value.trim();

    if (!productId) { alert('请选择产品'); return; }
    if (!qty || qty <= 0) { alert('请输入有效的入库数量'); return; }
    if ((materialType === 'board' || materialType === 'shell') && !location) {
        alert('板材或壳子入库必须填写存放位置');
        return;
    }

    var success = await addInventoryLog(productId, 'in', qty, remark, materialType, undefined, undefined, location);
    if (success) {
        var modal = bootstrap.Modal.getInstance(document.getElementById('inboundModal'));
        if (modal) modal.hide();
        renderInventory();
    }
}

function openOutboundModal() {
    populateProductSelect('outboundProduct');
    document.getElementById('outboundQty').value = '';
    document.getElementById('outboundRemark').value = '';
    document.getElementById('outboundCurrentStock').textContent = '当前库存：0';
    document.getElementById('outboundWarning').style.display = 'none';
    document.getElementById('outboundMaterialType').value = 'product';
    onOutboundTypeChange();
    var modalEl = document.getElementById('outboundModal');
    if (!modalEl) { console.error('outboundModal not found'); return; }
    var modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function openOutboundForProduct(productId) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) return;
    populateProductSelect('outboundProduct', productId);
    document.getElementById('outboundQty').value = '';
    document.getElementById('outboundRemark').value = '';
    document.getElementById('outboundMaterialType').value = 'product';
    onOutboundTypeChange();
    var stock = getMaterialStock(productId, 'product');
    document.getElementById('outboundCurrentStock').textContent = '当前库存：' + stock;
    document.getElementById('outboundWarning').style.display = 'none';
    var modalEl = document.getElementById('outboundModal');
    if (!modalEl) { console.error('outboundModal not found'); return; }
    var modal = new bootstrap.Modal(modalEl);
    modal.show();

    document.getElementById('outboundQty').oninput = function() {
        var val = parseInt(this.value) || 0;
        var matType = document.getElementById('outboundMaterialType').value;
        var currentStock = getMaterialStock(productId, matType);
        var warning = document.getElementById('outboundWarning');
        if (val > currentStock) {
            warning.style.display = 'block';
            warning.textContent = '⚠️ 库存不足！当前库存：' + currentStock + '，出库数量：' + val;
        } else {
            warning.style.display = 'none';
        }
    };
}

function onOutboundTypeChange() {
    var productId = parseInt(document.getElementById('outboundProduct').value);
    var materialType = document.getElementById('outboundMaterialType').value;
    if (productId) {
        var stock = getMaterialStock(productId, materialType);
        document.getElementById('outboundCurrentStock').textContent = '当前库存：' + stock;
    } else {
        document.getElementById('outboundCurrentStock').textContent = '当前库存：0';
    }
    document.getElementById('outboundWarning').style.display = 'none';
}

async function confirmOutbound() {
    var productId = parseInt(document.getElementById('outboundProduct').value);
    var qty = parseInt(document.getElementById('outboundQty').value);
    var remark = document.getElementById('outboundRemark').value.trim();
    var materialType = document.getElementById('outboundMaterialType').value || 'product';

    if (!productId) { alert('请选择产品'); return; }
    if (!qty || qty <= 0) { alert('请输入有效的出库数量'); return; }

    var currentStock = getMaterialStock(productId, materialType);
    if (qty > currentStock) {
        alert('库存不足！当前库存：' + currentStock + '，出库数量：' + qty);
        return;
    }

    var success = await addInventoryLog(productId, 'out', qty, remark, materialType);
    if (success) {
        var modal = bootstrap.Modal.getInstance(document.getElementById('outboundModal'));
        if (modal) modal.hide();
        renderInventory();
    }
}

// ============================================================
//  设置最低库存
// ============================================================

function openSetMinStock(productId) {
    console.log('打开设置最低库存，产品ID:', productId);
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) {
        alert('产品不存在');
        return;
    }
    document.getElementById('setMinStockProductId').value = productId;
    document.getElementById('setMinStockProductName').textContent = product.name || product.code || '未知产品';
    document.getElementById('setMinStockValue').value = product.minStock || 0;
    var modalEl = document.getElementById('setMinStockModal');
    if (!modalEl) { console.error('setMinStockModal not found'); return; }
    var modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function confirmSetMinStock() {
    var productId = parseInt(document.getElementById('setMinStockProductId').value);
    var minStock = parseInt(document.getElementById('setMinStockValue').value);
    if (!productId) { alert('产品不存在'); return; }
    if (isNaN(minStock) || minStock < 0) { alert('请输入有效的数值（≥0）'); return; }
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }

    try {
        product.minStock = minStock;
        var extra = {};
        try {
            extra = JSON.parse(product.extra || '{}');
        } catch(e) { extra = {}; }
        extra.minStock = minStock;

        var updateData = {
            code: product.code,
            name: product.name,
            spec: product.spec || '',
            customer_code: product.customerCode || '',
            stock: product.stock || 0,
            status: product.status || '在库',
            remark: product.remark || '',
            extra: JSON.stringify(extra)
        };

        await apiUpdateProduct(productId, updateData);
        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }
        var modal = bootstrap.Modal.getInstance(document.getElementById('setMinStockModal'));
        if (modal) modal.hide();
        renderInventory();
        showToast('✅ 最低库存已设置', 'success');
    } catch (error) {
        showToast('❌ 设置失败: ' + error.message, 'error');
        console.error(error);
    }
}

// ============================================================
//  流水记录
// ============================================================

function openInventoryLogModal() {
    console.log('打开流水记录');
    populateLogProductFilter();
    renderInventoryLogs();
    var modalEl = document.getElementById('inventoryLogModal');
    if (!modalEl) { console.error('inventoryLogModal not found'); return; }
    var modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function viewProductLogs(productId) {
    openInventoryLogModal();
    var select = document.getElementById('logProductFilter');
    if (select) {
        select.value = productId;
        renderInventoryLogs();
    }
}

function populateLogProductFilter() {
    var select = document.getElementById('logProductFilter');
    if (!select) return;
    var currentValue = select.value;
    var products = data.products || [];
    var html = '<option value="">全部产品</option>';
    products.forEach(function(p) {
        html += '<option value="' + p.id + '">' + (p.name || p.code || '产品' + p.id) + '</option>';
    });
    select.innerHTML = html;
    if (currentValue) select.value = currentValue;
}

async function renderInventoryLogs() {
    var container = document.getElementById('inventoryLogList');
    if (!container) return;
    var productFilter = document.getElementById('logProductFilter')?.value || '';
    var typeFilter = document.getElementById('logTypeFilter')?.value || '';

    // 从服务器获取最新流水
    try {
        var logsData = await apiGetInventoryLogs();
        data.inventoryLogs = logsData.map(function(log) {
            return {
                id: log.id,
                productId: log.product_id,
                productName: log.product_name,
                productCode: log.product_code,
                customerCode: log.customer_code,
                materialType: log.material_type,
                materialTypeLabel: getMaterialTypeLabel(log.material_type),
                type: log.type,
                qty: log.qty,
                beforeQty: log.before_qty,
                afterQty: log.after_qty,
                remark: log.remark,
                location: log.location,
                operator: log.operator,
                createdAt: log.created_at
            };
        });
        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }
    } catch (e) {
        console.warn('获取流水失败，使用本地数据', e);
    }

    var logs = data.inventoryLogs || [];
    if (productFilter) {
        var pid = parseInt(productFilter);
        logs = logs.filter(function(l) { return l.productId === pid; });
    }
    if (typeFilter) {
        logs = logs.filter(function(l) { return l.type === typeFilter; });
    }
    logs.sort(function(a, b) {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    if (logs.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">暂无流水记录</div>';
        return;
    }

    var html = '';
    html += '<table class="table table-sm table-bordered" style="font-size:13px;">';
    html += '<thead style="background:#f0f2f5;"><tr>';
    html += '<th style="text-align:center;">时间</th>';
    html += '<th style="text-align:center;">产品</th>';
    html += '<th style="text-align:center;">物料类型</th>';
    html += '<th style="text-align:center;">类型</th>';
    html += '<th style="text-align:center;">数量</th>';
    html += '<th style="text-align:center;">变动前</th>';
    html += '<th style="text-align:center;">变动后</th>';
    html += '<th style="text-align:center;">位置</th>';
    html += '<th style="text-align:center;">备注</th>';
    html += '</tr></thead><tbody>';
    logs.forEach(function(log) {
        var typeLabel = log.type === 'in' ? '入库' : (log.type === 'out' ? '出库' : '调整');
        var typeColor = log.type === 'in' ? '#28a745' : (log.type === 'out' ? '#dc3545' : '#fd7e14');
        var materialTypeLabel = log.materialTypeLabel || getMaterialTypeLabel(log.materialType || 'product');
        html += '<tr>';
        html += '<td style="text-align:center;font-size:12px;">' + (log.createdAt || '-') + '</td>';
        html += '<td style="text-align:center;font-size:12px;">' + (log.productName || log.productCode || '产品' + log.productId) + '</td>';
        html += '<td style="text-align:center;"><span class="badge bg-soft-secondary" style="font-size:11px;">' + materialTypeLabel + '</span></td>';
        html += '<td style="text-align:center;"><span class="badge" style="background:' + typeColor + ';color:#fff;">' + typeLabel + '</span></td>';
        html += '<td style="text-align:center;font-weight:600;">' + log.qty + '</td>';
        html += '<td style="text-align:center;">' + log.beforeQty + '</td>';
        html += '<td style="text-align:center;font-weight:600;color:#0066cc;">' + log.afterQty + '</td>';
        html += '<td style="text-align:center;font-size:12px;">' + (log.location || '-') + '</td>';
        html += '<td style="text-align:center;font-size:12px;">' + (log.remark || '-') + '</td>';
        html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ============================================================
//  导出选中
// ============================================================

function exportSelectedInventory() {
    if (typeof XLSX === 'undefined') {
        alert('Excel 库未加载，请刷新页面后重试。');
        return;
    }

    var checkedRows = getSelectedInventoryRows();
    if (checkedRows.length === 0) {
        alert('请先勾选需要导出的行');
        return;
    }

    var productIds = checkedRows.map(function(rowId) {
        return parseInt(rowId.replace('inv_', ''));
    });

    var products = data.products.filter(function(p) {
        return productIds.indexOf(p.id) !== -1;
    });

    if (products.length === 0) {
        alert('没有可导出的数据');
        return;
    }

    var exportData = products.map(function(p) {
        return {
            '产品编码': p.code || '',
            '产品名称': p.name || '',
            '客户号': p.customerCode || '',
            '当前库存': p.stock || 0,
            '最低库存': p.minStock || 0,
            '壳子库存': p.shellStock || 0,
            '壳子位置': p.shellLocation || '',
            '板材库存': p.boardStock || 0,
            '板材位置': p.boardLocation || '',
            '备注': p.remark || ''
        };
    });

    try {
        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(exportData);
        var colWidths = Object.keys(exportData[0] || {}).map(function(key) {
            return { wch: Math.max(key.length * 2, 12) };
        });
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, '库存数据');
        var dateStr = new Date().toISOString().slice(0, 10);
        var fileName = '库存数据_导出_' + dateStr + '.xlsx';
        XLSX.writeFile(wb, fileName);
        alert('✅ 成功导出 ' + exportData.length + ' 行数据！');
    } catch (err) {
        alert('导出失败：' + err.message);
    }
}

function exportInventoryLogs() {
    if (typeof XLSX === 'undefined') {
        alert('Excel 库未加载，请刷新页面后重试。');
        return;
    }

    var logs = getInventoryLogs();
    if (logs.length === 0) {
        alert('没有流水记录可导出');
        return;
    }

    var exportData = logs.map(function(log) {
        return {
            '时间': log.createdAt || '',
            '产品ID': log.productId || '',
            '产品名称': log.productName || '',
            '产品编码': log.productCode || '',
            '客户号': log.customerCode || '',
            '物料类型': log.materialTypeLabel || getMaterialTypeLabel(log.materialType || 'product'),
            '类型': log.type === 'in' ? '入库' : (log.type === 'out' ? '出库' : '调整'),
            '数量': log.qty || 0,
            '变动前库存': log.beforeQty || 0,
            '变动后库存': log.afterQty || 0,
            '位置': log.location || '',
            '备注': log.remark || ''
        };
    });

    try {
        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.json_to_sheet(exportData);
        var colWidths = Object.keys(exportData[0] || {}).map(function(key) {
            return { wch: Math.max(key.length * 2, 12) };
        });
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, '库存流水');
        var dateStr = new Date().toISOString().slice(0, 10);
        var fileName = '库存流水_' + dateStr + '.xlsx';
        XLSX.writeFile(wb, fileName);
        alert('✅ 成功导出 ' + exportData.length + ' 条流水记录！');
    } catch (err) {
        alert('导出失败：' + err.message);
    }
}

// ============================================================
//  初始化
// ============================================================

function initInventory() {
    console.log('✅ 库存管理初始化...');
    ensureInventoryData();

    // 从服务器加载流水
    async function loadLogs() {
        try {
            var logsData = await apiGetInventoryLogs();
            data.inventoryLogs = logsData.map(function(log) {
                return {
                    id: log.id,
                    productId: log.product_id,
                    productName: log.product_name,
                    productCode: log.product_code,
                    customerCode: log.customer_code,
                    materialType: log.material_type,
                    materialTypeLabel: getMaterialTypeLabel(log.material_type),
                    type: log.type,
                    qty: log.qty,
                    beforeQty: log.before_qty,
                    afterQty: log.after_qty,
                    remark: log.remark,
                    location: log.location,
                    operator: log.operator,
                    createdAt: log.created_at
                };
            });
            if (typeof window.saveDataToStorage === 'function') {
                window.saveDataToStorage();
            }
        } catch (e) {
            console.warn('加载流水失败，使用本地数据', e);
        }
        renderInventory();
    }

    if (!inventoryHighlight) {
        inventoryHighlight = new HighlightManager('inventory', {
            getSelectedIds: function() {
                var ids = [];
                document.querySelectorAll('.inventory-checkbox:checked').forEach(function(cb) {
                    var id = cb.dataset.rowId;
                    if (id) ids.push(String(id));
                });
                return ids;
            },
            renderCallback: renderInventory,
            idAttribute: 'data-row-id'
        });
    }

    loadLogs();
}

// ============================================================
//  暴露全局
// ============================================================

window.initInventory = initInventory;
window.renderInventory = renderInventory;
window.openInboundModal = openInboundModal;
window.openInboundForProduct = openInboundForProduct;
window.confirmInbound = confirmInbound;
window.onInboundTypeChange = onInboundTypeChange;
window.openOutboundModal = openOutboundModal;
window.openOutboundForProduct = openOutboundForProduct;
window.confirmOutbound = confirmOutbound;
window.onOutboundTypeChange = onOutboundTypeChange;
window.openSetMinStock = openSetMinStock;
window.confirmSetMinStock = confirmSetMinStock;
window.openInventoryLogModal = openInventoryLogModal;
window.viewProductLogs = viewProductLogs;
window.renderInventoryLogs = renderInventoryLogs;
window.exportInventoryLogs = exportInventoryLogs;
window.saveInventoryRemark = saveInventoryRemark;
window.scrollInputIntoView = scrollInputIntoView;

window.toggleAllInventoryRows = toggleAllInventoryRows;
window.getSelectedInventoryRows = getSelectedInventoryRows;
window.updateInventorySelectedCount = updateInventorySelectedCount;
window.exportSelectedInventory = exportSelectedInventory;
window.selectInventoryRow = selectInventoryRow;
window.restoreInventoryHighlight = restoreInventoryHighlight;

window.openInventoryColumnSettings = openInventoryColumnSettings;
window.moveInventoryColumnUp = moveInventoryColumnUp;
window.moveInventoryColumnDown = moveInventoryColumnDown;
window.updateInventoryColumnVisibility = updateInventoryColumnVisibility;
window.toggleInventoryAllColumns = toggleInventoryAllColumns;
window.resetInventoryColumns = resetInventoryColumns;

window.inventoryHighlight = inventoryHighlight;

console.log('🚀 库存管理模块加载完成（服务器存储版本）');