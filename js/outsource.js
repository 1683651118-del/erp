// ============================================================
//  外发管理模块（完整版 · 服务器存储）
//  功能：外发列表、新建、编辑、删除、修复关联订单、导出、列设置、统计
//  修复：保存外发时订单状态更新失败不影响外发保存
// ============================================================

// ★★★ 确保 showToast 存在 ★★★
if (typeof showToast === 'undefined') {
    window.showToast = function(message, type = 'success') {
        console.log('📢 [Toast]', type, message);
        alert(message);
    };
    console.warn('⚠️ showToast 未加载，已使用备用 alert 替代');
}

console.log('🔄 外发管理模块加载中...');

// ★★★ 外发管理专用列配置 ★★★
const outsourceColumns = [
    { key: 'outsourceStatus', label: '外发详情' },
    { key: 'supplier', label: '外发供应商' },
    { key: 'location', label: '外发' },
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

const OUT_COLUMN_ORDER_KEY = 'erp_outsource_column_order';
const OUT_COLUMN_WIDTHS_KEY = 'erp_outsource_column_widths';

// ★★★ 确保 supplier、location 列可见 ★★★
if (window.outColumnsVisible) {
    if (outColumnsVisible['supplier'] === undefined) outColumnsVisible['supplier'] = true;
    if (outColumnsVisible['location'] === undefined) outColumnsVisible['location'] = true;
}

// ============================================================
//  列设置函数
// ============================================================

function getOutColumnOrder() {
    try {
        const stored = localStorage.getItem(OUT_COLUMN_ORDER_KEY);
        if (stored) {
            const order = JSON.parse(stored);
            const allKeys = outsourceColumns.map(c => c.key);
            const missingKeys = allKeys.filter(k => !order.includes(k));
            if (missingKeys.length > 0) {
                const newOrder = [...order, ...missingKeys];
                saveOutColumnOrder(newOrder);
                return newOrder;
            }
            return order;
        }
    } catch (e) {}
    return outsourceColumns.map(c => c.key);
}

function saveOutColumnOrder(orderArray) {
    localStorage.setItem(OUT_COLUMN_ORDER_KEY, JSON.stringify(orderArray));
}

function getOutColumnWidths() {
    try {
        const stored = localStorage.getItem(OUT_COLUMN_WIDTHS_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
}

function saveOutColumnWidth(colKey, width) {
    const widths = getOutColumnWidths();
    widths[colKey] = width;
    localStorage.setItem(OUT_COLUMN_WIDTHS_KEY, JSON.stringify(widths));
}

function getOutColumnWidth(colKey, defaultWidth) {
    const widths = getOutColumnWidths();
    return widths[colKey] || defaultWidth;
}

function initOutsourceColumnResize(tableId) {
    const table = document.getElementById(tableId);
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
        if (colKey === 'actions') return;

        const savedWidth = getOutColumnWidth(colKey);
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
        newWidth = Math.max(60, newWidth);
        newWidth = Math.min(500, newWidth);

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
        saveOutColumnWidth(dragData.colKey, newWidth);

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

// ============================================================
//  API 函数
// ============================================================

async function apiGetOutsource() {
    const res = await fetch('/api/outsource');
    if (!res.ok) throw new Error('获取外发列表失败');
    return res.json();
}

async function apiCreateOutsource(data) {
    const res = await fetch('/api/outsource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || '创建外发记录失败');
    }
    return res.json();
}

async function apiUpdateOutsource(id, data) {
    const res = await fetch(`/api/outsource/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || '更新外发记录失败');
    }
    return res.json();
}

async function apiDeleteOutsource(id) {
    const res = await fetch(`/api/outsource/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(err || '删除外发记录失败');
    }
    return res.json();
}

// ============================================================
//  辅助函数
// ============================================================

function getOrder(id) {
    return data.orders.find(o => o.id === id);
}

function statusBadgeOut(status) {
    const map = {
        '待外发': 'bg-soft-info',
        '外发中': 'bg-soft-purple',
        '已完成-待出货': 'bg-soft-success',
        '质检未通过-返单(外发)': 'bg-soft-danger'
    };
    return map[status] || 'bg-soft-secondary';
}

// ============================================================
//  初始化
// ============================================================

function initOutsource() {
    async function loadOutsource() {
        try {
            const res = await fetch('/api/outsource');
            if (res.ok) {
                const list = await res.json();
                data.outsourceOrders = list.map(os => ({
                    id: os.id,
                    orderId: os.order_id,
                    outsourceNo: os.outsource_no,
                    status: os.status,
                    location: os.location,
                    outsourceDate: os.outsource_date,
                    supplier: os.supplier,
                    returnDate: os.return_date,
                    remark: os.remark
                }));
                if (typeof window.saveDataToStorage === 'function') {
                    window.saveDataToStorage();
                }
                renderOutsource();
            } else {
                console.warn('外发API返回失败，使用本地数据');
                renderOutsource();
            }
        } catch (e) {
            console.warn('加载外发数据失败，使用本地数据', e);
            renderOutsource();
        }
    }
    loadOutsource();
    document.getElementById('outFilterKeyword')?.addEventListener('input', renderOutsource);
}

// ============================================================
//  渲染
// ============================================================

function renderOutsource() {
    console.log('🔄 执行完整版 renderOutsource...');
    
    var filterKeyword = document.getElementById('outFilterKeyword')?.value?.toLowerCase() || '';
    var filterSelects = document.querySelectorAll('.filter-row select');
    var colFilters = {};
    filterSelects.forEach(function(sel) {
        var col = sel.dataset.col;
        if (col && sel.value) colFilters[col] = sel.value;
    });

    // 筛选外发记录（排除已完成-待出货）
    var list = data.outsourceOrders.filter(function(os) {
        if (os.status === '已完成-待出货') return false;
        var order = getOrder(os.orderId);
        if (!order) return false;

        // ★★★ 兼容驼峰和下划线 ★★★
        var customerCode = order.customerCode || order.customer_code || '';
        var orderNo = order.orderNo || order.order_no || '';
        var productCode = order.productCode || order.product_code || '';
        var productName = order.productName || order.product_name || '';
        var spec = order.spec || '';
        var color = order.color || '';
        var stamp = order.stamp || '';
        var qty = order.qty || 0;
        var remark = os.remark || '';

        var matchKeyword = true;
        if (filterKeyword) {
            var searchText = (os.outsourceNo || '') + ' ' + (os.supplier || '') + ' ' + orderNo + ' ' + productName + ' ' + customerCode + ' ' + productCode;
            matchKeyword = searchText.toLowerCase().includes(filterKeyword);
        }

        var matchCols = true;
        for (var col in colFilters) {
            var val = colFilters[col];
            if (!val) continue;
            var cellVal = '';
            switch (col) {
                case 'outsourceStatus': cellVal = os.status || ''; break;
                case 'supplier': cellVal = os.supplier || ''; break;
                case 'location': cellVal = os.location || ''; break;
                case 'customerCode': cellVal = customerCode; break;
                case 'orderNo': cellVal = orderNo; break;
                case 'productCode': cellVal = productCode; break;
                case 'productName': cellVal = productName; break;
                case 'spec': cellVal = spec; break;
                case 'color': cellVal = color; break;
                case 'stamp': cellVal = stamp; break;
                case 'qty': cellVal = String(qty); break;
                case 'remark': cellVal = remark; break;
                default: break;
            }
            if (cellVal !== val) { matchCols = false; break; }
        }
        return matchKeyword && matchCols;
    });

    list.sort(function(a, b) { return b.id - a.id; });
    updateOutsourceStats();

    // 列配置
    var colOrder = getOutColumnOrder();
    var orderedColumns = [];
    colOrder.forEach(function(key) {
        var col = outsourceColumns.find(function(c) { return c.key === key; });
        if (col) orderedColumns.push(col);
    });
    outsourceColumns.forEach(function(col) {
        if (!orderedColumns.some(function(c) { return c.key === col.key; })) {
            orderedColumns.push(col);
        }
    });

    var visibleCols = orderedColumns.filter(function(col) {
        return outColumnsVisible[col.key] !== false;
    });
    if (!visibleCols.some(function(c) { return c.key === 'actions'; })) {
        var actionsCol = outsourceColumns.find(function(c) { return c.key === 'actions'; });
        if (actionsCol) visibleCols.push(actionsCol);
    }

    var defaultWidths = {
        'outsourceStatus': 120,
        'supplier': 140,
        'location': 80,
        'customerCode': 90,
        'orderNo': 140,
        'productCode': 160,
        'productName': 220,
        'spec': 200,
        'color': 80,
        'stamp': 80,
        'qty': 80,
        'remark': 180,
        'actions': 160
    };

    // 表头
    var thead = document.getElementById('outThead');
    if (!thead) return;
    var headerHtml = '<tr>';
    visibleCols.forEach(function(col) {
        var isSticky = (col.key === 'remark' || col.key === 'actions');
        var stickyClass = isSticky ? 'sticky-col' : '';
        var remarkClass = col.key === 'remark' ? 'sticky-col-remark' : '';
        var actionsClass = col.key === 'actions' ? 'sticky-col-actions' : '';
        var width = getOutColumnWidth(col.key) || defaultWidths[col.key] || 120;
        if (col.key === 'actions') {
            headerHtml += '<th data-col="' + col.key + '" class="' + stickyClass + ' ' + remarkClass + ' ' + actionsClass + '" style="width:' + width + 'px;min-width:' + width + 'px;">' + col.label + '</th>';
        } else {
            headerHtml += '<th data-col="' + col.key + '" class="' + stickyClass + ' ' + remarkClass + ' ' + actionsClass + '" style="position:relative;width:' + width + 'px;min-width:' + width + 'px;">' + col.label + '</th>';
        }
    });
    headerHtml += '</tr>';

    // 筛选行
    headerHtml += '<tr class="filter-row">';
    visibleCols.forEach(function(col) {
        if (col.key === 'actions') {
            headerHtml += '<th></th>';
            return;
        }
        var options = new Set();
        data.outsourceOrders.filter(function(os) { return os.status !== '已完成-待出货'; }).forEach(function(os) {
            var order = getOrder(os.orderId);
            if (!order) return;
            var val = '';
            switch (col.key) {
                case 'outsourceStatus': val = os.status || ''; break;
                case 'supplier': val = os.supplier || ''; break;
                case 'location': val = os.location || ''; break;
                case 'customerCode': val = order.customerCode || order.customer_code || ''; break;
                case 'orderNo': val = order.orderNo || order.order_no || ''; break;
                case 'productCode': val = order.productCode || order.product_code || ''; break;
                case 'productName': val = order.productName || order.product_name || ''; break;
                case 'spec': val = order.spec || ''; break;
                case 'color': val = order.color || ''; break;
                case 'stamp': val = order.stamp || ''; break;
                case 'qty': val = String(order.qty || 0); break;
                case 'remark': val = os.remark || ''; break;
                default: break;
            }
            if (val) options.add(val);
        });
        var sortedOptions = Array.from(options).sort();
        var selectHtml = '<select data-col="' + col.key + '" class="form-select form-select-sm" style="font-size:12px;border:1px solid #e2e8f0;border-radius:4px;padding:2px 4px;background:#fff;" onchange="renderOutsource()"><option value="">全部</option>';
        sortedOptions.forEach(function(opt) {
            selectHtml += '<option value="' + opt + '">' + opt + '</option>';
        });
        selectHtml += '</select>';
        headerHtml += '<th>' + selectHtml + '</th>';
    });
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    // 表格体
    var tbody = document.getElementById('outBody');
    if (!tbody) return;
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="' + (visibleCols.length + 1) + '" class="text-center text-muted">暂无外发订单</td></tr>';
        return;
    }

    var rowsHtml = '';
    list.forEach(function(os) {
        var order = getOrder(os.orderId);
        var isOrderDeleted = !order;
        var rowBg = isOrderDeleted ? '#fff3cd' : '';

        // ★★★ 读取订单扩展字段 ★★★
        var customerCode = order ? (order.customerCode || order.customer_code || '') : '';
        var orderNo = order ? (order.orderNo || order.order_no || '') : '';
        var productCode = order ? (order.productCode || order.product_code || '') : '';
        var productName = order ? (order.productName || order.product_name || '') : '';
        var spec = order ? (order.spec || '') : '';
        var color = order ? (order.color || '') : '';
        var stamp = order ? (order.stamp || '') : '';
        var qty = order ? (order.qty || 0) : 0;
        var remark = os.remark || '';

        var statusDisplay = os.status;
        if (order && order.qualityStatus === '质检未通过-返单(外发)') {
            statusDisplay = '质检未通过-返单';
        }
        if (isOrderDeleted) statusDisplay += ' ⚠️';

        rowsHtml += '<tr ondblclick="openOutsourceDetail(' + os.id + ')" style="' + (rowBg ? 'background-color:' + rowBg + ';' : '') + '">';
        visibleCols.forEach(function(col) {
            if (col.key === 'actions') {
                rowsHtml += '<td class="sticky-col sticky-col-actions" style="min-width:160px;white-space:nowrap;">';
                rowsHtml += '<button class="btn btn-sm btn-outline-custom" onclick="event.stopPropagation(); openOutsourceDetail(' + os.id + ')">';
                rowsHtml += '<i class="bi ' + (isOrderDeleted ? 'bi-link' : 'bi-pencil') + '"></i> ' + (isOrderDeleted ? '修复' : '编辑') + '</button>';
                rowsHtml += '<button class="btn btn-sm btn-outline-custom text-danger" onclick="event.stopPropagation(); if(confirm(\'确认删除此外发记录？\')) deleteOutsource(' + os.id + ')">';
                rowsHtml += '<i class="bi bi-trash3"></i> 删除</button>';
                rowsHtml += '</td>';
                return;
            }

            var val = '';
            var extraClass = '';
            if (col.key === 'productName' || col.key === 'spec' || col.key === 'remark' || col.key === 'supplier') {
                extraClass = 'wrap-cell';
            }
            if (col.key === 'productName') extraClass += ' product-name';
            if (col.key === 'spec') extraClass += ' spec-cell';
            var isSticky = (col.key === 'remark' || col.key === 'actions');
            var stickyClass = isSticky ? 'sticky-col' : '';
            var remarkClass = col.key === 'remark' ? 'sticky-col-remark' : '';
            var width = getOutColumnWidth(col.key) || defaultWidths[col.key] || 120;

            switch (col.key) {
                case 'outsourceStatus':
                    var loc = os.location ? ' · ' + os.location : '';
                    val = '<span class="badge-status ' + statusBadgeOut(statusDisplay) + '">' + statusDisplay + loc + '</span>';
                    break;
                case 'supplier': val = os.supplier || ''; break;
                case 'location': val = os.location || ''; break;
                case 'customerCode': val = isOrderDeleted ? '⚠️ 已删除' : customerCode; break;
                case 'orderNo': val = isOrderDeleted ? '<span style="color:#dc3545;font-weight:600;">订单已删除</span>' : orderNo; break;
                case 'productCode': val = isOrderDeleted ? '-' : productCode; break;
                case 'productName': val = isOrderDeleted ? '<span style="color:#999;">（已删除）</span>' : productName; break;
                case 'spec': val = isOrderDeleted ? '-' : spec; break;
                case 'color': val = isOrderDeleted ? '-' : color; break;
                case 'stamp': val = isOrderDeleted ? '-' : stamp; break;
                case 'qty': val = isOrderDeleted ? '0' : qty; break;
                case 'remark': val = remark; break;
                default: val = '';
            }

            rowsHtml += '<td class="' + stickyClass + ' ' + remarkClass + ' ' + extraClass + '" style="width:' + width + 'px;min-width:' + width + 'px;">' + val + '</td>';
        });
        rowsHtml += '</tr>';
    });

    tbody.innerHTML = rowsHtml;

    // 设置表格固定布局
    var table = document.getElementById('outTable');
    if (table) table.style.tableLayout = 'fixed';

    // 粘性列背景
    document.querySelectorAll('#outTable .sticky-col').forEach(function(el) {
        el.style.background = el.tagName === 'TH' ? '#fafbfc' : '#fff';
    });

    // 列宽拖拽
    setTimeout(function() {
        try {
            initOutsourceColumnResize('outTable');
        } catch (e) {
            console.warn('外发列宽拖拽初始化失败:', e);
        }
    }, 100);
}

function updateOutsourceStats() {
    const all = data.outsourceOrders.filter(os => os.status !== '已完成-待出货');
    const pending = all.filter(o => o.status === '待外发').length;
    const progress = all.filter(o => o.status === '外发中').length;
    const done = data.outsourceOrders.filter(o => o.status === '已完成-待出货').length;
    const location5 = all.filter(o => o.location === '5楼').length;
    const other = all.filter(o => o.location && o.location !== '5楼').length;
    const elPending = document.getElementById('outStatPending');
    const elProgress = document.getElementById('outStatProgress');
    const elDone = document.getElementById('outStatDone');
    const elLoc5 = document.getElementById('outStatLocation5');
    const elOther = document.getElementById('outStatOther');
    if (elPending) elPending.textContent = pending;
    if (elProgress) elProgress.textContent = progress;
    if (elDone) elDone.textContent = done;
    if (elLoc5) elLoc5.textContent = location5;
    if (elOther) elOther.textContent = other;
}

function resetOutFilters() {
    document.getElementById('outFilterKeyword').value = '';
    document.querySelectorAll('.filter-row select').forEach(sel => { sel.value = ''; });
    renderOutsource();
}

// ============================================================
//  新建外发
// ============================================================

function openOutsourceModal() {
    const select = document.getElementById('outOrderSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- 请选择订单 --</option>';
    data.orders.forEach(o => {
        const existing = data.outsourceOrders.find(os => os.orderId === o.id);
        if (existing && (existing.status === '已完成-待出货')) return;
        select.innerHTML += `<option value="${o.id}">${o.orderNo} - ${o.productName}</option>`;
    });
    const now = new Date();
    const dateStr = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
    const count = data.outsourceOrders.length + 1;
    const outNo = document.getElementById('outOutsourceNo');
    if (outNo) outNo.value = 'WF' + dateStr + String(count).padStart(4,'0');
    const outDate = document.getElementById('outDate');
    if (outDate) outDate.value = now.toISOString().slice(0,10);
    const outStatus = document.getElementById('outStatus');
    if (outStatus) outStatus.value = '待外发';
    const outLocation = document.getElementById('outLocation');
    if (outLocation) outLocation.value = '5楼';
    const outSupplier = document.getElementById('outSupplier');
    if (outSupplier) outSupplier.value = '';
    const outReturnDate = document.getElementById('outReturnDate');
    if (outReturnDate) outReturnDate.value = '';
    const outRemark = document.getElementById('outRemark');
    if (outRemark) outRemark.value = '';
    new bootstrap.Modal(document.getElementById('outsourceModal')).show();
}

async function saveOutsource() {
    const orderId = parseInt(document.getElementById('outOrderSelect').value);
    if (!orderId) { alert('请选择关联订单'); return; }
    const status = document.getElementById('outStatus').value;
    const location = document.getElementById('outLocation').value.trim() || '5楼';
    const outsourceDate = document.getElementById('outDate').value;
    const supplier = document.getElementById('outSupplier').value.trim();
    const returnDate = document.getElementById('outReturnDate').value;
    const remark = document.getElementById('outRemark').value.trim();

    if (data.outsourceOrders.some(o => o.orderId === orderId && o.status !== '已完成-待出货')) {
        alert('该订单已有外发记录，不能重复创建');
        return;
    }
    const order = getOrder(orderId);
    if (!order) { alert('订单不存在'); return; }

    const newOut = {
        order_id: orderId,
        outsource_no: document.getElementById('outOutsourceNo').value,
        status: status,
        location: location,
        outsource_date: outsourceDate || new Date().toISOString().slice(0,10),
        supplier: supplier,
        return_date: returnDate,
        remark: remark
    };

    try {
        showToast('⏳ 正在创建外发记录...', 'info');
        const created = await apiCreateOutsource(newOut);
        const outData = {
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
        data.outsourceOrders.push(outData);
        // 更新订单状态
        order.outsourceStatus = status;
        order.outsourceLocation = location;
        order.source = 'outsource';
        if (status !== '已完成-待出货') { order.status = '外发中'; }
        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }
        closeModal('outsourceModal');
        renderOutsource();
        showToast('✅ 外发单创建成功', 'success');
    } catch (error) {
        showToast('❌ 创建失败: ' + error.message, 'error');
        console.error(error);
    }
}

// ============================================================
//  外发详情
// ============================================================

function openOutsourceDetail(outId) {
    const os = data.outsourceOrders.find(o => o.id === outId);
    if (!os) { alert('外发记录不存在'); return; }

    let order = getOrder(os.orderId);

    const existingFixBtn = document.getElementById('fixOrderRelationBtn');
    if (existingFixBtn) existingFixBtn.remove();
    const oldSelector = document.getElementById('fixOrderSelectorContainer');
    if (oldSelector) oldSelector.remove();

    if (!order) {
        document.getElementById('outDetailId').value = os.id;
        document.getElementById('outDetailNo').value = os.outsourceNo || 'WF-' + String(os.id).padStart(4, '0');
        document.getElementById('outDetailOrderNo').value = '⚠️ 关联订单已删除';
        document.getElementById('outDetailProduct').value = '（订单已删除，请重新关联）';
        document.getElementById('outDetailQty').value = 0;
        document.getElementById('outDetailCustomer').value = '';
        document.getElementById('outDetailStatus').value = os.status || '待外发';
        document.getElementById('outDetailLocation').value = os.location || '';
        document.getElementById('outDetailDate').value = os.outsourceDate || '';
        document.getElementById('outDetailSupplier').value = os.supplier || '';
        document.getElementById('outDetailReturnDate').value = os.returnDate || '';
        document.getElementById('outDetailRemark').value = os.remark || '';

        const footer = document.querySelector('#outsourceDetailModal .modal-footer');
        const fixBtn = document.createElement('button');
        fixBtn.id = 'fixOrderRelationBtn';
        fixBtn.className = 'btn btn-warning';
        fixBtn.innerHTML = '<i class="bi bi-link"></i> 修复关联订单';
        fixBtn.onclick = function() { fixOrderRelation(os.id); };
        footer.insertBefore(fixBtn, footer.querySelector('.btn-primary-custom'));

        const saveBtn = footer.querySelector('.btn-primary-custom');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="bi bi-save"></i> 保存（先修复关联）';
        }

        new bootstrap.Modal(document.getElementById('outsourceDetailModal')).show();
        return;
    }

    document.getElementById('outDetailId').value = os.id;
    document.getElementById('outDetailNo').value = os.outsourceNo || 'WF-' + String(os.id).padStart(4, '0');
    document.getElementById('outDetailOrderNo').value = order.orderNo || '';
    document.getElementById('outDetailProduct').value = order.productName || '';
    document.getElementById('outDetailQty').value = order.qty || 0;
    document.getElementById('outDetailCustomer').value = order.customerCode || '';
    document.getElementById('outDetailStatus').value = os.status || '待外发';
    document.getElementById('outDetailLocation').value = os.location || '';
    document.getElementById('outDetailDate').value = os.outsourceDate || '';
    document.getElementById('outDetailSupplier').value = os.supplier || '';
    document.getElementById('outDetailReturnDate').value = os.returnDate || '';
    document.getElementById('outDetailRemark').value = os.remark || '';

    const footer = document.querySelector('#outsourceDetailModal .modal-footer');
    const saveBtn = footer.querySelector('.btn-primary-custom');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="bi bi-save"></i> 保存修改';
    }

    new bootstrap.Modal(document.getElementById('outsourceDetailModal')).show();
}

// ★★★ 保存外发详情（修复版） ★★★
async function saveOutsourceDetail() {
    const id = parseInt(document.getElementById('outDetailId').value);
    const os = data.outsourceOrders.find(o => o.id === id);
    if (!os) { alert('外发记录不存在'); return; }

    const order = getOrder(os.orderId);
    if (!order) {
        alert('⚠️ 关联订单已删除，请先点击"修复关联订单"重新关联');
        return;
    }

    // ★★★ 兼容字段名：确保 order.orderNo 存在 ★★★
    if (!order.orderNo && order.order_no) {
        order.orderNo = order.order_no;
    }

    const newStatus = document.getElementById('outDetailStatus').value;
    const location = document.getElementById('outDetailLocation').value.trim();
    const outsourceDate = document.getElementById('outDetailDate').value;
    const supplier = document.getElementById('outDetailSupplier').value.trim();
    const returnDate = document.getElementById('outDetailReturnDate').value;
    const remark = document.getElementById('outDetailRemark').value.trim();

    try {
        showToast('⏳ 正在保存外发记录...', 'info');

        // ★★★ 1. 先更新外发记录 ★★★
        await apiUpdateOutsource(id, {
            order_id: os.orderId,
            outsource_no: os.outsourceNo,
            status: newStatus,
            location: location,
            outsource_date: outsourceDate,
            supplier: supplier,
            return_date: returnDate,
            remark: remark
        });

        // ★★★ 2. 更新本地外发数据 ★★★
        os.status = newStatus;
        os.location = location;
        os.outsourceDate = outsourceDate;
        os.supplier = supplier;
        os.returnDate = returnDate;
        os.remark = remark;

        // ★★★ 3. 同步更新订单状态 ★★★
        try {
            order.outsourceStatus = newStatus;
            order.outsourceLocation = location;
            order.source = 'outsource';

            if (newStatus === '已完成-待出货') {
                order.status = '待出货';
                order.shipmentStatus = '待出货';
                order.qualityStatus = '质检中';
            } else {
                order.status = '外发中';
            }
            if (order.qualityStatus === '质检未通过-返单(外发)') {
                order.qualityStatus = '外发中';
            }

            // 调用订单状态更新（如果失败只警告，不影响外发保存）
            if (typeof window.saveOrderStatus === 'function') {
                await window.saveOrderStatus(order);
            }
        } catch (orderError) {
            console.warn('⚠️ 订单状态更新失败，但外发记录已保存:', orderError);
        }

        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }

        // ★★★ 4. 关闭模态框并刷新列表 ★★★
        const modalEl = document.getElementById('outsourceDetailModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        renderOutsource();
        showToast('✅ 外发记录已保存', 'success');

    } catch (error) {
        console.error('保存外发详情错误:', error);
        showToast('❌ 保存失败: ' + error.message, 'error');
    }
}

// ============================================================
//  删除外发记录
// ============================================================

async function deleteOutsource(id) {
    if (!confirm('确认删除此外发记录？')) return;
    try {
        await apiDeleteOutsource(id);
        const os = data.outsourceOrders.find(o => o.id === id);
        if (os) {
            const order = getOrder(os.orderId);
            if (order) {
                order.outsourceStatus = '';
                order.outsourceLocation = '';
                if (order.status === '外发中') {
                    order.status = '待生产';
                }
                // 订单状态更新失败只警告
                try {
                    if (typeof window.saveOrderStatus === 'function') {
                        await window.saveOrderStatus(order);
                    }
                } catch (e) {
                    console.warn('订单状态更新失败，但外发已删除:', e);
                }
            }
        }
        data.outsourceOrders = data.outsourceOrders.filter(o => o.id !== id);
        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }
        renderOutsource();
        showToast('✅ 外发记录已删除', 'success');
    } catch (error) {
        showToast('❌ 删除失败: ' + error.message, 'error');
        console.error(error);
    }
}

// ============================================================
//  修复关联订单
// ============================================================

function fixOrderRelation(outId) {
    const os = data.outsourceOrders.find(o => o.id === outId);
    if (!os) { alert('外发记录不存在'); return; }

    const container = document.createElement('div');
    container.id = 'fixOrderSelectorContainer';
    container.style.cssText = 'padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e9edf2;margin-top:8px;';
    container.innerHTML = `
        <div style="font-weight:600;margin-bottom:8px;">📋 请选择要关联的订单：</div>
        <select id="fixOrderSelect" class="form-select" style="font-size:14px;">
            <option value="">-- 请选择 --</option>
            ${data.orders.map(o => `<option value="${o.id}">${o.orderNo} - ${o.productName} (${o.customerCode})</option>`).join('')}
        </select>
        <div style="margin-top:8px;display:flex;gap:8px;">
            <button class="btn btn-sm btn-primary-custom" onclick="confirmFixOrderRelation(${outId})"><i class="bi bi-check-lg"></i> 确认关联</button>
            <button class="btn btn-sm btn-secondary" onclick="document.getElementById('fixOrderSelectorContainer').remove()">取消</button>
        </div>
    `;

    const body = document.querySelector('#outsourceDetailModal .modal-body');
    const oldSelector = document.getElementById('fixOrderSelectorContainer');
    if (oldSelector) oldSelector.remove();
    body.appendChild(container);
}

async function confirmFixOrderRelation(outId) {
    const select = document.getElementById('fixOrderSelect');
    if (!select) { alert('请选择订单'); return; }
    const orderId = parseInt(select.value);
    if (!orderId) { alert('请选择有效的订单'); return; }

    const os = data.outsourceOrders.find(o => o.id === outId);
    if (!os) { alert('外发记录不存在'); return; }

    const order = getOrder(orderId);
    if (!order) { alert('订单不存在'); return; }

    try {
        await apiUpdateOutsource(outId, {
            order_id: orderId,
            outsource_no: os.outsourceNo,
            status: os.status,
            location: os.location,
            outsource_date: os.outsourceDate,
            supplier: os.supplier,
            return_date: os.returnDate,
            remark: os.remark
        });

        os.orderId = orderId;
        if (order) {
            order.outsourceStatus = os.status || '待外发';
            order.outsourceLocation = os.location || '5楼';
            order.source = 'outsource';
            if (os.status !== '已完成-待出货') {
                order.status = '外发中';
            }
            try {
                if (typeof window.saveOrderStatus === 'function') {
                    await window.saveOrderStatus(order);
                }
            } catch (e) {
                console.warn('订单状态更新失败，但外发已修复:', e);
            }
        }
        if (typeof window.saveDataToStorage === 'function') {
            window.saveDataToStorage();
        }

        const container = document.getElementById('fixOrderSelectorContainer');
        if (container) container.remove();

        openOutsourceDetail(outId);
        renderOutsource();
        showToast('✅ 关联订单已修复！', 'success');
    } catch (error) {
        showToast('❌ 修复失败: ' + error.message, 'error');
        console.error(error);
    }
}

// ============================================================
//  导出外发单
// ============================================================

function exportOutOrdersToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Excel 库未加载，请刷新页面后重试。');
        return;
    }
    const monthVal = document.getElementById('outExportMonthPicker')?.value || '';
    let list = data.outsourceOrders.filter(os => {
        const order = getOrder(os.orderId);
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
    if (list.length === 0) { alert('没有外发数据可导出（请检查月份筛选）'); return; }

    const exportData = list.map(os => {
        const order = getOrder(os.orderId);
        return {
            '外发单号': os.outsourceNo || '',
            '外发状态': os.status || '',
            '外发': os.location || '',
            '外发供应商': os.supplier || '',
            '客户号': order ? order.customerCode : '',
            '订单号': order ? order.orderNo : '',
            '产品编号': order ? order.productCode : '',
            '产品名称': order ? order.productName : '',
            '规格型号': order ? order.spec : '',
            '颜色': order ? order.color : '',
            '压唛': order ? order.stamp : '',
            '订单数量': order ? order.qty : 0,
            '外发日期': os.outsourceDate || '',
            '预计返回': os.returnDate || '',
            '备注': os.remark || ''
        };
    });

    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        const colWidths = Object.keys(exportData[0] || {}).map(key => ({ wch: Math.max(key.length * 2, 12) }));
        ws['!cols'] = colWidths;
        const dateStr = new Date().toISOString().slice(0,10);
        const monthLabel = monthVal ? monthVal.replace('-','年') + '月' : '全部';
        const fileName = `外发单导出_${monthLabel}_${dateStr}.xlsx`;
        XLSX.writeFile(wb, fileName);
        alert(`✅ 成功导出 ${exportData.length} 条外发数据！`);
    } catch(err) { alert('导出失败：' + err.message); }
}

