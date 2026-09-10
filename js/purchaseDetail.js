// ============================================================
//  采购详情模块（完整版）
//  功能：展开子项、复选框、多色底色、备注编辑、列设置、统计筛选、搜索
//  默认收起子项 · 父项勾选自动全选子项 · 双击展开 · 父项底色继承 · 全选切换
//  新增：父项和子项均可独立备注
//  修改：detailHighlight 延迟初始化，避免加载时未定义错误
// ============================================================

(function() {
    'use strict';

    console.log('🔄 采购详情模块加载中...');

    // ============================================================
    //  列设置 - 配置常量
    // ============================================================
    var DETAIL_COLUMN_ORDER_KEY = 'erp_detail_column_order';
    var DETAIL_COLUMN_WIDTHS_KEY = 'erp_detail_column_widths';
    var DETAIL_COLUMN_VISIBLE_KEY = 'erp_detail_column_visible';

    var detailColumnDefs = [
        { key: 'checkbox', label: '☑' },
        { key: 'poNumber', label: '采购单号' },
        { key: 'poDate', label: '日期' },
        { key: 'poType', label: '类型' },
        { key: 'supplier', label: '供应商' },
        { key: 'orderNo', label: '关联订单' },
        { key: 'customerCode', label: '客户号' },
        { key: 'productName', label: '产品名称' },
        { key: 'spec', label: '规格' },
        { key: 'color', label: '颜色' },
        { key: 'orderQty', label: '订单数量' },
        { key: 'itemName', label: '子项名称' },
        { key: 'itemSpec', label: '子项规格' },
        { key: 'itemPerQty', label: '每件用量' },
        { key: 'itemTotalQty', label: '整单用量' },
        { key: 'totalQty', label: '采购合计' },
        { key: 'remark', label: '备注' }
    ];

    var defaultDetailWidths = {
        'checkbox': 44,
        'poNumber': 150,
        'poDate': 110,
        'poType': 80,
        'supplier': 100,
        'orderNo': 140,
        'customerCode': 80,
        'productName': 160,
        'spec': 130,
        'color': 70,
        'orderQty': 80,
        'itemName': 100,
        'itemSpec': 120,
        'itemPerQty': 80,
        'itemTotalQty': 90,
        'totalQty': 90,
        'remark': 150
    };

    var defaultDetailOrder = detailColumnDefs.map(function(c) { return c.key; });

    var defaultDetailVisible = {};
    detailColumnDefs.forEach(function(c) { defaultDetailVisible[c.key] = true; });

    // ============================================================
    //  列设置 - 读写函数
    // ============================================================
    function getDetailColumnOrder() {
        try {
            var stored = localStorage.getItem(DETAIL_COLUMN_ORDER_KEY);
            if (stored) {
                var order = JSON.parse(stored);
                var allKeys = detailColumnDefs.map(function(c) { return c.key; });
                var missingKeys = allKeys.filter(function(k) { return order.indexOf(k) === -1; });
                if (missingKeys.length > 0) {
                    var newOrder = order.concat(missingKeys);
                    saveDetailColumnOrder(newOrder);
                    return newOrder;
                }
                return order;
            }
        } catch (e) {}
        return defaultDetailOrder.slice();
    }

    function saveDetailColumnOrder(orderArray) {
        localStorage.setItem(DETAIL_COLUMN_ORDER_KEY, JSON.stringify(orderArray));
    }

    function getDetailColumnWidths() {
        try {
            var stored = localStorage.getItem(DETAIL_COLUMN_WIDTHS_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) { return {}; }
    }

    function saveDetailColumnWidth(colKey, width) {
        var widths = getDetailColumnWidths();
        widths[colKey] = width;
        localStorage.setItem(DETAIL_COLUMN_WIDTHS_KEY, JSON.stringify(widths));
    }

    function getDetailColumnWidth(colKey) {
        var widths = getDetailColumnWidths();
        return widths[colKey] || defaultDetailWidths[colKey] || 100;
    }

    function getDetailColumnVisible() {
        try {
            var stored = localStorage.getItem(DETAIL_COLUMN_VISIBLE_KEY);
            if (stored) {
                var visible = JSON.parse(stored);
                detailColumnDefs.forEach(function(c) {
                    if (visible[c.key] === undefined) visible[c.key] = true;
                });
                return visible;
            }
        } catch (e) {}
        var defaultVisible = {};
        detailColumnDefs.forEach(function(c) { defaultVisible[c.key] = true; });
        return defaultVisible;
    }

    function saveDetailColumnVisible(visibleObj) {
        localStorage.setItem(DETAIL_COLUMN_VISIBLE_KEY, JSON.stringify(visibleObj));
    }

    // ============================================================
    //  列宽拖拽初始化
    // ============================================================
    function initDetailColumnResize() {
        var table = document.querySelector('#purchaseDetailList table');
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

            var savedWidth = getDetailColumnWidth(colKey);
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
            saveDetailColumnWidth(dragData.colKey, newWidth);

            document.body.classList.remove('resizing');
            if (dragData.handle) {
                dragData.handle.classList.remove('dragging');
            }
            ghostLine.classList.remove('visible');

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            dragData = null;

            renderDetailTable();
        }
    }

    // ============================================================
    //  列设置 - 模态框
    // ============================================================
    function openDetailColumnSettings() {
        var content = document.getElementById('detailColumnSettingsContent');
        if (!content) return;

        var order = getDetailColumnOrder();
        var visible = getDetailColumnVisible();

        var html = '<div class="mb-2"><strong>调整列顺序（点击 ↑↓ 移动）</strong></div>';
        html += '<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="detail_col_all" onchange="toggleDetailAllColumns(this.checked)"><label class="form-check-label" for="detail_col_all">全选</label></div>';
        html += '<div id="detailColumnSortableList" class="list-group">';

        order.forEach(function(key) {
            var col = detailColumnDefs.find(function(c) { return c.key === key; });
            if (!col) return;
            var isCheckbox = key === 'checkbox';
            var checked = (visible[key] !== false) ? 'checked' : '';
            var disabledAttr = isCheckbox ? 'disabled' : '';
            html += '<div class="list-group-item d-flex align-items-center justify-content-between" data-key="' + key + '" style="padding:6px 12px;">';
            html += '<div class="d-flex align-items-center gap-2">';
            html += '<input type="checkbox" class="form-check-input detail-col-check" data-col="' + key + '" ' + checked + ' ' + disabledAttr + ' onchange="updateDetailColumnVisibility()">';
            html += '<span style="font-weight:500;">' + col.label + '</span>';
            if (isCheckbox) html += '<span class="text-muted" style="font-size:11px;">（固定）</span>';
            html += '</div>';
            html += '<div>';
            html += '<button class="btn btn-sm btn-outline-secondary" onclick="moveDetailColumnUp(\'' + key + '\')" title="上移">↑</button>';
            html += '<button class="btn btn-sm btn-outline-secondary" onclick="moveDetailColumnDown(\'' + key + '\')" title="下移">↓</button>';
            html += '</div>';
            html += '</div>';
        });

        html += '</div>';
        content.innerHTML = html;

        var modal = new bootstrap.Modal(document.getElementById('detailColumnSettingsModal'));
        modal.show();
    }

    function refreshDetailColumnSettingsList() {
        var container = document.getElementById('detailColumnSortableList');
        if (!container) return;
        var order = getDetailColumnOrder();
        var visible = getDetailColumnVisible();
        var html = '';

        order.forEach(function(key) {
            var col = detailColumnDefs.find(function(c) { return c.key === key; });
            if (!col) return;
            var isCheckbox = key === 'checkbox';
            var checked = (visible[key] !== false) ? 'checked' : '';
            var disabledAttr = isCheckbox ? 'disabled' : '';
            html += '<div class="list-group-item d-flex align-items-center justify-content-between" data-key="' + key + '" style="padding:6px 12px;">';
            html += '<div class="d-flex align-items-center gap-2">';
            html += '<input type="checkbox" class="form-check-input detail-col-check" data-col="' + key + '" ' + checked + ' ' + disabledAttr + ' onchange="updateDetailColumnVisibility()">';
            html += '<span style="font-weight:500;">' + col.label + '</span>';
            if (isCheckbox) html += '<span class="text-muted" style="font-size:11px;">（固定）</span>';
            html += '</div>';
            html += '<div>';
            html += '<button class="btn btn-sm btn-outline-secondary" onclick="moveDetailColumnUp(\'' + key + '\')" title="上移">↑</button>';
            html += '<button class="btn btn-sm btn-outline-secondary" onclick="moveDetailColumnDown(\'' + key + '\')" title="下移">↓</button>';
            html += '</div>';
            html += '</div>';
        });

        container.innerHTML = html;

        var allCheckbox = document.getElementById('detail_col_all');
        if (allCheckbox) {
            var items = document.querySelectorAll('.detail-col-check:not([disabled])');
            var checkedItems = document.querySelectorAll('.detail-col-check:not([disabled]):checked');
            allCheckbox.checked = items.length > 0 && checkedItems.length === items.length;
        }
    }

    function moveDetailColumnUp(key) {
        var order = getDetailColumnOrder();
        var idx = order.indexOf(key);
        if (idx <= 0) return;
        var temp = order[idx - 1];
        order[idx - 1] = order[idx];
        order[idx] = temp;
        saveDetailColumnOrder(order);
        refreshDetailColumnSettingsList();
        renderDetailTable();
    }

    function moveDetailColumnDown(key) {
        var order = getDetailColumnOrder();
        var idx = order.indexOf(key);
        if (idx === -1 || idx >= order.length - 1) return;
        var temp = order[idx + 1];
        order[idx + 1] = order[idx];
        order[idx] = temp;
        saveDetailColumnOrder(order);
        refreshDetailColumnSettingsList();
        renderDetailTable();
    }

    function updateDetailColumnVisibility() {
        var visible = getDetailColumnVisible();
        document.querySelectorAll('.detail-col-check').forEach(function(cb) {
            var col = cb.dataset.col;
            if (cb.disabled) return;
            visible[col] = cb.checked;
        });
        saveDetailColumnVisible(visible);
        renderDetailTable();
    }

    function toggleDetailAllColumns(checked) {
        document.querySelectorAll('.detail-col-check:not([disabled])').forEach(function(cb) {
            cb.checked = checked;
            var col = cb.dataset.col;
            var visible = getDetailColumnVisible();
            visible[col] = checked;
            saveDetailColumnVisible(visible);
        });
        renderDetailTable();
    }

    function resetDetailColumns() {
        if (!confirm('恢复所有列到默认顺序和可见性，列宽也将重置。确定？')) return;
        saveDetailColumnOrder(defaultDetailOrder.slice());
        var defaultVisible = {};
        detailColumnDefs.forEach(function(c) { defaultVisible[c.key] = true; });
        saveDetailColumnVisible(defaultVisible);
        localStorage.removeItem(DETAIL_COLUMN_WIDTHS_KEY);
        renderDetailTable();
        var modal = bootstrap.Modal.getInstance(document.getElementById('detailColumnSettingsModal'));
        if (modal) modal.hide();
        alert('✅ 列已恢复默认（顺序、可见性、宽度）');
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
                return parsed.orders || [];
            }
        } catch(e) {
            console.error('❌ 读取 localStorage 失败:', e);
        }
        return [];
    }

    function getCategoryLabel(cat) {
        var map = { 'board': '板材', 'magnet': '磁铁', 'shell': '壳子', 'material': '材料' };
        return map[cat] || cat || '材料';
    }

    function getCategoryColor(cat) {
        var map = {
            'board': '#0066cc',
            'magnet': '#6f42c1',
            'shell': '#0f7b4a',
            'material': '#fd7e14'
        };
        return map[cat] || '#6c7a8a';
    }

    // ============================================================
    //  高亮管理 - 延迟初始化（detailHighlight）
    // ============================================================
    var detailHighlight = null;

    // ============================================================
    //  复选框联动：父选 → 子全选
    // ============================================================
    function getChildRowIds(parentRowId) {
        var allData = getAllPurchaseItems();
        var childIds = [];
        allData.forEach(function(item) {
            if (!item._isParent && item._parentId === parentRowId) {
                childIds.push(item._rowId);
            }
        });
        return childIds;
    }

    function toggleDetailRow(rowId) {
        var cb = document.querySelector('.detail-checkbox[data-row-id="' + rowId + '"]');
        if (!cb) return;
        var checked = cb.checked;

        var allData = getAllPurchaseItems();
        var target = allData.find(function(item) { return item._rowId === rowId; });

        if (target && target._isParent) {
            var childIds = getChildRowIds(rowId);
            childIds.forEach(function(childId) {
                var childCb = document.querySelector('.detail-checkbox[data-row-id="' + childId + '"]');
                if (childCb) {
                    childCb.checked = checked;
                }
            });
        }

        updateDetailSelectedCount();
    }

    // ============================================================
    //  获取选中的行ID
    // ============================================================
    function getSelectedDetailRows() {
        var checkboxes = document.querySelectorAll('.detail-checkbox:checked');
        var ids = [];
        checkboxes.forEach(function(cb) {
            var id = cb.dataset.rowId;
            if (id) ids.push(id);
        });

        var allData = getAllPurchaseItems();
        var finalIds = [];
        var parentChecked = {};

        ids.forEach(function(id) {
            var item = allData.find(function(i) { return i._rowId === id; });
            if (item && item._isParent) {
                parentChecked[id] = true;
            }
        });

        ids.forEach(function(id) {
            var item = allData.find(function(i) { return i._rowId === id; });
            if (!item) {
                finalIds.push(id);
                return;
            }
            if (item._isParent) {
                finalIds.push(id);
                var childIds = getChildRowIds(id);
                childIds.forEach(function(cid) {
                    if (finalIds.indexOf(cid) === -1) {
                        finalIds.push(cid);
                    }
                });
            } else {
                var parentId = item._parentId;
                if (!parentChecked[parentId]) {
                    if (finalIds.indexOf(id) === -1) {
                        finalIds.push(id);
                    }
                }
            }
        });

        return finalIds;
    }

    function updateDetailSelectedCount() {
        var checkedBoxes = document.querySelectorAll('.detail-checkbox:checked');
        var count = checkedBoxes.length;
        var el = document.getElementById('selectedDetailCount');
        if (el) el.textContent = '已选 ' + count + ' 行';
    }

    function toggleAllDetailRows() {
        var visibleCheckboxes = document.querySelectorAll('.detail-checkbox');
        var allChecked = true;
        visibleCheckboxes.forEach(function(cb) {
            if (!cb.checked) allChecked = false;
        });

        var allData = getAllPurchaseItems();

        visibleCheckboxes.forEach(function(cb) {
            cb.checked = !allChecked;
            var rowId = cb.dataset.rowId;
            if (!rowId) return;
            var target = allData.find(function(item) { return item._rowId === rowId; });
            if (target && target._isParent && cb.checked) {
                var childIds = getChildRowIds(rowId);
                childIds.forEach(function(childId) {
                    var childCb = document.querySelector('.detail-checkbox[data-row-id="' + childId + '"]');
                    if (childCb) childCb.checked = true;
                });
            }
            if (target && target._isParent && !cb.checked) {
                var childIds = getChildRowIds(rowId);
                childIds.forEach(function(childId) {
                    var childCb = document.querySelector('.detail-checkbox[data-row-id="' + childId + '"]');
                    if (childCb) childCb.checked = false;
                });
            }
        });

        updateDetailSelectedCount();
    }

    // ============================================================
    //  获取所有采购单（默认收起子项）
    // ============================================================
    function getAllPurchaseItems() {
        var orders = getOrders();
        var allItems = [];
        var rowCounter = 0;

        orders.forEach(function(order) {
            if (order.purchase && order.purchase.orders && Array.isArray(order.purchase.orders)) {
                order.purchase.orders.forEach(function(po) {
                    var parentId = 'row_' + (rowCounter++);
                    var typeLabel = getCategoryLabel(po.type);
                    var typeColor = getCategoryColor(po.type);

                    var items = po.items || [];
                    if (items.length === 0) {
                        items = [{
                            magnetic: '-',
                            size: '-',
                            perQty: '-',
                            totalQty: po.totalQty || 0,
                            remark: ''
                        }];
                    }

                    var isExpanded = detailExpandedState[parentId] === true;

                    var parentRow = {
                        _rowId: parentId,
                        _isParent: true,
                        _isExpanded: isExpanded,
                        _order: order,
                        _po: po,
                        _items: items,
                        poNumber: po.number || '',
                        poDate: po.date || '',
                        poType: typeLabel,
                        poTypeRaw: po.type || 'material',
                        supplier: po.supplier ? po.supplier.name : '',
                        orderNo: order.orderNo || '',
                        customerCode: order.customerCode || '',
                        productName: order.productName || '',
                        spec: order.spec || '',
                        color: order.color || '',
                        orderQty: order.qty || 0,
                        totalQty: po.totalQty || 0,
                        remark: po.remark || '',
                        itemName: '',
                        itemSpec: '',
                        itemPerQty: '',
                        itemTotalQty: ''
                    };

                    allItems.push(parentRow);

                    if (isExpanded) {
                        items.forEach(function(item, idx) {
                            var childId = parentId + '_sub_' + idx;
                            var perQty = item.perQty !== undefined ? item.perQty : (item[2] || '-');
                            var totalQty = item.totalQty !== undefined ? item.totalQty : (item[3] || (perQty * (order.qty || 0)));
                            if (totalQty === '-' || totalQty === '') totalQty = 0;

                            var childRow = {
                                _rowId: childId,
                                _isParent: false,
                                _parentId: parentId,
                                _order: order,
                                _po: po,
                                _item: item,
                                poNumber: po.number || '',
                                poDate: po.date || '',
                                poType: typeLabel,
                                poTypeRaw: po.type || 'material',
                                supplier: po.supplier ? po.supplier.name : '',
                                orderNo: order.orderNo || '',
                                customerCode: order.customerCode || '',
                                productName: order.productName || '',
                                spec: order.spec || '',
                                color: order.color || '',
                                orderQty: order.qty || 0,
                                totalQty: po.totalQty || 0,
                                remark: po.remark || '',
                                itemName: item.magnetic || item[0] || '',
                                itemSpec: item.size || item[1] || '',
                                itemPerQty: perQty,
                                itemTotalQty: totalQty,
                                subRemark: item.remark || ''
                            };
                            allItems.push(childRow);
                        });
                    }
                });
            }
        });

        allItems.sort(function(a, b) {
            return (b.poDate || '').localeCompare(a.poDate || '');
        });

        return allItems;
    }

    // ============================================================
    //  展开/收起状态
    // ============================================================
    var detailExpandedState = {};

    function toggleDetailExpand(rowId) {
        var current = detailExpandedState[rowId] === true;
        detailExpandedState[rowId] = !current;
        renderDetailTable();
    }

    function expandAllDetails() {
        var allData = getAllPurchaseItems();
        allData.forEach(function(item) {
            if (item._isParent) {
                detailExpandedState[item._rowId] = true;
            }
        });
        renderDetailTable();
    }

    function collapseAllDetails() {
        var allData = getAllPurchaseItems();
        allData.forEach(function(item) {
            if (item._isParent) {
                detailExpandedState[item._rowId] = false;
            }
        });
        renderDetailTable();
    }

    // ============================================================
    //  备注编辑：父项和子项独立
    // ============================================================
    function saveDetailRemark(rowId, value) {
        var allData = getAllPurchaseItems();
        var target = allData.find(function(item) { return item._rowId === rowId; });
        if (target && target._po) {
            target._po.remark = value;
            if (typeof saveDataToStorage === 'function') {
                saveDataToStorage();
            } else {
                localStorage.setItem('erp_production_data', JSON.stringify(data));
            }
        }
    }

    function saveSubItemRemark(rowId, value) {
        var allData = getAllPurchaseItems();
        var target = allData.find(function(item) { return item._rowId === rowId; });
        if (target && target._item) {
            target._item.remark = value;
            target.subRemark = value;
            if (target._po && target._po.items) {
                var idx = target._po.items.indexOf(target._item);
                if (idx !== -1) {
                    target._po.items[idx].remark = value;
                }
            }
            if (typeof saveDataToStorage === 'function') {
                saveDataToStorage();
            } else {
                localStorage.setItem('erp_production_data', JSON.stringify(data));
            }
        }
    }

    function scrollRemarkIntoView(input) {
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
                console.warn('滚动到备注列失败:', e);
            }
        });
    }

    // ============================================================
    //  筛选状态
    // ============================================================
    var detailTypeFilter = '';
    var detailSearchKeyword = '';

    function setDetailFilter(type) {
        detailTypeFilter = type;
        document.querySelectorAll('.detail-stat-item').forEach(function(el) {
            el.classList.remove('stat-item-active');
            el.style.borderColor = '#e9edf2';
            el.style.background = '#fff';
            el.style.color = '#6c7a8a';
            if (el.dataset.type === type) {
                el.classList.add('stat-item-active');
                el.style.borderColor = '#0066cc';
                el.style.background = '#e6f0ff';
                el.style.color = '#0066cc';
            }
        });
        renderDetailTable();
    }

    function filterDetail() {
        var input = document.getElementById('detailSearchInput');
        detailSearchKeyword = input ? input.value.trim().toLowerCase() : '';
        renderDetailTable();
    }

    // ============================================================
    //  单击父行高亮
    // ============================================================
    var selectedParentRowId = null;
    var currentHighlightRow = null;

    function selectParentRow(rowId) {
        if (selectedParentRowId === rowId) {
            selectedParentRowId = null;
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

        selectedParentRowId = rowId;
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

    function restoreHighlight() {
        if (!selectedParentRowId) return;
        var tr = document.querySelector('tr[data-row-id="' + selectedParentRowId + '"]');
        if (tr) {
            tr.style.backgroundColor = '#d0e4ff';
            tr.querySelectorAll('td').forEach(function(td) {
                td.style.backgroundColor = '#d0e4ff';
            });
            currentHighlightRow = tr;
        }
    }

    // ============================================================
    //  渲染表格
    // ============================================================
    function renderDetailTable() {
        var container = document.getElementById('purchaseDetailList');
        if (!container) return;

        // 确保 detailHighlight 已初始化（如果还未创建，则创建）
        if (!detailHighlight) {
            detailHighlight = new HighlightManager('detail', {
                getSelectedIds: function() {
                    var ids = [];
                    document.querySelectorAll('.detail-checkbox:checked').forEach(function(cb) {
                        var id = cb.dataset.rowId;
                        if (id) ids.push(String(id));
                    });
                    return ids;
                },
                renderCallback: renderDetailTable,
                idAttribute: 'data-row-id'
            });
        }

        var monthFilter = document.getElementById('filterDetailMonth')?.value || '';
        var typeFilter = detailTypeFilter;
        var keyword = detailSearchKeyword || '';

        var allData = getAllPurchaseItems();

        var filtered = allData.filter(function(item) {
            if (typeFilter && item._isParent) {
                if (item.poTypeRaw !== typeFilter) return false;
            }
            if (typeFilter && !item._isParent) {
                var parent = allData.find(function(p) { return p._rowId === item._parentId; });
                if (parent && parent.poTypeRaw !== typeFilter) return false;
                if (!parent) return false;
            }

            if (monthFilter) {
                var parts = monthFilter.split('-');
                var year = parts[0];
                var month = parts[1];
                if (!item.poDate) return false;
                var dateParts = item.poDate.split('-');
                if (dateParts.length < 2) return false;
                if (dateParts[0] !== year || dateParts[1] !== month) return false;
            }

            if (keyword) {
                var searchFields = [
                    item.poNumber || '',
                    item.orderNo || '',
                    item.productName || '',
                    item.customerCode || '',
                    item.supplier || '',
                    item.itemName || ''
                ];
                var match = searchFields.some(function(field) {
                    return field.toLowerCase().indexOf(keyword) !== -1;
                });
                if (!match) return false;
            }

            return true;
        });

        if (typeFilter) {
            var parentIds = {};
            filtered.forEach(function(item) {
                if (item._isParent) {
                    parentIds[item._rowId] = true;
                } else if (item._parentId) {
                    parentIds[item._parentId] = true;
                }
            });
            var finalFiltered = [];
            filtered.forEach(function(item) {
                if (item._isParent && parentIds[item._rowId]) {
                    finalFiltered.push(item);
                } else if (!item._isParent && parentIds[item._parentId]) {
                    finalFiltered.push(item);
                }
            });
            filtered = finalFiltered;
        }

        var parentRows = allData.filter(function(item) { return item._isParent; });
        var filteredParents = filtered.filter(function(item) { return item._isParent; });
        var total = filteredParents.length;
        var statBoard = parentRows.filter(function(i) { return i.poTypeRaw === 'board'; }).length;
        var statMagnet = parentRows.filter(function(i) { return i.poTypeRaw === 'magnet'; }).length;
        var statShell = parentRows.filter(function(i) { return i.poTypeRaw === 'shell'; }).length;
        var statMaterial = parentRows.filter(function(i) { return i.poTypeRaw === 'material'; }).length;

        document.getElementById('statTotal').textContent = parentRows.length;
        document.getElementById('statBoard').textContent = statBoard;
        document.getElementById('statMagnet').textContent = statMagnet;
        document.getElementById('statShell').textContent = statShell;
        document.getElementById('statMaterial').textContent = statMaterial;

        var allRowsCount = allData.length;
        document.getElementById('purchaseDetailTotalCount').textContent = '共 ' + allRowsCount + ' 条记录（' + parentRows.length + ' 个采购单）';

        if (filtered.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4">📋 暂无匹配的采购记录</div>';
            return;
        }

        var colOrder = getDetailColumnOrder();
        var colVisible = getDetailColumnVisible();

        var visibleCols = [];
        colOrder.forEach(function(key) {
            if (colVisible[key] !== false) {
                var colDef = detailColumnDefs.find(function(c) { return c.key === key; });
                if (colDef) visibleCols.push(colDef);
            }
        });

        var checkboxCol = detailColumnDefs.find(function(c) { return c.key === 'checkbox'; });
        if (checkboxCol) {
            visibleCols = visibleCols.filter(function(c) { return c.key !== 'checkbox'; });
            visibleCols.unshift(checkboxCol);
        }

        var html = '';
        html += '<div class="table-responsive">';
        html += '<table class="purchase-detail-table">';
        html += '<thead><tr>';

        visibleCols.forEach(function(col) {
            var width = getDetailColumnWidth(col.key);
            var isCheckbox = col.key === 'checkbox';
            var dataCol = col.key;
            if (isCheckbox) {
                html += '<th data-col="' + dataCol + '" style="width:' + width + 'px;min-width:' + width + 'px;text-align:center;position:sticky;left:0;z-index:15;background:#f8fafc;">';
                html += '<input type="checkbox" class="detail-checkbox" onchange="toggleAllDetailRows()" style="width:20px;height:20px;accent-color:#0066cc;cursor:pointer;" />';
                html += '</th>';
            } else {
                html += '<th data-col="' + dataCol + '" style="width:' + width + 'px;min-width:' + width + 'px;padding:6px 8px;text-align:center;position:relative;background:#f8afc;">';
                html += col.label;
                html += '</th>';
            }
        });

        html += '</tr></thead><tbody>';

        filtered.forEach(function(item) {
            var isParent = item._isParent;
            var rowId = item._rowId;
            var isExpanded = detailExpandedState[rowId] === true;

            // 使用 detailHighlight 获取底色
            var highlightColor = detailHighlight ? detailHighlight.getColor(rowId) : '';
            var defaultBg = isParent ? '#fff' : '#f8fafc';
            var bgColor = highlightColor || defaultBg;

            var rowStyle = 'background-color:' + bgColor + ';';
            var rowClass = isParent ? 'parent-row' : 'sub-row';
            if (!isParent) rowClass += ' sub-item-indent';

            var clickAttr = isParent ? ' onclick="selectParentRow(\'' + rowId + '\')"' : '';
            var dblclickAttr = isParent ? ' ondblclick="toggleDetailExpand(\'' + rowId + '\')"' : '';

            html += '<tr class="' + rowClass + '" style="' + rowStyle + '" data-row-id="' + rowId + '"' + clickAttr + dblclickAttr + '>';

            visibleCols.forEach(function(col) {
                var key = col.key;
                var width = getDetailColumnWidth(key);
                var tdBg = bgColor;

                if (key === 'checkbox') {
                    html += '<td style="padding:4px 4px;text-align:center;width:' + width + 'px;min-width:' + width + 'px;position:sticky;left:0;z-index:5;background:' + tdBg + ';">';
                    html += '<input type="checkbox" class="detail-checkbox" data-row-id="' + rowId + '" onchange="toggleDetailRow(\'' + rowId + '\')" style="width:20px;height:20px;accent-color:#0066cc;cursor:pointer;" />';
                    html += '</td>';
                    return;
                }

                var val = '';
                var extraStyle = '';

                switch (key) {
                    case 'poNumber':
                        if (isParent) {
                            var expandIcon = isExpanded ? 'bi-chevron-down' : 'bi-chevron-right';
                            val = '<span class="detail-expand-btn ' + (isExpanded ? 'expanded' : '') + '" onclick="event.stopPropagation();toggleDetailExpand(\'' + rowId + '\')"><i class="bi ' + expandIcon + '"></i></span> ';
                            val += '<strong>' + (item.poNumber || '-') + '</strong>';
                        } else {
                            val = '└ ' + (item.poNumber || '-');
                            extraStyle = 'font-size:12px;color:#666;';
                        }
                        break;
                    case 'poDate':
                        val = item.poDate || '-';
                        break;
                    case 'poType':
                        var color = getCategoryColor(item.poTypeRaw);
                        val = '<span class="badge" style="background:' + color + ';color:#fff;font-size:12px;padding:2px 10px;">' + item.poType + '</span>';
                        break;
                    case 'supplier':
                        val = item.supplier || '-';
                        break;
                    case 'orderNo':
                        val = item.orderNo || '-';
                        break;
                    case 'customerCode':
                        val = item.customerCode || '-';
                        break;
                    case 'productName':
                        val = item.productName || '-';
                        extraStyle = 'max-width:180px;word-wrap:break-word;white-space:normal;text-align:left;';
                        break;
                    case 'spec':
                        val = item.spec || '-';
                        extraStyle = 'font-size:12px;max-width:140px;word-wrap:break-word;white-space:normal;text-align:left;';
                        break;
                    case 'color':
                        val = item.color || '-';
                        break;
                    case 'orderQty':
                        val = item.orderQty || 0;
                        break;
                    case 'itemName':
                        if (isParent) {
                            val = '📦 共 ' + (item._items ? item._items.length : 0) + ' 项';
                            extraStyle = 'font-size:12px;color:#6c7a8a;';
                        } else {
                            val = item.itemName || '-';
                            extraStyle = 'font-weight:500;';
                        }
                        break;
                    case 'itemSpec':
                        val = isParent ? '' : (item.itemSpec || '-');
                        extraStyle = isParent ? '' : 'font-family:monospace;font-size:12px;';
                        break;
                    case 'itemPerQty':
                        val = isParent ? '' : (item.itemPerQty || '-');
                        break;
                    case 'itemTotalQty':
                        val = isParent ? '' : '<strong style="color:#0066cc;">' + (item.itemTotalQty || 0) + '</strong>';
                        break;
                    case 'totalQty':
                        val = '<strong style="color:#0066cc;font-size:15px;">' + (item.totalQty || 0) + '</strong>';
                        break;
                    case 'remark':
                        var remarkValue = '';
                        var saveFunc = '';

                        if (isParent) {
                            remarkValue = item.remark || '';
                            saveFunc = 'saveDetailRemark';
                        } else {
                            remarkValue = item.subRemark || (item._item ? item._item.remark : '') || '';
                            saveFunc = 'saveSubItemRemark';
                        }

                        var placeholder = isParent ? '输入备注...' : '子项备注...';
                        var inputStyle = isParent ? 'font-weight:700;' : 'font-weight:500;font-style:italic;color:#555;';

                        val = '<input type="text" class="detail-remark-input" value="' + remarkValue.replace(/"/g, '&quot;') + '" placeholder="' + placeholder + '" data-row-id="' + rowId + '" onchange="' + saveFunc + '(this.dataset.rowId, this.value)" onfocus="this.select()" onclick="event.stopPropagation(); scrollRemarkIntoView(this)" style="' + inputStyle + '" />';
                        extraStyle = 'max-width:160px;';
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
        updateDetailSelectedCount();

        restoreHighlight();

        setTimeout(function() {
            try {
                initDetailColumnResize();
            } catch (e) {
                console.warn('列宽拖拽初始化失败:', e);
            }
        }, 100);
    }

    // ============================================================
    //  导出选中行（包含子项）
    // ============================================================
    function exportSelectedDetail() {
        if (typeof XLSX === 'undefined') {
            alert('Excel 库未加载，请刷新页面后重试。');
            return;
        }

        var checkedRows = getSelectedDetailRows();
        if (checkedRows.length === 0) {
            alert('请先勾选需要导出的行');
            return;
        }

        var allData = getAllPurchaseItems();
        var selectedData = allData.filter(function(item) {
            return checkedRows.indexOf(item._rowId) !== -1;
        });

        if (selectedData.length === 0) {
            alert('没有可导出的数据');
            return;
        }

        var exportRows = [];
        selectedData.forEach(function(item) {
            if (item._isParent) {
                var items = item._items || [];
                if (items.length === 0) {
                    exportRows.push({
                        '采购单号': item.poNumber || '',
                        '日期': item.poDate || '',
                        '类型': item.poType || '',
                        '供应商': item.supplier || '',
                        '关联订单': item.orderNo || '',
                        '客户号': item.customerCode || '',
                        '产品名称': item.productName || '',
                        '规格型号': item.spec || '',
                        '颜色': item.color || '',
                        '订单数量': item.orderQty || 0,
                        '子项名称': '',
                        '子项规格': '',
                        '每件用量': '',
                        '整单用量': '',
                        '采购合计': item.totalQty || 0,
                        '备注': item.remark || ''
                    });
                } else {
                    items.forEach(function(subItem) {
                        var perQty = subItem.perQty !== undefined ? subItem.perQty : (subItem[2] || '-');
                        var totalQty = subItem.totalQty !== undefined ? subItem.totalQty : (subItem[3] || (perQty * (item.orderQty || 0)));
                        if (totalQty === '-' || totalQty === '') totalQty = 0;
                        exportRows.push({
                            '采购单号': item.poNumber || '',
                            '日期': item.poDate || '',
                            '类型': item.poType || '',
                            '供应商': item.supplier || '',
                            '关联订单': item.orderNo || '',
                            '客户号': item.customerCode || '',
                            '产品名称': item.productName || '',
                            '规格型号': item.spec || '',
                            '颜色': item.color || '',
                            '订单数量': item.orderQty || 0,
                            '子项名称': subItem.magnetic || subItem[0] || '',
                            '子项规格': subItem.size || subItem[1] || '',
                            '每件用量': perQty,
                            '整单用量': totalQty,
                            '采购合计': item.totalQty || 0,
                            '备注': subItem.remark || item.remark || ''
                        });
                    });
                }
            } else {
                exportRows.push({
                    '采购单号': item.poNumber || '',
                    '日期': item.poDate || '',
                    '类型': item.poType || '',
                    '供应商': item.supplier || '',
                    '关联订单': item.orderNo || '',
                    '客户号': item.customerCode || '',
                    '产品名称': item.productName || '',
                    '规格型号': item.spec || '',
                    '颜色': item.color || '',
                    '订单数量': item.orderQty || 0,
                    '子项名称': item.itemName || '',
                    '子项规格': item.itemSpec || '',
                    '每件用量': item.itemPerQty || '',
                    '整单用量': item.itemTotalQty || 0,
                    '采购合计': item.totalQty || 0,
                    '备注': item.subRemark || item.remark || ''
                });
            }
        });

        try {
            var wb = XLSX.utils.book_new();
            var ws = XLSX.utils.json_to_sheet(exportRows);
            var colWidths = Object.keys(exportRows[0] || {}).map(function(key) {
                return { wch: Math.max(key.length * 2, 12) };
            });
            ws['!cols'] = colWidths;
            XLSX.utils.book_append_sheet(wb, ws, '采购详情');

            var dateStr = new Date().toISOString().slice(0, 10);
            var fileName = '采购详情_导出_' + dateStr + '.xlsx';
            XLSX.writeFile(wb, fileName);
            alert('✅ 成功导出 ' + exportRows.length + ' 行数据！');
        } catch (err) {
            alert('导出失败：' + err.message);
        }
    }

    // ============================================================
    //  多色底色存根（兼容旧调用，安全）
    // ============================================================
    window.applyDetailHighlight = function(color) {
        if (detailHighlight) {
            detailHighlight.apply(color);
        } else {
            alert('高亮功能尚未初始化，请先切换到采购详情页面');
        }
    };

    window.clearDetailHighlight = function() {
        if (detailHighlight) {
            detailHighlight.clear();
        } else {
            alert('高亮功能尚未初始化，请先切换到采购详情页面');
        }
    };

    // ============================================================
    //  初始化
    // ============================================================
    function initPurchaseDetail() {
        console.log('✅ 采购详情初始化...');
        var monthPicker = document.getElementById('filterDetailMonth');
        if (monthPicker) {
            var now = new Date();
            monthPicker.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        }

        // 确保 detailHighlight 已初始化
        if (!detailHighlight) {
            detailHighlight = new HighlightManager('detail', {
                getSelectedIds: function() {
                    var ids = [];
                    document.querySelectorAll('.detail-checkbox:checked').forEach(function(cb) {
                        var id = cb.dataset.rowId;
                        if (id) ids.push(String(id));
                    });
                    return ids;
                },
                renderCallback: renderDetailTable,
                idAttribute: 'data-row-id'
            });
        }

        renderDetailTable();
        setDetailFilter('');
    }

    // ============================================================
    //  暴露全局
    // ============================================================
    window.initPurchaseDetail = initPurchaseDetail;
    window.renderDetailTable = renderDetailTable;
    window.setDetailFilter = setDetailFilter;
    window.filterDetail = filterDetail;
    window.toggleDetailExpand = toggleDetailExpand;
    window.toggleDetailRow = toggleDetailRow;
    window.saveDetailRemark = saveDetailRemark;
    window.saveSubItemRemark = saveSubItemRemark;
    window.getSelectedDetailRows = getSelectedDetailRows;
    window.updateDetailSelectedCount = updateDetailSelectedCount;
    window.toggleAllDetailRows = toggleAllDetailRows;
    window.exportSelectedDetail = exportSelectedDetail;
    window.expandAllDetails = expandAllDetails;
    window.collapseAllDetails = collapseAllDetails;
    window.selectParentRow = selectParentRow;
    window.scrollRemarkIntoView = scrollRemarkIntoView;
    window.restoreHighlight = restoreHighlight;

    window.openDetailColumnSettings = openDetailColumnSettings;
    window.moveDetailColumnUp = moveDetailColumnUp;
    window.moveDetailColumnDown = moveDetailColumnDown;
    window.updateDetailColumnVisibility = updateDetailColumnVisibility;
    window.toggleDetailAllColumns = toggleDetailAllColumns;
    window.resetDetailColumns = resetDetailColumns;

    // 导出 detailHighlight 供调试
    window.detailHighlight = detailHighlight;

    console.log('🚀 采购详情模块加载完成（父项+子项均可独立备注）');
})();