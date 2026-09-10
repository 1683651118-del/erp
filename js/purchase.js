// ============================================================
//  采购管理模块（完整版 · 服务器存储）
//  功能：采购单生成、供应商管理、多色底色、采购备注列、列设置
//  优化：移除保存弹窗、统一绿色、备注加粗、搜索入口、表格内容自动换行
//  新增：合并采购（多个订单合并到一张采购单，明细独立显示）
//  新增：列筛选、表头固定
// ============================================================

// ★★★ 确保 showToast 存在 ★★★
if (typeof showToast === 'undefined') {
    window.showToast = function(message, type = 'success') {
        console.log('📢 [Toast]', type, message);
        alert(message);
    };
    console.warn('⚠️ showToast 未加载，已使用备用 alert 替代');
}

(function() {
    'use strict';

    console.log('🔄 采购管理模块加载中...');

    // ============================================================
    //  列设置 - 配置常量
    // ============================================================
    var PURCHASE_COLUMN_ORDER_KEY = 'erp_purchase_column_order';
    var PURCHASE_COLUMN_WIDTHS_KEY = 'erp_purchase_column_widths';
    var PURCHASE_COLUMN_VISIBLE_KEY = 'erp_purchase_column_visible';

    var purchaseColumnDefs = [
        { key: 'checkbox', label: '☑' },
        { key: 'orderNo', label: '订单号' },
        { key: 'customerCode', label: '客户号' },
        { key: 'productName', label: '产品名称' },
        { key: 'spec', label: '规格' },
        { key: 'color', label: '颜色' },
        { key: 'qty', label: '数量' },
        { key: 'category', label: '类别' },
        { key: 'status', label: '状态' },
        { key: 'boardPurchased', label: '板材采购' },
        { key: 'magnetPurchased', label: '磁铁采购' },
        { key: 'shellPurchased', label: '壳子采购' },
        { key: 'purchaseRemark', label: '采购备注' },
        { key: 'actions', label: '操作' }
    ];

    var defaultColumnWidths = {
        'checkbox': 40,
        'orderNo': 140,
        'customerCode': 90,
        'productName': 200,
        'spec': 160,
        'color': 80,
        'qty': 70,
        'category': 70,
        'status': 90,
        'boardPurchased': 110,
        'magnetPurchased': 110,
        'shellPurchased': 110,
        'purchaseRemark': 180,
        'actions': 60
    };

    var defaultColumnOrder = purchaseColumnDefs.map(function(c) { return c.key; });

    var defaultColumnVisible = {};
    purchaseColumnDefs.forEach(function(c) { defaultColumnVisible[c.key] = true; });

    // ============================================================
    //  列设置 - 读写函数
    // ============================================================
    function getPurchaseColumnOrder() {
        try {
            var stored = localStorage.getItem(PURCHASE_COLUMN_ORDER_KEY);
            if (stored) {
                var order = JSON.parse(stored);
                var allKeys = purchaseColumnDefs.map(function(c) { return c.key; });
                var missingKeys = allKeys.filter(function(k) { return order.indexOf(k) === -1; });
                if (missingKeys.length > 0) {
                    var newOrder = order.concat(missingKeys);
                    savePurchaseColumnOrder(newOrder);
                    return newOrder;
                }
                return order;
            }
        } catch (e) {}
        return defaultColumnOrder.slice();
    }
    function savePurchaseColumnOrder(orderArray) {
        localStorage.setItem(PURCHASE_COLUMN_ORDER_KEY, JSON.stringify(orderArray));
    }
    function getPurchaseColumnWidths() {
        try {
            var stored = localStorage.getItem(PURCHASE_COLUMN_WIDTHS_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) { return {}; }
    }
    function savePurchaseColumnWidth(colKey, width) {
        var widths = getPurchaseColumnWidths();
        widths[colKey] = width;
        localStorage.setItem(PURCHASE_COLUMN_WIDTHS_KEY, JSON.stringify(widths));
    }
    function getPurchaseColumnWidth(colKey) {
        var widths = getPurchaseColumnWidths();
        return widths[colKey] || defaultColumnWidths[colKey] || 100;
    }
    function getPurchaseColumnVisible() {
        try {
            var stored = localStorage.getItem(PURCHASE_COLUMN_VISIBLE_KEY);
            if (stored) {
                var visible = JSON.parse(stored);
                purchaseColumnDefs.forEach(function(c) {
                    if (visible[c.key] === undefined) visible[c.key] = true;
                });
                return visible;
            }
        } catch (e) {}
        var defaultVisible = {};
        purchaseColumnDefs.forEach(function(c) { defaultVisible[c.key] = true; });
        return defaultVisible;
    }
    function savePurchaseColumnVisible(visibleObj) {
        localStorage.setItem(PURCHASE_COLUMN_VISIBLE_KEY, JSON.stringify(visibleObj));
    }

    // ============================================================
    //  列宽拖拽初始化
    // ============================================================
    function initPurchaseColumnResize() {
        var table = document.querySelector('#purchaseOrderList table');
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

            var savedWidth = getPurchaseColumnWidth(colKey);
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
            newWidth = Math.max(50, newWidth);
            newWidth = Math.min(400, newWidth);

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
            savePurchaseColumnWidth(dragData.colKey, newWidth);

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
    //  列设置 - 模态框
    // ============================================================
    function openPurchaseColumnSettings() {
        var content = document.getElementById('purchaseColumnSettingsContent');
        if (!content) return;

        var order = getPurchaseColumnOrder();
        var visible = getPurchaseColumnVisible();

        var html = '<div class="mb-2"><strong>调整列顺序（点击 ↑↓ 移动）</strong></div>';
        html += '<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="purchase_col_all" onchange="togglePurchaseAllColumns(this.checked)"><label class="form-check-label" for="purchase_col_all">全选</label></div>';
        html += '<div id="purchaseColumnSortableList" class="list-group">';

        order.forEach(function(key) {
            var col = purchaseColumnDefs.find(function(c) { return c.key === key; });
            if (!col) return;
            var isCheckbox = key === 'checkbox';
            var checked = (visible[key] !== false) ? 'checked' : '';
            var disabledAttr = isCheckbox ? 'disabled' : '';
            html += '<div class="list-group-item d-flex align-items-center justify-content-between" data-key="' + key + '" style="padding:6px 12px;">';
            html += '<div class="d-flex align-items-center gap-2">';
            html += '<input type="checkbox" class="form-check-input purchase-col-check" data-col="' + key + '" ' + checked + ' ' + disabledAttr + ' onchange="updatePurchaseColumnVisibility()">';
            html += '<span style="font-weight:500;">' + col.label + '</span>';
            if (isCheckbox) html += '<span class="text-muted" style="font-size:11px;">（固定）</span>';
            html += '</div>';
            html += '<div>';
            html += '<button class="btn btn-sm btn-outline-secondary" onclick="movePurchaseColumnUp(\'' + key + '\')" title="上移">↑</button>';
            html += '<button class="btn btn-sm btn-outline-secondary" onclick="movePurchaseColumnDown(\'' + key + '\')" title="下移">↓</button>';
            html += '</div>';
            html += '</div>';
        });

        html += '</div>';
        content.innerHTML = html;

        var modal = new bootstrap.Modal(document.getElementById('purchaseColumnSettingsModal'));
        modal.show();
    }

    function refreshPurchaseColumnSettingsList() {
        var container = document.getElementById('purchaseColumnSortableList');
        if (!container) return;
        var order = getPurchaseColumnOrder();
        var visible = getPurchaseColumnVisible();
        var html = '';

        order.forEach(function(key) {
            var col = purchaseColumnDefs.find(function(c) { return c.key === key; });
            if (!col) return;
            var isCheckbox = key === 'checkbox';
            var checked = (visible[key] !== false) ? 'checked' : '';
            var disabledAttr = isCheckbox ? 'disabled' : '';
            html += '<div class="list-group-item d-flex align-items-center justify-content-between" data-key="' + key + '" style="padding:6px 12px;">';
            html += '<div class="d-flex align-items-center gap-2">';
            html += '<input type="checkbox" class="form-check-input purchase-col-check" data-col="' + key + '" ' + checked + ' ' + disabledAttr + ' onchange="updatePurchaseColumnVisibility()">';
            html += '<span style="font-weight:500;">' + col.label + '</span>';
            if (isCheckbox) html += '<span class="text-muted" style="font-size:11px;">（固定）</span>';
            html += '</div>';
            html += '<div>';
            html += '<button class="btn btn-sm btn-outline-secondary" onclick="movePurchaseColumnUp(\'' + key + '\')" title="上移">↑</button>';
            html += '<button class="btn btn-sm btn-outline-secondary" onclick="movePurchaseColumnDown(\'' + key + '\')" title="下移">↓</button>';
            html += '</div>';
            html += '</div>';
        });

        container.innerHTML = html;

        var allCheckbox = document.getElementById('purchase_col_all');
        if (allCheckbox) {
            var items = document.querySelectorAll('.purchase-col-check:not([disabled])');
            var checkedItems = document.querySelectorAll('.purchase-col-check:not([disabled]):checked');
            allCheckbox.checked = items.length > 0 && checkedItems.length === items.length;
        }
    }

    function movePurchaseColumnUp(key) {
        var order = getPurchaseColumnOrder();
        var idx = order.indexOf(key);
        if (idx <= 0) return;
        var temp = order[idx - 1];
        order[idx - 1] = order[idx];
        order[idx] = temp;
        savePurchaseColumnOrder(order);
        refreshPurchaseColumnSettingsList();
        renderPurchaseOrders();
    }

    function movePurchaseColumnDown(key) {
        var order = getPurchaseColumnOrder();
        var idx = order.indexOf(key);
        if (idx === -1 || idx >= order.length - 1) return;
        var temp = order[idx + 1];
        order[idx + 1] = order[idx];
        order[idx] = temp;
        savePurchaseColumnOrder(order);
        refreshPurchaseColumnSettingsList();
        renderPurchaseOrders();
    }

    function updatePurchaseColumnVisibility() {
        var visible = getPurchaseColumnVisible();
        document.querySelectorAll('.purchase-col-check').forEach(function(cb) {
            var col = cb.dataset.col;
            if (cb.disabled) return;
            visible[col] = cb.checked;
        });
        savePurchaseColumnVisible(visible);
        renderPurchaseOrders();
    }

    function togglePurchaseAllColumns(checked) {
        document.querySelectorAll('.purchase-col-check:not([disabled])').forEach(function(cb) {
            cb.checked = checked;
            var col = cb.dataset.col;
            var visible = getPurchaseColumnVisible();
            visible[col] = checked;
            savePurchaseColumnVisible(visible);
        });
        renderPurchaseOrders();
    }

    function resetPurchaseColumns() {
        if (!confirm('恢复所有列到默认顺序和可见性，列宽也将重置。确定？')) return;
        savePurchaseColumnOrder(defaultColumnOrder.slice());
        var defaultVisible = {};
        purchaseColumnDefs.forEach(function(c) { defaultVisible[c.key] = true; });
        savePurchaseColumnVisible(defaultVisible);
        localStorage.removeItem(PURCHASE_COLUMN_WIDTHS_KEY);
        renderPurchaseOrders();
        var modal = bootstrap.Modal.getInstance(document.getElementById('purchaseColumnSettingsModal'));
        if (modal) modal.hide();
        alert('✅ 列已恢复默认（顺序、可见性、宽度）');
    }

    // ============================================================
    //  供应商数据管理
    // ============================================================
    function getSuppliers() {
        try {
            var stored = localStorage.getItem('erp_suppliers');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch(e) {}
        return [
            { name: '华沃', delivery: '联系人：邹江来 13049860739 东莞市凤岗镇排沙围广新街5号 盈广加工' }
        ];
    }
    function saveSuppliers(suppliers) {
        localStorage.setItem('erp_suppliers', JSON.stringify(suppliers));
    }

    // ============================================================
    //  状态颜色映射
    // ============================================================
    function getBadgeClass(status) {
        var map = {
            '待生产': 'bg-soft-secondary',
            '生产中': 'bg-soft-warning',
            '待质检': 'bg-soft-warning',
            '待出货': 'bg-soft-primary',
            '已完成': 'bg-soft-success',
            '已出货': 'bg-soft-success',
            '外发中': 'bg-soft-primary',
            '待外发': 'bg-soft-warning',
            '已完成-待送货': 'bg-soft-info',
            '质检未通过-返单': 'bg-soft-danger',
            '已送货完成': 'bg-soft-success'
        };
        return map[status] || 'bg-soft-secondary';
    }

    // ============================================================
    //  数据获取
    // ============================================================
    function getOrders() {
        if (typeof data !== 'undefined' && data.orders && data.orders.length > 0) {
            return data.orders;
        }
        if (typeof window.data !== 'undefined' && window.data.orders && window.data.orders.length > 0) {
            return window.data.orders;
        }
        try {
            var stored = localStorage.getItem('erp_production_data');
            if (stored) {
                var parsed = JSON.parse(stored);
                var orders = parsed.orders || [];
                if (typeof data !== 'undefined') {
                    data.orders = orders;
                }
                if (typeof window.data !== 'undefined') {
                    window.data.orders = orders;
                }
                return orders;
            }
        } catch(e) {
            console.error('❌ 读取 localStorage 失败:', e);
        }
        return [];
    }

    function getLinkedProduct(order) {
        var product = null;
        if (order.productCode) {
            product = data.products.find(function(p) { return p.code === order.productCode; });
        }
        if (!product && order.productName) {
            product = data.products.find(function(p) { return p.name === order.productName; });
        }
        return product;
    }

    function getProductMaterialSpec(order, type) {
        var product = getLinkedProduct(order);
        if (!product || !product.materialDetail || !Array.isArray(product.materialDetail)) {
            return null;
        }
        var materials = [];
        var typeKeywords = {
            board: ['板', '板材'],
            shell: ['壳', '壳子', '皮套']
        };
        var keywords = typeKeywords[type] || [];
        product.materialDetail.forEach(function(row) {
            if (row && row.length >= 4) {
                var name = (row[0] || '').trim();
                var color = (row[1] || '').trim();
                var qty = (row[2] || '').trim();
                var remark = (row[3] || '').trim();
                var rowType = (row[4] || '').trim();
                var lowerName = name.toLowerCase();
                var matched = false;
                if (rowType) {
                    var typeMap = { '板材': 'board', '壳子': 'shell', '皮套': 'shell' };
                    matched = (typeMap[rowType] === type);
                }
                if (!matched) {
                    matched = keywords.some(function(kw) { return lowerName.indexOf(kw) !== -1; });
                }
                if (matched) {
                    var parts = [name];
                    if (color) parts.push('(' + color + ')');
                    if (qty) parts.push(qty + '个');
                    if (remark) parts.push('【' + remark + '】');
                    materials.push(parts.join(' '));
                }
            }
        });
        if (materials.length > 0) {
            return materials.join('；');
        }
        return null;
    }

    function getCategory(order) {
        var hasBoard = order.materialBoard && order.materialBoard.trim() !== '' && order.materialBoard !== '√';
        var hasShell = order.materialShell && order.materialShell.trim() !== '' && order.materialShell !== '√';
        var hasMagnet = false;

        if (order.magnetDetail) {
            try {
                var mag = JSON.parse(order.magnetDetail);
                if (Array.isArray(mag) && mag.length > 0) {
                    var valid = mag.some(function(row) { return row && row.length >= 1 && (row[0] || row[1]); });
                    if (valid) hasMagnet = true;
                }
            } catch(e) {}
        }

        if (!hasMagnet) {
            var product = getLinkedProduct(order);
            if (product && product.magnetDetail) {
                try {
                    var mag2 = JSON.parse(product.magnetDetail);
                    if (Array.isArray(mag2) && mag2.length > 0) {
                        var valid2 = mag2.some(function(row) { return row && row.length >= 1 && (row[0] || row[1]); });
                        if (valid2) hasMagnet = true;
                    }
                } catch(e) {}
            }
        }

        if (hasBoard) return 'board';
        if (hasMagnet) return 'magnet';
        if (hasShell) return 'shell';
        return 'material';
    }

    function getCategoryLabel(cat) {
        var map = { 'board': '板材', 'magnet': '磁铁', 'shell': '壳子', 'material': '材料' };
        return map[cat] || cat;
    }

    // ============================================================
    //  高亮管理 - 延迟初始化
    // ============================================================
    var purchaseHighlight = null;

    // ============================================================
    //  选中的订单ID
    // ============================================================
    function getSelectedOrderIds() {
        var checkboxes = document.querySelectorAll('.purchase-order-checkbox:checked');
        var ids = [];
        checkboxes.forEach(function(cb) {
            var id = parseInt(cb.dataset.orderId);
            if (!isNaN(id)) ids.push(id);
        });
        return ids;
    }

    function updateSelectedCount() {
        var count = getSelectedOrderIds().length;
        var el = document.getElementById('selectedOrderCount');
        if (el) el.textContent = '已选 ' + count + ' 个';
    }

    function toggleAllOrders(checked) {
        var checkboxes = document.querySelectorAll('.purchase-order-checkbox');
        checkboxes.forEach(function(cb) { cb.checked = checked; });
        updateSelectedCount();
    }

    // ============================================================
    //  搜索过滤
    // ============================================================
    var purchaseSearchKeyword = '';

    function filterPurchaseOrders() {
        var input = document.getElementById('purchaseSearchInput');
        if (input) {
            purchaseSearchKeyword = input.value.trim().toLowerCase();
        } else {
            purchaseSearchKeyword = '';
        }
        renderPurchaseOrders();
    }

    // ============================================================
    //  生成采购单
    // ============================================================
    function generatePurchaseOrderNumber() {
        var now = new Date();
        var dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        var countKey = 'purchase_order_counter_' + dateStr;
        var count = parseInt(localStorage.getItem(countKey)) || 0;
        count++;
        localStorage.setItem(countKey, count);
        return 'CG-' + dateStr + '-' + String(count).padStart(3, '0');
    }

    function generatePurchaseOrder(order, type, supplier) {
        var orderQty = parseInt(order.qty) || 0;
        var items = [];
        var totalQty = 0;

        var finalType = type || 'material';

        if (finalType === 'magnet') {
            var product = getLinkedProduct(order);
            if (product && product.magnetDetail) {
                try {
                    var magnetData = JSON.parse(product.magnetDetail);
                    if (Array.isArray(magnetData) && magnetData.length > 0) {
                        magnetData.forEach(function(row) {
                            if (row && row.length >= 3) {
                                var perQty = parseInt(row[2]) || 0;
                                var total = perQty * orderQty;
                                items.push({
                                    magnetic: row[0] || '',
                                    size: row[1] || '',
                                    perQty: perQty,
                                    totalQty: total,
                                    remark: row[3] || ''
                                });
                                totalQty += total;
                            }
                        });
                    }
                } catch(e) {}
            }
            if (items.length === 0) {
                items.push({
                    magnetic: '磁铁',
                    size: '（待确认）',
                    perQty: 1,
                    totalQty: orderQty,
                    remark: '请补充磁石规格'
                });
                totalQty = orderQty;
            }
        } else if (finalType === 'board') {
            var boardSpec = getProductMaterialSpec(order, 'board');
            if (boardSpec) {
                items.push({
                    magnetic: '板材',
                    size: boardSpec,
                    perQty: 1,
                    totalQty: orderQty,
                    remark: ''
                });
                totalQty = orderQty;
            } else if (order.materialBoard && order.materialBoard.trim() !== '' && order.materialBoard !== '√') {
                items.push({
                    magnetic: '板材',
                    size: order.materialBoard.trim(),
                    perQty: 1,
                    totalQty: orderQty,
                    remark: ''
                });
                totalQty = orderQty;
            } else {
                items.push({
                    magnetic: '板材',
                    size: '（待确认）',
                    perQty: 1,
                    totalQty: orderQty,
                    remark: '请补充板材规格'
                });
                totalQty = orderQty;
            }
        } else if (finalType === 'shell') {
            var shellSpec = getProductMaterialSpec(order, 'shell');
            if (shellSpec) {
                items.push({
                    magnetic: '壳子',
                    size: shellSpec,
                    perQty: 1,
                    totalQty: orderQty,
                    remark: ''
                });
                totalQty = orderQty;
            } else if (order.materialShell && order.materialShell.trim() !== '' && order.materialShell !== '√') {
                items.push({
                    magnetic: '壳子',
                    size: order.materialShell.trim(),
                    perQty: 1,
                    totalQty: orderQty,
                    remark: ''
                });
                totalQty = orderQty;
            } else {
                items.push({
                    magnetic: '壳子',
                    size: '（待确认）',
                    perQty: 1,
                    totalQty: orderQty,
                    remark: '请补充壳子规格'
                });
                totalQty = orderQty;
            }
        }

        var finalSupplier = {
            name: supplier && supplier.name ? supplier.name : '',
            delivery: supplier && supplier.delivery ? supplier.delivery : ''
        };

        return {
            number: generatePurchaseOrderNumber(),
            date: new Date().toISOString().slice(0, 10),
            type: finalType,
            supplier: finalSupplier,
            orderNo: order.orderNo,
            productName: order.productName,
            productCode: order.productCode,
            orderQty: orderQty,
            items: items,
            totalQty: totalQty || orderQty,
            remark: ''
        };
    }

    function generateMergedPurchaseOrder(orders, type, supplier) {
        var orderQtyTotal = 0;
        var allItems = [];
        var orderNos = [];

        var finalType = type || 'material';
        var orderList = orders || [];

        orderList.forEach(function(order) {
            var qty = parseInt(order.qty) || 0;
            orderQtyTotal += qty;
            if (order.orderNo) {
                orderNos.push(order.orderNo);
            }

            var orderItems = [];

            if (finalType === 'magnet') {
                var product = getLinkedProduct(order);
                if (product && product.magnetDetail) {
                    try {
                        var magnetData = JSON.parse(product.magnetDetail);
                        if (Array.isArray(magnetData) && magnetData.length > 0) {
                            magnetData.forEach(function(row) {
                                if (row && row.length >= 3) {
                                    var perQty = parseInt(row[2]) || 0;
                                    var total = perQty * qty;
                                    orderItems.push({
                                        magnetic: row[0] || '',
                                        size: row[1] || '',
                                        perQty: perQty,
                                        totalQty: total,
                                        remark: row[3] || '',
                                        orderNo: order.orderNo,
                                        productName: order.productName
                                    });
                                }
                            });
                        }
                    } catch(e) {}
                }
                if (orderItems.length === 0) {
                    orderItems.push({
                        magnetic: '磁铁',
                        size: '（待确认）',
                        perQty: 1,
                        totalQty: qty,
                        remark: '请补充磁石规格',
                        orderNo: order.orderNo,
                        productName: order.productName
                    });
                }
            } else if (finalType === 'board') {
                var boardSpec = getProductMaterialSpec(order, 'board');
                var specText = boardSpec || order.materialBoard || '（待确认）';
                if (specText === '√' || specText === '') specText = '（待确认）';
                orderItems.push({
                    magnetic: '板材',
                    size: specText,
                    perQty: 1,
                    totalQty: qty,
                    remark: '',
                    orderNo: order.orderNo,
                    productName: order.productName
                });
            } else if (finalType === 'shell') {
                var shellSpec = getProductMaterialSpec(order, 'shell');
                var specText = shellSpec || order.materialShell || '（待确认）';
                if (specText === '√' || specText === '') specText = '（待确认）';
                orderItems.push({
                    magnetic: '壳子',
                    size: specText,
                    perQty: 1,
                    totalQty: qty,
                    remark: '',
                    orderNo: order.orderNo,
                    productName: order.productName
                });
            }

            allItems = allItems.concat(orderItems);
        });

        var totalQty = 0;
        allItems.forEach(function(item) {
            totalQty += (item.totalQty || 0);
        });

        var finalSupplier = {
            name: supplier && supplier.name ? supplier.name : '',
            delivery: supplier && supplier.delivery ? supplier.delivery : ''
        };

        var orderNoDisplay = orderNos.length > 3 ? orderNos.slice(0, 3).join(', ') + ' 等' + orderNos.length + '个' : orderNos.join(', ');

        return {
            number: generatePurchaseOrderNumber(),
            date: new Date().toISOString().slice(0, 10),
            type: finalType,
            supplier: finalSupplier,
            orderNo: orderNoDisplay,
            productName: '合并采购（' + orderList.length + ' 个订单）',
            productCode: '',
            orderQty: orderQtyTotal,
            items: allItems,
            totalQty: totalQty || orderQtyTotal,
            remark: '合并采购单，包含 ' + orderList.length + ' 个订单'
        };
    }

    // ============================================================
    //  采购确认模态框
    // ============================================================
    var pendingType = null;
    var pendingMatchedOrders = null;

    function showPurchaseConfirmModal(type, matchedOrders) {
        pendingType = type;
        pendingMatchedOrders = matchedOrders;

        var orderListDiv = document.getElementById('confirmOrderList');
        var countSpan = document.getElementById('confirmOrderCount');
        if (orderListDiv && countSpan) {
            countSpan.textContent = matchedOrders.length;
            var html = '';
            matchedOrders.slice(0, 10).forEach(function(o) {
                html += '<div style="padding:4px 8px;border-bottom:1px solid #f0f2f5;display:flex;justify-content:space-between;">';
                html += '<span><strong>' + o.orderNo + '</strong> ' + (o.productName || '') + '</span>';
                html += '<span style="color:#0066cc;font-weight:600;">' + (o.qty || 0) + ' 个</span>';
                html += '</div>';
            });
            if (matchedOrders.length > 10) {
                html += '<div style="padding:4px 8px;color:#999;font-size:12px;">... 还有 ' + (matchedOrders.length - 10) + ' 个订单</div>';
            }
            orderListDiv.innerHTML = html;
        }

        var mergeOption = document.getElementById('confirmMergeOption');
        if (!mergeOption) {
            var mergeDiv = document.createElement('div');
            mergeDiv.id = 'confirmMergeOption';
            mergeDiv.style.cssText = 'margin-top:12px;padding:8px 12px;background:#f0f7ff;border-radius:8px;border:1px solid #0066cc;';
            mergeDiv.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;">
                    <input type="checkbox" id="mergePurchaseCheck" checked style="width:18px;height:18px;accent-color:#0066cc;cursor:pointer;" />
                    <label for="mergePurchaseCheck" style="font-weight:600;font-size:14px;color:#0a2540;cursor:pointer;">
                        📦 合并生成（将选中的 ${matchedOrders.length} 个订单合并到一张采购单）
                    </label>
                    <span style="font-size:12px;color:#6c7a8a;">（推荐）</span>
                </div>
                <div style="font-size:12px;color:#6c7a8a;margin-top:4px;margin-left:28px;">
                    合并后所有订单的物料汇总到同一张采购单，供应商和存放位置统一
                </div>
            `;
            var confirmBody = document.querySelector('#purchaseConfirmModal .modal-body');
            var hr = confirmBody.querySelector('hr');
            if (hr) {
                confirmBody.insertBefore(mergeDiv, hr.nextSibling);
            } else {
                confirmBody.appendChild(mergeDiv);
            }
        }

        updateSupplierSelect();
        document.getElementById('confirmOtherSupplierDiv').style.display = 'none';
        document.getElementById('confirmOtherSupplierInput').value = '';
        document.getElementById('confirmSupplierDelivery').value = '';

        var modal = new bootstrap.Modal(document.getElementById('purchaseConfirmModal'));
        modal.show();
    }

    function onConfirmSupplierChange() {
        var select = document.getElementById('confirmSupplierSelect');
        var otherDiv = document.getElementById('confirmOtherSupplierDiv');
        var delivery = document.getElementById('confirmSupplierDelivery');

        if (select.value === '其他') {
            otherDiv.style.display = 'block';
            delivery.value = '';
        } else {
            otherDiv.style.display = 'none';
            var selectedOption = select.options[select.selectedIndex];
            if (selectedOption && selectedOption.dataset) {
                delivery.value = selectedOption.dataset.delivery || '';
            }
        }
    }

    // ============================================================
    //  ★★★ 确认生成采购单（改为 API 存储） ★★★
    // ============================================================
    async function confirmGeneratePurchase() {
        try {
            var type = pendingType;
            var matchedOrders = pendingMatchedOrders;

            if (!type || !matchedOrders || matchedOrders.length === 0) {
                alert('数据异常，请重新操作');
                return;
            }

            var supplierSelect = document.getElementById('confirmSupplierSelect');
            if (!supplierSelect) {
                alert('供应商选择器未找到，请刷新页面');
                return;
            }

            var selectedValue = supplierSelect.value;
            if (!selectedValue) {
                alert('请选择供应商');
                return;
            }

            var supplier = {
                name: selectedValue,
                delivery: ''
            };

            if (selectedValue === '其他') {
                var otherInput = document.getElementById('confirmOtherSupplierInput');
                if (!otherInput) {
                    alert('请输入供应商名称');
                    return;
                }
                var otherName = otherInput.value.trim();
                if (!otherName) {
                    alert('请输入供应商名称');
                    return;
                }
                supplier.name = otherName;
            }

            var delivery = document.getElementById('confirmSupplierDelivery');
            if (delivery && delivery.value.trim()) {
                supplier.delivery = delivery.value.trim();
            }

            var modalEl = document.getElementById('purchaseConfirmModal');
            if (modalEl) {
                var modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }

            var mergeCheck = document.getElementById('mergePurchaseCheck');
            var isMerged = mergeCheck ? mergeCheck.checked : true;

            showToast('⏳ 正在生成采购单...', 'info');

            var successCount = 0;
            var errorOrders = [];

            if (isMerged && matchedOrders.length > 1) {
                var mergedPO = generateMergedPurchaseOrder(matchedOrders, type, supplier);

                for (var i = 0; i < matchedOrders.length; i++) {
                    var order = matchedOrders[i];
                    try {
                        if (!order.purchase) {
                            order.purchase = { orders: [], remark: '' };
                        }
                        if (!order.purchase.orders) {
                            order.purchase.orders = [];
                        }

                        var poCopy = JSON.parse(JSON.stringify(mergedPO));
                        poCopy.orderNo = order.orderNo;

                        var existingIndex = order.purchase.orders.findIndex(function(po) {
                            return po.type === type && po.number === mergedPO.number;
                        });
                        if (existingIndex !== -1) {
                            order.purchase.orders[existingIndex] = poCopy;
                        } else {
                            order.purchase.orders.push(poCopy);
                        }

                        await saveOrderPurchaseToServer(order);
                        successCount++;
                    } catch (err) {
                        console.error('保存订单采购失败:', order.id, err);
                        errorOrders.push(order.orderNo);
                    }
                }
            } else {
                for (var j = 0; j < matchedOrders.length; j++) {
                    var order2 = matchedOrders[j];
                    try {
                        if (!order2.purchase) {
                            order2.purchase = { orders: [], remark: '' };
                        }
                        if (!order2.purchase.orders) {
                            order2.purchase.orders = [];
                        }

                        var po = generatePurchaseOrder(order2, type, supplier);

                        var existingIndex2 = order2.purchase.orders.findIndex(function(po2) {
                            return po2.type === type && po2.number === po.number;
                        });
                        if (existingIndex2 !== -1) {
                            order2.purchase.orders[existingIndex2] = po;
                        } else {
                            order2.purchase.orders.push(po);
                        }

                        await saveOrderPurchaseToServer(order2);
                        successCount++;
                    } catch (err) {
                        console.error('保存订单采购失败:', order2.id, err);
                        errorOrders.push(order2.orderNo);
                    }
                }
            }

            if (typeof window.saveDataToStorage === 'function') {
                window.saveDataToStorage();
            }

            if (typeof renderPurchaseOrders === 'function') {
                renderPurchaseOrders();
            }

            document.querySelectorAll('.purchase-order-checkbox').forEach(function(cb) {
                cb.checked = false;
            });
            if (typeof updateSelectedCount === 'function') {
                updateSelectedCount();
            }

            pendingType = null;
            pendingMatchedOrders = null;

            if (errorOrders.length > 0) {
                showToast('⚠️ 部分订单保存失败：' + errorOrders.join(', '), 'warning');
            } else {
                showToast('✅ 成功生成 ' + successCount + ' 个采购单！', 'success');
            }

            if (successCount > 0) {
                var previewQueue = [];
                matchedOrders.forEach(function(order) {
                    var poList = order.purchase && order.purchase.orders ? order.purchase.orders : [];
                    var lastPo = poList[poList.length - 1];
                    if (lastPo) {
                        previewQueue.push({
                            orderId: order.id,
                            poNumber: lastPo.number
                        });
                    }
                });
                if (previewQueue.length > 0) {
                    window._purchasePreviewQueue = previewQueue;
                    window._purchasePreviewIndex = 0;
                    if (typeof showPreviewByIndex === 'function') {
                        showPreviewByIndex();
                    }
                }
            }

        } catch (e) {
            console.error('❌ 生成采购单出错:', e);
            showToast('❌ 生成采购单失败：' + e.message, 'error');
        }
    }

    // ============================================================
    //  辅助函数：将订单的采购数据保存到服务器
    // ============================================================
    async function saveOrderPurchaseToServer(order) {
        var extraData = {
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
            purchase: {
                orders: order.purchase.orders || [],
                remark: order.purchase.remark || ''
            }
        };

        var updateData = {
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

        var response = await fetch('/api/orders/' + order.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            var errText = await response.text();
            throw new Error(errText || '保存失败');
        }

        var updated = await response.json();
        var parsed = typeof window.parseExtraFields === 'function'
            ? window.parseExtraFields(updated)
            : updated;

        var index = data.orders.findIndex(function(o) { return o.id === order.id; });
        if (index !== -1) {
            data.orders[index] = parsed;
            Object.assign(order, parsed);
        }

        return parsed;
    }

    // ============================================================
    //  采购操作
    // ============================================================
    function purchaseAction(type) {
        try {
            var selectedIds = getSelectedOrderIds();
            if (selectedIds.length === 0) {
                alert('请先勾选需要采购的订单');
                return;
            }

            var allOrders = getOrders();
            var selectedOrders = allOrders.filter(function(o) {
                return selectedIds.indexOf(o.id) !== -1;
            });

            var matchedOrders = selectedOrders;
            if (type === 'magnet') {
                matchedOrders = selectedOrders.filter(function(o) {
                    return getCategory(o) === 'magnet';
                });
                if (matchedOrders.length === 0) {
                    alert('所选订单中没有「磁铁」类别的订单');
                    return;
                }
            }
            if (matchedOrders.length === 0) {
                alert('没有可采购的订单');
                return;
            }

            showPurchaseConfirmModal(type, matchedOrders);

        } catch (e) {
            console.error('❌ purchaseAction 出错:', e);
            alert('操作失败：' + e.message);
        }
    }

    // ============================================================
    //  供应商管理
    // ============================================================
    function openSupplierManager() {
        renderSupplierList();
        var modal = new bootstrap.Modal(document.getElementById('supplierManagerModal'));
        modal.show();
    }

    function renderSupplierList() {
        var container = document.getElementById('supplierList');
        if (!container) return;
        var suppliers = getSuppliers();
        if (suppliers.length === 0) {
            container.innerHTML = '<div class="text-muted text-center py-3">暂无供应商，请添加</div>';
            return;
        }
        var html = '';
        suppliers.forEach(function(s, index) {
            html += '<div class="supplier-item">';
            html += '<div class="supplier-info"><div class="supplier-name">' + s.name + '</div>';
            var detail = (s.delivery || '').replace(/\n/g, ' ');
            html += '<div class="supplier-detail">' + detail + '</div></div>';
            html += '<div class="supplier-actions">';
            html += '<button class="btn btn-sm btn-outline-custom" onclick="editSupplier(' + index + ')" title="编辑"><i class="bi bi-pencil"></i></button>';
            html += '<button class="btn btn-sm btn-outline-danger" onclick="deleteSupplier(' + index + ')" title="删除"><i class="bi bi-trash3"></i></button>';
            html += '</div></div>';
        });
        container.innerHTML = html;
    }

    function addSupplier() {
        var nameInput = document.getElementById('newSupplierName');
        var name = nameInput.value.trim();
        if (!name) {
            alert('请输入供应商名称');
            return;
        }
        var suppliers = getSuppliers();
        if (suppliers.some(function(s) { return s.name === name; })) {
            alert('供应商已存在');
            return;
        }
        suppliers.push({ name: name, delivery: '' });
        saveSuppliers(suppliers);
        nameInput.value = '';
        renderSupplierList();
        updateSupplierSelect();
        alert('✅ 供应商已添加');
    }

    function deleteSupplier(index) {
        if (!confirm('确定删除该供应商吗？')) return;
        var suppliers = getSuppliers();
        suppliers.splice(index, 1);
        saveSuppliers(suppliers);
        renderSupplierList();
        updateSupplierSelect();
    }

    function editSupplier(index) {
        var suppliers = getSuppliers();
        var supplier = suppliers[index];
        if (!supplier) {
            alert('供应商不存在');
            return;
        }
        document.getElementById('editSupplierIndex').value = index;
        document.getElementById('editSupplierName').value = supplier.name || '';
        document.getElementById('editSupplierDelivery').value = supplier.delivery || '';
        var modal = new bootstrap.Modal(document.getElementById('editSupplierModal'));
        modal.show();
    }

    function saveSupplierEdit() {
        var index = parseInt(document.getElementById('editSupplierIndex').value);
        var suppliers = getSuppliers();
        if (index < 0 || index >= suppliers.length) {
            alert('数据异常，请重新操作');
            return;
        }
        var name = document.getElementById('editSupplierName').value.trim();
        if (!name) {
            alert('请输入供应商名称');
            return;
        }
        var delivery = document.getElementById('editSupplierDelivery').value.trim();
        var duplicate = suppliers.some(function(s, i) {
            return i !== index && s.name === name;
        });
        if (duplicate) {
            alert('供应商名称已存在，请使用其他名称');
            return;
        }
        suppliers[index].name = name;
        suppliers[index].delivery = delivery;
        saveSuppliers(suppliers);
        var modalEl = document.getElementById('editSupplierModal');
        var modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        renderSupplierList();
        updateSupplierSelect();
        alert('✅ 供应商已更新');
    }

    function updateSupplierSelect() {
        var select = document.getElementById('confirmSupplierSelect');
        if (!select) return;
        var suppliers = getSuppliers();
        var currentValue = select.value;
        var html = '<option value="">-- 请选择 --</option>';
        suppliers.forEach(function(s) {
            var delivery = (s.delivery || '').replace(/"/g, '&quot;');
            html += '<option value="' + s.name + '" data-delivery="' + delivery + '">' + s.name + '</option>';
        });
        html += '<option value="其他">其他（手动输入）</option>';
        select.innerHTML = html;
        if (currentValue) select.value = currentValue;
    }

    // ============================================================
    //  采购记录辅助
    // ============================================================
    function ensurePurchaseData(order) {
        if (!order.purchase) order.purchase = {};
        if (!order.purchase.remark) order.purchase.remark = '';
        if (!order.purchase.orders) order.purchase.orders = [];
        return order.purchase;
    }

    function isMaterialPurchased(order, type) {
        if (!order.purchase || !order.purchase.orders) return false;
        return order.purchase.orders.some(function(po) {
            return po.type === type;
        });
    }

    // ============================================================
    //  渲染表格
    // ============================================================
    var currentTab = 'all';

    function renderTable(orders) {
        var container = document.getElementById('purchaseOrderList');
        if (!container) {
            console.warn('⚠️ 容器 purchaseOrderList 未找到');
            return;
        }

        var filterSelects = document.querySelectorAll('.filter-row select');
        var colFilters = {};
        filterSelects.forEach(function(sel) {
            var col = sel.dataset.col;
            if (col && sel.value && sel.value !== '') {
                colFilters[col] = sel.value;
            }
        });

        var keyword = purchaseSearchKeyword || '';
        var filteredOrders = orders;
        if (keyword) {
            filteredOrders = orders.filter(function(o) {
                var orderNo = (o.orderNo || '').toLowerCase();
                var productName = (o.productName || '').toLowerCase();
                var customerCode = (o.customerCode || '').toLowerCase();
                return orderNo.indexOf(keyword) !== -1 ||
                       productName.indexOf(keyword) !== -1 ||
                       customerCode.indexOf(keyword) !== -1;
            });
        } else {
            filteredOrders = orders;
        }

        var visibleOrders = filteredOrders.filter(function(o) {
            if (o.syncToPurchase === false) return false;
            for (var col in colFilters) {
                var val = colFilters[col];
                if (!val) continue;
                var cellVal = '';
                switch (col) {
                    case 'orderNo': cellVal = o.orderNo || ''; break;
                    case 'customerCode': cellVal = o.customerCode || ''; break;
                    case 'productName': cellVal = o.productName || ''; break;
                    case 'spec': cellVal = o.spec || ''; break;
                    case 'color': cellVal = o.color || ''; break;
                    case 'qty': cellVal = String(o.qty || ''); break;
                    case 'category': cellVal = getCategoryLabel(getCategory(o)); break;
                    case 'status': cellVal = o.status || ''; break;
                    case 'boardPurchased': cellVal = isMaterialPurchased(o, 'board') ? '已采购' : '未采购'; break;
                    case 'magnetPurchased': cellVal = isMaterialPurchased(o, 'magnet') ? '已采购' : '未采购'; break;
                    case 'shellPurchased': cellVal = isMaterialPurchased(o, 'shell') ? '已采购' : '未采购'; break;
                    case 'purchaseRemark': cellVal = (o.purchase && o.purchase.remark) ? o.purchase.remark : ''; break;
                    default: break;
                }
                if (cellVal !== val) {
                    return false;
                }
            }
            return true;
        });

        if (currentTab && currentTab !== 'all') {
            visibleOrders = visibleOrders.filter(function(o) {
                return getCategory(o) === currentTab;
            });
        }

        var totalCount = visibleOrders.length;
        var totalEl = document.getElementById('purchaseTotalCount');
        if (totalEl) {
            totalEl.textContent = '共 ' + totalCount + ' 个订单';
            var oldHint = totalEl.querySelector('.search-hint');
            if (oldHint) oldHint.remove();
            var filterCount = Object.keys(colFilters).length;
            if (filterCount > 0 || keyword) {
                var hintSpan = document.createElement('span');
                hintSpan.className = 'search-hint';
                hintSpan.style.cssText = 'font-size:12px;color:#0066cc;margin-left:8px;font-weight:400;';
                var parts = [];
                if (keyword) parts.push('🔍 "' + keyword + '"');
                if (filterCount > 0) parts.push('📋 ' + filterCount + ' 个筛选条件');
                hintSpan.textContent = '（' + parts.join(' + ') + '）';
                totalEl.appendChild(hintSpan);
            }
        }

        if (visibleOrders.length === 0) {
            var tabNames = { 'all': '全部', 'board': '板材', 'magnet': '磁铁', 'shell': '壳子' };
            var msg = currentTab && currentTab !== 'all' ? '暂无「' + tabNames[currentTab] + '」类别的采购订单' : '暂无采购订单';
            if (keyword) msg = '没有匹配 "' + keyword + '" 的采购订单';
            var filterMsg = Object.keys(colFilters).length > 0 ? '（当前有 ' + Object.keys(colFilters).length + ' 个筛选条件）' : '';
            container.innerHTML = '<div class="text-center text-muted py-4">📋 ' + msg + filterMsg + '</div>';
            return;
        }

        var colOrder = getPurchaseColumnOrder();
        var colVisible = getPurchaseColumnVisible();

        var visibleCols = [];
        colOrder.forEach(function(key) {
            if (colVisible[key] !== false) {
                var colDef = purchaseColumnDefs.find(function(c) { return c.key === key; });
                if (colDef) visibleCols.push(colDef);
            }
        });

        var checkboxCol = purchaseColumnDefs.find(function(c) { return c.key === 'checkbox'; });
        if (checkboxCol) {
            visibleCols = visibleCols.filter(function(c) { return c.key !== 'checkbox'; });
            visibleCols.unshift(checkboxCol);
        }

        var html = '';
        html += '<div class="table-wrap" style="box-shadow:none;border:1px solid #e9edf2;border-radius:8px;padding:0;position:relative;">';
        html += '<div class="table-responsive" style="padding:0;overflow-x:auto;overflow-y:auto;max-height:calc(100vh - 320px);">';
        html += '<table class="table table-sm" style="font-size:13px;margin:0;table-layout:fixed;width:100%;border-collapse:collapse;">';
        html += '<thead style="position:sticky;top:0;z-index:30;background:#f8fafc;">';

        html += '<tr>';
        visibleCols.forEach(function(col) {
            var width = getPurchaseColumnWidth(col.key);
            var isCheckbox = col.key === 'checkbox';
            var dataCol = col.key;
            var stickyStyle = isCheckbox ? 'position:sticky;left:0;z-index:35;' : '';
            if (isCheckbox) {
                html += '<th data-col="' + dataCol + '" style="width:' + width + 'px;min-width:' + width + 'px;text-align:center;' + stickyStyle + 'background:#f8fafc;border-bottom:2px solid #e9edf2;">';
                html += '<input type="checkbox" class="purchase-checkbox" onchange="toggleAllOrders(this.checked)" style="width:18px;height:18px;cursor:pointer;accent-color:#0066cc;" />';
                html += '</th>';
            } else {
                html += '<th data-col="' + dataCol + '" style="width:' + width + 'px;min-width:' + width + 'px;padding:8px 8px;text-align:center;position:relative;background:#f8fafc;border-bottom:2px solid #e9edf2;">';
                html += col.label;
                html += '</th>';
            }
        });
        html += '</tr>';

        html += '<tr class="filter-row" style="background:#f8fafc;position:sticky;top:38px;z-index:25;">';
        visibleCols.forEach(function(col) {
            if (col.key === 'checkbox') {
                html += '<th style="width:' + getPurchaseColumnWidth(col.key) + 'px;min-width:' + getPurchaseColumnWidth(col.key) + 'px;position:sticky;left:0;z-index:35;background:#f8fafc;border-bottom:1px solid #e9edf2;"></th>';
                return;
            }
            if (col.key === 'actions') {
                html += '<th style="border-bottom:1px solid #e9edf2;"></th>';
                return;
            }
            var options = new Set();
            var allForOptions = orders.filter(function(o) { return o.syncToPurchase !== false; });
            if (currentTab && currentTab !== 'all') {
                allForOptions = allForOptions.filter(function(o) { return getCategory(o) === currentTab; });
            }
            allForOptions.forEach(function(o) {
                var val = '';
                switch (col.key) {
                    case 'orderNo': val = o.orderNo || ''; break;
                    case 'customerCode': val = o.customerCode || ''; break;
                    case 'productName': val = o.productName || ''; break;
                    case 'spec': val = o.spec || ''; break;
                    case 'color': val = o.color || ''; break;
                    case 'qty': val = String(o.qty || ''); break;
                    case 'category': val = getCategoryLabel(getCategory(o)); break;
                    case 'status': val = o.status || ''; break;
                    case 'boardPurchased': val = isMaterialPurchased(o, 'board') ? '已采购' : '未采购'; break;
                    case 'magnetPurchased': val = isMaterialPurchased(o, 'magnet') ? '已采购' : '未采购'; break;
                    case 'shellPurchased': val = isMaterialPurchased(o, 'shell') ? '已采购' : '未采购'; break;
                    case 'purchaseRemark': val = (o.purchase && o.purchase.remark) ? o.purchase.remark : ''; break;
                    default: break;
                }
                if (val) options.add(val);
            });
            var sortedOptions = Array.from(options).sort();
            var currentVal = colFilters[col.key] || '';
            var selectHtml = '<select data-col="' + col.key + '" class="form-select form-select-sm" style="font-size:11px;border:1px solid #e2e8f0;border-radius:4px;padding:2px 4px;background:#fff;width:100%;" onchange="renderPurchaseOrders()"><option value="">全部</option>';
            sortedOptions.forEach(function(opt) {
                var selected = (opt === currentVal) ? 'selected' : '';
                selectHtml += '<option value="' + opt.replace(/"/g, '&quot;') + '" ' + selected + '>' + opt + '</option>';
            });
            selectHtml += '</select>';
            html += '<th style="padding:4px 6px;border-bottom:1px solid #e9edf2;background:#f8fafc;">' + selectHtml + '</th>';
        });
        html += '</tr>';
        html += '</thead>';

        html += '<tbody>';
        for (var i = 0; i < visibleOrders.length; i++) {
            var o = visibleOrders[i];
            var status = o.status || '待生产';
            var badge = getBadgeClass(status);
            var catLabel = getCategoryLabel(getCategory(o));

            var boardPurchased = isMaterialPurchased(o, 'board');
            var magnetPurchased = isMaterialPurchased(o, 'magnet');
            var shellPurchased = isMaterialPurchased(o, 'shell');

            var purchasedColor = '#28a745';
            var boardHtml = boardPurchased
                ? '<span style="font-size:13px;font-weight:700;color:' + purchasedColor + ';">✅ 已采购</span>'
                : '<span style="font-size:13px;color:#999;">—</span>';
            var magnetHtml = magnetPurchased
                ? '<span style="font-size:13px;font-weight:700;color:' + purchasedColor + ';">✅ 已采购</span>'
                : '<span style="font-size:13px;color:#999;">—</span>';
            var shellHtml = shellPurchased
                ? '<span style="font-size:13px;font-weight:700;color:' + purchasedColor + ';">✅ 已采购</span>'
                : '<span style="font-size:13px;color:#999;">—</span>';

            var highlightColor = purchaseHighlight ? purchaseHighlight.getColor(String(o.id)) : '';
            var rowBgColor = highlightColor || '';
            var rowStyle = highlightColor ? 'background-color:' + highlightColor + ';' : '';

            html += '<tr style="' + rowStyle + '" data-order-id="' + o.id + '">';
            visibleCols.forEach(function(col) {
                var key = col.key;
                var width = getPurchaseColumnWidth(key);
                var tdBg = highlightColor || '#fff';

                if (key === 'checkbox') {
                    html += '<td style="padding:6px 8px;text-align:center;width:' + width + 'px;min-width:' + width + 'px;position:sticky;left:0;z-index:5;background:' + tdBg + ';border-right:1px solid #e9edf2;">';
                    html += '<input type="checkbox" class="purchase-order-checkbox purchase-checkbox" data-order-id="' + o.id + '" onchange="updateSelectedCount()" style="width:18px;height:18px;cursor:pointer;accent-color:#0066cc;" />';
                    html += '</td>';
                    return;
                }

                var val = '';
                var extraStyle = '';

                switch (key) {
                    case 'orderNo':
                        val = '<strong>' + (o.orderNo || '-') + '</strong>';
                        break;
                    case 'customerCode':
                        val = o.customerCode || '-';
                        break;
                    case 'productName':
                        val = o.productName || '-';
                        extraStyle = 'max-width:200px;word-wrap:break-word;word-break:break-word;white-space:normal;line-height:1.4;text-align:left;';
                        break;
                    case 'spec':
                        val = o.spec || '-';
                        extraStyle = 'font-size:12px;word-wrap:break-word;word-break:break-word;white-space:normal;line-height:1.4;text-align:left;';
                        break;
                    case 'color':
                        val = o.color || '-';
                        break;
                    case 'qty':
                        val = '<span style="font-weight:600;">' + (o.qty || 0) + '</span>';
                        break;
                    case 'category':
                        val = '<span class="badge bg-soft-secondary" style="font-size:11px;">' + catLabel + '</span>';
                        break;
                    case 'status':
                        val = '<span class="badge-status ' + badge + '">' + status + '</span>';
                        break;
                    case 'boardPurchased':
                        val = boardHtml;
                        break;
                    case 'magnetPurchased':
                        val = magnetHtml;
                        break;
                    case 'shellPurchased':
                        val = shellHtml;
                        break;
                    case 'purchaseRemark':
                        var remarkText = (o.purchase && o.purchase.remark) ? o.purchase.remark : '';
                        val = remarkText ? '<strong style="font-weight:700;color:#0a2540;">' + remarkText + '</strong>' : '';
                        extraStyle = 'max-width:180px;word-wrap:break-word;word-break:break-word;white-space:normal;line-height:1.4;text-align:left;';
                        break;
                    case 'actions':
                        val = '<button class="btn btn-sm btn-outline-custom" onclick="event.stopPropagation(); openPurchaseDetail(' + o.id + ')" title="查看采购详情"><i class="bi bi-eye"></i></button>';
                        break;
                    default:
                        val = '';
                }

                html += '<td style="padding:6px 8px;text-align:center;width:' + width + 'px;min-width:' + width + 'px;vertical-align:middle;background:' + tdBg + ';' + extraStyle + '" title="' + (typeof val === 'string' ? val.replace(/<[^>]+>/g, '') : '') + '">' + val + '</td>';
            });
            html += '</tr>';
        }
        html += '</tbody></table></div></div>';
        container.innerHTML = html;

        updateSelectedCount();

        var tableEl = container.querySelector('table');
        if (tableEl) {
            var theadEl = tableEl.querySelector('thead');
            if (theadEl) {
                theadEl.style.position = 'sticky';
                theadEl.style.top = '0';
                theadEl.style.zIndex = '30';
                theadEl.style.background = '#f8fafc';
            }
            tableEl.querySelectorAll('thead th').forEach(function(th) {
                th.style.zIndex = '30';
            });
            var checkboxTh = tableEl.querySelector('thead th[data-col="checkbox"]');
            if (checkboxTh) {
                checkboxTh.style.zIndex = '35';
            }
            var filterRow = tableEl.querySelector('.filter-row');
            if (filterRow) {
                filterRow.style.background = '#f8fafc';
            }
            var parent = container.closest('.table-responsive') || container.parentElement;
            if (parent && !parent.style.maxHeight && !parent.style.height) {
                parent.style.maxHeight = 'calc(100vh - 320px)';
                parent.style.overflowY = 'auto';
                parent.style.position = 'relative';
            }
        }

        setTimeout(function() {
            try {
                initPurchaseColumnResize();
            } catch (e) {
                console.warn('列宽拖拽初始化失败:', e);
            }
        }, 100);
    }

    function renderPurchaseOrders() {
        console.log('🔄 采购管理渲染...');
        if (!purchaseHighlight) {
            purchaseHighlight = new HighlightManager('purchase', {
                getSelectedIds: function() {
                    var ids = [];
                    document.querySelectorAll('.purchase-order-checkbox:checked').forEach(function(cb) {
                        var id = parseInt(cb.dataset.orderId);
                        if (!isNaN(id)) ids.push(String(id));
                    });
                    return ids;
                },
                renderCallback: renderPurchaseOrders,
                idAttribute: 'data-order-id'
            });
        }
        var orders = getOrders();
        renderTable(orders);
    }

    // ============================================================
    //  采购详情
    // ============================================================
    function openPurchaseDetail(orderId) {
        var order = getOrders().find(function(o) { return o.id === orderId; });
        if (!order) {
            alert('订单不存在');
            return;
        }

        var purchase = ensurePurchaseData(order);
        var orderQty = parseInt(order.qty) || 0;

        document.getElementById('purchaseDetailOrderRef').textContent = '关联订单: ' + (order.orderNo || '-');
        document.getElementById('purchaseDetailOrderNo').textContent = order.orderNo || '-';
        document.getElementById('purchaseDetailOrderStatus').textContent = order.status || '-';
        document.getElementById('purchaseDetailOrderQty').textContent = orderQty;
        document.getElementById('purchaseDetailDeliveryDate').textContent = order.deliveryDate || '-';

        document.getElementById('purchaseDetailProductCode').textContent = order.productCode || '-';
        document.getElementById('purchaseDetailProductName').textContent = order.productName || '-';
        document.getElementById('purchaseDetailSpec').textContent = order.spec || '-';
        document.getElementById('purchaseDetailColor').textContent = order.color || '-';
        document.getElementById('purchaseDetailCustomerCode').textContent = order.customerCode || '-';

        var boardDisplay = getProductMaterialSpec(order, 'board') || '-';
        var shellDisplay = getProductMaterialSpec(order, 'shell') || '-';
        document.getElementById('purchaseDetailMaterialBoard').textContent = boardDisplay;
        document.getElementById('purchaseDetailMaterialShell').textContent = shellDisplay;

        var magnetInfo = '暂无磁铁数据';
        var magnetRows = [];
        var totalMagnetQty = 0;

        var product = getLinkedProduct(order);
        if (product && product.magnetDetail) {
            try {
                var magnetData = JSON.parse(product.magnetDetail);
                if (Array.isArray(magnetData) && magnetData.length > 0) {
                    magnetRows = magnetData;
                    magnetRows.forEach(function(row) {
                        if (row && row.length >= 3) {
                            var perQty = parseInt(row[2]) || 0;
                            var totalQty = perQty * orderQty;
                            row._totalQty = totalQty;
                            totalMagnetQty += totalQty;
                        }
                    });
                    magnetInfo = magnetRows.length + ' 种规格，共 ' + totalMagnetQty + ' 个（整单）';
                }
            } catch(e) {}
        }

        var magnetInfoEl = document.getElementById('purchaseDetailMagnetInfo');
        if (magnetInfoEl) {
            magnetInfoEl.textContent = magnetInfo;
            magnetInfoEl.style.fontSize = '16px';
            magnetInfoEl.style.fontWeight = '600';
            magnetInfoEl.style.color = '#0a2540';
        }

        var magnetBody = document.getElementById('purchaseDetailMagnetBody');
        var magnetTable = document.getElementById('purchaseDetailMagnetTable');
        var magnetEmpty = document.getElementById('purchaseDetailMagnetEmpty');
        if (magnetRows.length > 0) {
            var html2 = '';
            magnetRows.forEach(function(row) {
                if (row && row.length >= 3) {
                    var perQty = parseInt(row[2]) || 0;
                    var totalQty = row._totalQty || (perQty * orderQty);
                    html2 += '<tr>';
                    html2 += '<td style="text-align:center;font-weight:600;font-size:15px;">' + (row[0] || '') + '</td>';
                    html2 += '<td style="text-align:center;font-family:monospace;font-size:15px;">' + (row[1] || '') + '</td>';
                    html2 += '<td style="text-align:center;font-size:15px;">' + perQty + '</td>';
                    html2 += '<td style="text-align:center;font-weight:600;color:#0066cc;font-size:15px;">' + totalQty + '</td>';
                    html2 += '<td style="text-align:center;font-size:15px;">' + (row[3] || '') + '</td>';
                    html2 += '</tr>';
                }
            });
            magnetBody.innerHTML = html2;
            magnetTable.style.display = 'block';
            magnetEmpty.style.display = 'none';
        } else {
            magnetTable.style.display = 'none';
            magnetEmpty.style.display = 'block';
        }

        var recordContainer = document.getElementById('purchaseDetailRecords');
        if (recordContainer) {
            var ordersList = purchase.orders || [];
            var countEl = document.getElementById('purchaseRecordCount');
            if (countEl) countEl.textContent = ordersList.length + ' 条';

            if (ordersList.length === 0) {
                recordContainer.innerHTML = '<div class="text-muted text-center py-2" style="font-size:13px;">暂无采购记录</div>';
            } else {
                var html3 = '<div class="purchase-record-table-wrap">';
                html3 += '<table class="purchase-record-table" style="font-size:15px;width:100%;border-collapse:separate;border-spacing:0;">';
                html3 += '<thead><tr>';
                html3 += '<th class="col-po-number" style="font-size:15px;font-weight:600;padding:8px 10px;text-align:center;background:#f0f4f8;border-bottom:2px solid #e9edf2;position:sticky;left:0;z-index:11;min-width:140px;">采购单号</th>';
                html3 += '<th class="col-date" style="font-size:15px;font-weight:600;padding:8px 10px;text-align:center;background:#f0f4f8;border-bottom:2px solid #e9edf2;position:sticky;left:140px;z-index:11;min-width:100px;">日期</th>';
                html3 += '<th class="col-type" style="font-size:15px;font-weight:600;padding:8px 10px;text-align:center;background:#f0f4f8;border-bottom:2px solid #e9edf2;min-width:80px;">类型</th>';
                html3 += '<th class="col-supplier" style="font-size:15px;font-weight:600;padding:8px 10px;text-align:center;background:#f0f4f8;border-bottom:2px solid #e9edf2;min-width:100px;">供应商</th>';
                html3 += '<th class="col-total" style="font-size:15px;font-weight:600;padding:8px 10px;text-align:center;background:#f0f4f8;border-bottom:2px solid #e9edf2;min-width:100px;">合计数量</th>';
                html3 += '<th class="col-action" style="font-size:15px;font-weight:600;padding:8px 10px;text-align:center;background:#f0f4f8;border-bottom:2px solid #e9edf2;min-width:80px;">操作</th>';
                html3 += '</tr></thead><tbody>';

                ordersList.forEach(function(po) {
                    var typeName = '';
                    if (po.type) {
                        typeName = getCategoryLabel(po.type);
                    } else {
                        if (po.items && po.items.length > 0) {
                            var firstItem = po.items[0];
                            if (firstItem && firstItem.magnetic) {
                                var mag = firstItem.magnetic;
                                if (mag.indexOf('板') !== -1) typeName = '板材';
                                else if (mag.indexOf('壳') !== -1 || mag.indexOf('皮套') !== -1) typeName = '壳子';
                                else if (mag.indexOf('磁') !== -1) typeName = '磁铁';
                                else typeName = '材料';
                            } else {
                                typeName = '材料';
                            }
                        } else {
                            typeName = '材料';
                        }
                        if (po.type !== 'board' && po.type !== 'magnet' && po.type !== 'shell') {
                            var inferredType = 'material';
                            if (typeName === '板材') inferredType = 'board';
                            else if (typeName === '壳子') inferredType = 'shell';
                            else if (typeName === '磁铁') inferredType = 'magnet';
                            po.type = inferredType;
                        }
                    }

                    html3 += '<tr>';
                    html3 += '<td class="col-po-number" style="font-size:15px;padding:6px 10px;text-align:center;background:#fff;border-bottom:1px solid #f0f2f5;position:sticky;left:0;z-index:10;border-right:2px solid #e9edf2;"><strong>' + po.number + '</strong></td>';
                    html3 += '<td class="col-date" style="font-size:15px;padding:6px 10px;text-align:center;background:#fff;border-bottom:1px solid #f0f2f5;position:sticky;left:140px;z-index:10;border-right:2px solid #e9edf2;">' + po.date + '</td>';
                    html3 += '<td class="col-type" style="font-size:16px;padding:6px 10px;text-align:center;background:#fff;border-bottom:1px solid #f0f2f5;"><span class="badge bg-soft-secondary" style="color:#0a2540;font-size:16px;font-weight:600;">' + typeName + '</span></td>';
                    html3 += '<td class="col-supplier" style="font-size:15px;padding:6px 10px;text-align:center;background:#fff;border-bottom:1px solid #f0f2f5;">' + (po.supplier ? po.supplier.name : '-') + '</td>';
                    html3 += '<td class="col-total" style="font-size:15px;padding:6px 10px;text-align:center;background:#fff;border-bottom:1px solid #f0f2f5;font-weight:600;color:#0066cc;">' + (po.totalQty || 0) + '</td>';
                    html3 += '<td class="col-action" style="font-size:15px;padding:6px 10px;text-align:center;background:#fff;border-bottom:1px solid #f0f2f5;"><button type="button" class="btn btn-sm btn-outline-custom" onclick="viewPurchaseOrder(' + order.id + ', \'' + po.number + '\')" title="查看采购单" style="font-size:14px;">📄</button></td>';
                    html3 += '</tr>';
                });

                html3 += '</tbody></table></div>';
                recordContainer.innerHTML = html3;
            }
        }

        document.getElementById('purchaseDetailRemark').value = purchase.remark || '';
        document.getElementById('purchaseDetailOrderId').value = order.id;

        var modal = new bootstrap.Modal(document.getElementById('purchaseDetailModal'));
        modal.show();
    }

    // ============================================================
    //  查看/预览采购单
    // ============================================================
    function viewPurchaseOrder(orderId, poNumber, index, total) {
        try {
            var order = getOrders().find(function(o) { return o.id === orderId; });
            if (!order) {
                alert('订单不存在');
                return;
            }

            var purchase = ensurePurchaseData(order);
            var po = purchase.orders.find(function(p) { return p.number === poNumber; });
            if (!po) {
                alert('采购单不存在');
                return;
            }

            var typeName = getCategoryLabel(po.type);
            var supplierName = po.supplier ? po.supplier.name : '采购单';

            var html = '';
            html += '<div style="padding:16px;font-family:system-ui, -apple-system, sans-serif;max-width:100%;">';
            html += '<div style="text-align:center;font-weight:700;font-size:26px;margin-bottom:6px;color:#0a2540;">' + supplierName + '</div>';

            var deliveryHtml = '';
            if (po.supplier && po.supplier.delivery) {
                deliveryHtml = po.supplier.delivery.replace(/\n/g, '<br />');
            }
            html += '<div style="text-align:center;font-size:16px;color:#555;line-height:1.8;margin-bottom:6px;">' + deliveryHtml + '</div>';

            html += '<hr style="margin:12px 0;border-color:#ccc;" />';
            html += '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;font-size:16px;line-height:1.8;">';
            html += '<div><strong>采购单号：</strong>' + po.number + '</div>';
            html += '<div><strong>日期：</strong>' + po.date + '</div>';
            html += '<div><strong>类型：</strong>' + typeName + '</div>';
            html += '</div>';
            html += '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;font-size:16px;line-height:1.8;margin-top:4px;">';
            html += '<div><strong>关联订单：</strong>' + po.orderNo + '</div>';
            html += '<div><strong>订单数量：</strong>' + po.orderQty + ' 个</div>';
            html += '</div>';
            html += '<div style="font-size:15px;color:#6c7a8a;margin-top:4px;"><strong>产品：</strong>' + (po.productName || '') + '</div>';
            html += '<hr style="margin:12px 0;border-color:#ddd;" />';

            if (po.items && po.items.length > 0) {
                var isMerged = po.items.some(function(item) { return item.orderNo; });

                html += '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;">';
                html += '<thead><tr style="background:#f0f4f8;">';
                if (isMerged) {
                    html += '<th style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">关联订单</th>';
                }
                html += '<th style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">项目</th>';
                html += '<th style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">规格</th>';
                html += '<th style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">每件用量</th>';
                html += '<th style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">整单用量</th>';
                html += '<th style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">备注</th>';
                html += '</tr></thead><tbody>';

                po.items.forEach(function(item) {
                    html += '<tr>';
                    if (isMerged) {
                        var displayOrderNo = item.orderNo || '-';
                        html += '<td style="border:1px solid #ddd;padding:5px 10px;text-align:center;font-size:12px;color:#0066cc;">' + displayOrderNo + '</td>';
                    }
                    html += '<td style="border:1px solid #ddd;padding:5px 10px;text-align:center;font-weight:600;">' + item.magnetic + '</td>';
                    html += '<td style="border:1px solid #ddd;padding:5px 10px;text-align:center;font-family:monospace;font-size:13px;">' + item.size + '</td>';
                    html += '<td style="border:1px solid #ddd;padding:5px 10px;text-align:center;">' + item.perQty + '</td>';
                    html += '<td style="border:1px solid #ddd;padding:5px 10px;text-align:center;font-weight:600;color:#0066cc;">' + item.totalQty + '</td>';
                    html += '<td style="border:1px solid #ddd;padding:5px 10px;text-align:center;font-size:12px;color:#888;">' + (item.remark || '') + '</td>';
                    html += '</tr>';
                });

                html += '<tr style="background:#f8fafc;font-weight:600;">';
                if (isMerged) {
                    html += '<td style="border:1px solid #ddd;padding:6px 10px;text-align:right;" colspan="2">合 计</td>';
                } else {
                    html += '<td style="border:1px solid #ddd;padding:6px 10px;text-align:right;" colspan="3">合 计</td>';
                }
                html += '<td style="border:1px solid #ddd;padding:6px 10px;text-align:center;color:#0066cc;font-size:18px;">' + po.totalQty + '</td>';
                html += '<td style="border:1px solid #ddd;padding:6px 10px;"></td>';
                html += '</tr>';
                html += '</tbody></table>';
            } else {
                html += '<div style="text-align:center;padding:16px;color:#999;font-size:15px;">📋 暂无明细数据</div>';
                html += '<div style="text-align:center;font-size:13px;color:#ccc;margin-top:4px;">整单合计数量：<strong style="color:#0066cc;">' + po.totalQty + '</strong> 个</div>';
            }

            html += '<div style="margin-top:16px;font-size:14px;color:#999;text-align:center;border-top:1px solid #ddd;padding-top:12px;">';
            html += '—— 采购单 —— 生成时间：' + new Date().toLocaleString() + ' 【' + po.number + '】';
            html += '</div>';
            html += '</div>';

            var modalId = 'purchaseOrderPreviewModal';
            var modalEl = document.getElementById(modalId);
            if (!modalEl) {
                modalEl = document.createElement('div');
                modalEl.id = modalId;
                modalEl.className = 'modal fade';
                modalEl.tabIndex = -1;
                modalEl.setAttribute('data-bs-backdrop', 'static');
                modalEl.innerHTML = `
                    <div class="modal-dialog modal-lg modal-dialog-scrollable">
                        <div class="modal-content" style="border-radius:12px;">
                            <div class="modal-header" style="background:#f0f7ff;border-bottom:2px solid #0066cc;">
                                <h5 class="modal-title"><i class="bi bi-file-earmark-text" style="color:#0066cc;"></i> 订单截图 <span id="previewPageInfo" style="font-size:14px;font-weight:400;color:#6c7a8a;margin-left:12px;"></span></h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body" id="purchaseOrderPreviewBody" style="max-height:70vh;overflow-y:auto;padding:20px;background:#fafbfc;font-size:16px;">
                            </div>
                            <div class="modal-footer" style="display:flex;justify-content:space-between;">
                                <div>
                                    <button class="btn btn-outline-custom" id="previewPrevBtn" style="display:none;" onclick="previewPrev()">
                                        <i class="bi bi-chevron-left"></i> 上一张
                                    </button>
                                    <button class="btn btn-outline-custom" id="previewNextBtn" style="display:none;" onclick="previewNext()">
                                        下一张 <i class="bi bi-chevron-right"></i>
                                    </button>
                                </div>
                                <div>
                                    <button class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                                    <button class="btn btn-primary-custom" onclick="printPurchaseOrder()" style="background:#0066cc;border-color:#0066cc;">
                                        <i class="bi bi-printer"></i> 打印 / 截图
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modalEl);
            }

            var pageInfo = document.getElementById('previewPageInfo');
            if (pageInfo && total > 1) {
                pageInfo.textContent = (index !== undefined && index !== null) ? (index + 1) + ' / ' + total : '';
            } else if (pageInfo) {
                pageInfo.textContent = '';
            }

            var prevBtn = document.getElementById('previewPrevBtn');
            var nextBtn = document.getElementById('previewNextBtn');
            if (prevBtn && nextBtn && total > 1) {
                prevBtn.style.display = (index !== undefined && index > 0) ? 'inline-block' : 'none';
                nextBtn.style.display = (index !== undefined && index < total - 1) ? 'inline-block' : 'none';
            } else if (prevBtn && nextBtn) {
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
            }

            document.getElementById('purchaseOrderPreviewBody').innerHTML = html;
            var modal = new bootstrap.Modal(modalEl);
            modal.show();

            window._currentPrintContent = html;

        } catch (e) {
            console.error('❌ 预览采购单失败:', e);
            alert('预览采购单失败，请查看控制台错误信息。');
        }
    }

    // ============================================================
    //  打印采购单
    // ============================================================
    function printPurchaseOrder() {
        var content = window._currentPrintContent;
        if (!content) {
            alert('没有可打印的内容');
            return;
        }
        var printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            alert('请允许弹出窗口，以便打印');
            return;
        }
        printWindow.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>采购单</title>');
        printWindow.document.write('<style>');
        printWindow.document.write('body{font-family:system-ui,-apple-system,sans-serif;padding:20px;font-size:16px;line-height:1.6;}');
        printWindow.document.write('table{width:100%;border-collapse:collapse;font-size:15px;}');
        printWindow.document.write('td,th{border:1px solid #ddd;padding:8px 12px;text-align:center;}');
        printWindow.document.write('.text-right{text-align:right;}');
        printWindow.document.write('.header-title{font-size:26px;font-weight:700;}');
        printWindow.document.write('.delivery-info{font-size:16px;color:#555;line-height:1.8;}');
        printWindow.document.write('.meta-info{font-size:16px;line-height:1.8;}');
        printWindow.document.write('.total{font-size:18px;font-weight:700;color:#0066cc;}');
        printWindow.document.write('.footer{font-size:14px;color:#999;text-align:center;border-top:1px solid #ddd;padding-top:12px;margin-top:16px;}');
        printWindow.document.write('@media print{body{padding:10px;} .no-print{display:none;}}');
        printWindow.document.write('</style></head><body>');
        printWindow.document.write(content);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        setTimeout(function() {
            printWindow.focus();
            printWindow.print();
        }, 300);
    }

    // ============================================================
//  预览翻页函数（修复）
// ============================================================

function previewPrev() {
    var queue = window._purchasePreviewQueue || [];
    var index = window._purchasePreviewIndex || 0;
    if (index > 0) {
        window._purchasePreviewIndex = index - 1;
        showPreviewByIndex();
    }
}

function previewNext() {
    var queue = window._purchasePreviewQueue || [];
    var index = window._purchasePreviewIndex || 0;
    if (index < queue.length - 1) {
        window._purchasePreviewIndex = index + 1;
        showPreviewByIndex();
    }
}

function showPreviewByIndex() {
    var queue = window._purchasePreviewQueue || [];
    var index = window._purchasePreviewIndex || 0;
    if (queue.length === 0) {
        alert('没有可预览的采购单');
        return;
    }
    if (index < 0 || index >= queue.length) {
        index = 0;
        window._purchasePreviewIndex = 0;
    }
    var item = queue[index];
    viewPurchaseOrder(item.orderId, item.poNumber, index, queue.length);
}

    // ============================================================
    //  ★★★ 保存采购详情（改为 API 存储） ★★★
    // ============================================================
    async function savePurchaseDetail() {
        var orderId = parseInt(document.getElementById('purchaseDetailOrderId').value);
        var order = getOrders().find(function(o) { return o.id === orderId; });
        if (!order) {
            alert('订单不存在');
            return;
        }

        if (!order.purchase) {
            order.purchase = { orders: [], remark: '' };
        }
        if (!order.purchase.orders) {
            order.purchase.orders = [];
        }

        order.purchase.remark = document.getElementById('purchaseDetailRemark').value.trim();

        var extraData = {
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
            purchase: {
                orders: order.purchase.orders || [],
                remark: order.purchase.remark || ''
            }
        };

        var updateData = {
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

        try {
            showToast('⏳ 正在保存采购信息...', 'info');

            var response = await fetch('/api/orders/' + orderId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                var errText = await response.text();
                throw new Error(errText || '保存失败');
            }

            var updated = await response.json();
            var parsed = typeof window.parseExtraFields === 'function'
                ? window.parseExtraFields(updated)
                : updated;

            var index = data.orders.findIndex(function(o) { return o.id === orderId; });
            if (index !== -1) {
                data.orders[index] = parsed;
            }

            if (typeof window.saveDataToStorage === 'function') {
                window.saveDataToStorage();
            }

            var modalEl = document.getElementById('purchaseDetailModal');
            if (modalEl) {
                var modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }

            if (typeof renderPurchaseOrders === 'function') {
                renderPurchaseOrders();
            }

            showToast('✅ 采购信息已保存', 'success');

        } catch (error) {
            showToast('❌ 保存失败: ' + error.message, 'error');
            console.error('保存采购详情错误:', error);
        }
    }

    // ============================================================
    //  切换选项卡
    // ============================================================
    function switchPurchaseTab(tab) {
        currentTab = tab;
        renderPurchaseOrders();
    }

    // ============================================================
    //  初始化
    // ============================================================
    function initPurchase() {
        console.log('✅ 采购管理初始化...');
        currentTab = 'all';
        purchaseSearchKeyword = '';
        if (!purchaseHighlight) {
            purchaseHighlight = new HighlightManager('purchase', {
                getSelectedIds: function() {
                    var ids = [];
                    document.querySelectorAll('.purchase-order-checkbox:checked').forEach(function(cb) {
                        var id = parseInt(cb.dataset.orderId);
                        if (!isNaN(id)) ids.push(String(id));
                    });
                    return ids;
                },
                renderCallback: renderPurchaseOrders,
                idAttribute: 'data-order-id'
            });
        }
        renderPurchaseOrders();

        var confirmBtn = document.getElementById('confirmGenerateBtn');
        if (confirmBtn) {
            var newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            newConfirmBtn.addEventListener('click', function(e) {
                e.preventDefault();
                confirmGeneratePurchase();
            });
            console.log('✅ 确认生成按钮已绑定');
        }

        var saveEditBtn = document.getElementById('saveSupplierEditBtn');
        if (saveEditBtn) {
            var newSaveEditBtn = saveEditBtn.cloneNode(true);
            saveEditBtn.parentNode.replaceChild(newSaveEditBtn, saveEditBtn);
            newSaveEditBtn.addEventListener('click', function(e) {
                e.preventDefault();
                saveSupplierEdit();
            });
            console.log('✅ 保存编辑按钮已绑定');
        }

        updateSupplierSelect();

        console.log('✅ 采购管理初始化完成');
    }

    // ============================================================
    //  多色底色存根
    // ============================================================
    window.applyHighlightColor = function(color) {
        if (purchaseHighlight) {
            purchaseHighlight.apply(color);
        } else {
            alert('高亮功能尚未初始化，请先切换到采购管理页面');
        }
    };

    window.clearHighlight = function() {
        if (purchaseHighlight) {
            purchaseHighlight.clear();
        } else {
            alert('高亮功能尚未初始化，请先切换到采购管理页面');
        }
    };

    // ============================================================
    //  暴露全局
    // ============================================================
    window.initPurchase = initPurchase;
    window.renderPurchaseOrders = renderPurchaseOrders;
    window.openPurchaseDetail = openPurchaseDetail;
    window.savePurchaseDetail = savePurchaseDetail;
    window.getPurchaseOrders = getOrders;
    window.switchPurchaseTab = switchPurchaseTab;
    window.purchaseAction = purchaseAction;
    window.toggleAllOrders = toggleAllOrders;
    window.getSelectedOrderIds = getSelectedOrderIds;
    window.updateSelectedCount = updateSelectedCount;
    window.viewPurchaseOrder = viewPurchaseOrder;
    window.printPurchaseOrder = printPurchaseOrder;
    window.confirmGeneratePurchase = confirmGeneratePurchase;
    window.onConfirmSupplierChange = onConfirmSupplierChange;
    window.openSupplierManager = openSupplierManager;
    window.addSupplier = addSupplier;
    window.deleteSupplier = deleteSupplier;
    window.editSupplier = editSupplier;
    window.saveSupplierEdit = saveSupplierEdit;
    window.renderSupplierList = renderSupplierList;
    window.updateSupplierSelect = updateSupplierSelect;
    window.previewPrev = previewPrev;
    window.previewNext = previewNext;
    window.saveOrderPurchaseToServer = saveOrderPurchaseToServer;

    window.openPurchaseColumnSettings = openPurchaseColumnSettings;
    window.movePurchaseColumnUp = movePurchaseColumnUp;
    window.movePurchaseColumnDown = movePurchaseColumnDown;
    window.updatePurchaseColumnVisibility = updatePurchaseColumnVisibility;
    window.togglePurchaseAllColumns = togglePurchaseAllColumns;
    window.resetPurchaseColumns = resetPurchaseColumns;

    window.filterPurchaseOrders = filterPurchaseOrders;

    window.purchaseHighlight = purchaseHighlight;

    console.log('🚀 采购管理模块加载完成（服务器存储版本）');
    window.previewPrev = previewPrev;
    window.previewNext = previewNext;
    window.showPreviewByIndex = showPreviewByIndex;
})();