// ============================================================
//  列设置模态框
// ============================================================

function openOutColumnSettings() {
    const content = document.getElementById('outColumnSettingsContent');
    const order = getOutColumnOrder();
    let html = `<div class="mb-2"><strong>调整列顺序（点击 ↑↓ 移动）</strong></div>`;
    html += `<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="out_col_all" onchange="toggleOutAllColumns(this.checked)"><label class="form-check-label" for="out_col_all">全选</label></div>`;
    html += `<div id="outColumnSortableList" class="list-group">`;
    order.forEach((key) => {
        if (key === 'actions') return;
        const col = outsourceColumns.find(c => c.key === key);
        if (!col) return;
        const checked = outColumnsVisible[col.key] !== false ? 'checked' : '';
        html += `<div class="list-group-item d-flex align-items-center justify-content-between" data-key="${key}" style="padding:6px 12px;">
            <div class="d-flex align-items-center gap-2">
                <input type="checkbox" class="form-check-input out-col-check" data-col="${key}" ${checked} onchange="updateOutColumnVisibility()">
                <span style="font-weight:500;">${col.label}</span>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-secondary" onclick="moveOutColumnUp('${key}')" title="上移">↑</button>
                <button class="btn btn-sm btn-outline-secondary" onclick="moveOutColumnDown('${key}')" title="下移">↓</button>
            </div>
        </div>`;
    });
    html += `</div>`;
    content.innerHTML = html;
    new bootstrap.Modal(document.getElementById('outColumnSettingsModal')).show();
}

function moveOutColumnUp(key) {
    const order = getOutColumnOrder();
    const idx = order.indexOf(key);
    if (idx <= 0) return;
    [order[idx-1], order[idx]] = [order[idx], order[idx-1]];
    saveOutColumnOrder(order);
    openOutColumnSettings();
    renderOutsource();
}

function moveOutColumnDown(key) {
    const order = getOutColumnOrder();
    const idx = order.indexOf(key);
    if (idx === -1 || idx >= order.length - 1) return;
    [order[idx], order[idx+1]] = [order[idx+1], order[idx]];
    saveOutColumnOrder(order);
    openOutColumnSettings();
    renderOutsource();
}

function updateOutColumnVisibility() {
    document.querySelectorAll('.out-col-check').forEach(cb => {
        const col = cb.dataset.col;
        outColumnsVisible[col] = cb.checked;
    });
    saveDataToStorage();
    renderOutsource();
}

function toggleOutAllColumns(checked) {
    document.querySelectorAll('.out-col-check').forEach(cb => {
        cb.checked = checked;
        const col = cb.dataset.col;
        outColumnsVisible[col] = checked;
    });
    saveDataToStorage();
    renderOutsource();
}

function resetOutColumns() {
    if (!confirm('恢复所有列到默认顺序和可见性，列宽也将重置。确定？')) return;
    const defaultOrder = outsourceColumns.map(c => c.key);
    saveOutColumnOrder(defaultOrder);
    outsourceColumns.forEach(col => {
        if (col.key !== 'actions') outColumnsVisible[col.key] = true;
    });
    localStorage.removeItem(OUT_COLUMN_WIDTHS_KEY);
    saveDataToStorage();
    renderOutsource();
    const modal = bootstrap.Modal.getInstance(document.getElementById('outColumnSettingsModal'));
    if (modal) modal.hide();
    alert('✅ 列已恢复默认（顺序、可见性、宽度）');
}

// ============================================================
//  暴露全局
// ============================================================

window.initOutsource = initOutsource;
window.renderOutsource = renderOutsource;
window.resetOutFilters = resetOutFilters;
window.openOutsourceModal = openOutsourceModal;
window.saveOutsource = saveOutsource;
window.openOutsourceDetail = openOutsourceDetail;
window.saveOutsourceDetail = saveOutsourceDetail;
window.deleteOutsource = deleteOutsource;
window.exportOutOrdersToExcel = exportOutOrdersToExcel;
window.openOutColumnSettings = openOutColumnSettings;
window.updateOutColumnVisibility = updateOutColumnVisibility;
window.toggleOutAllColumns = toggleOutAllColumns;
window.resetOutColumns = resetOutColumns;
window.moveOutColumnUp = moveOutColumnUp;
window.moveOutColumnDown = moveOutColumnDown;
window.fixOrderRelation = fixOrderRelation;
window.confirmFixOrderRelation = confirmFixOrderRelation;
window.apiGetOutsource = apiGetOutsource;
window.apiCreateOutsource = apiCreateOutsource;
window.apiUpdateOutsource = apiUpdateOutsource;
window.apiDeleteOutsource = apiDeleteOutsource;

console.log('✅ outsource.js 已完整加载（服务器存储版本）');