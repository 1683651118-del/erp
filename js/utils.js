// ============================================================
//  公共工具函数
// ============================================================

// ===== 状态徽章 =====
function statusBadge(status) {
    var map = {
        // 订单状态
        '待生产': 'bg-soft-secondary',      // 灰色
        '生产中': 'bg-soft-warning',        // 橙色（更醒目）
        '待质检': 'bg-soft-warning',        // 橙色
        '质检中': 'bg-soft-warning',        // 橙色
        '质检合格': 'bg-soft-success',      // 绿色
        '质检不合格': 'bg-soft-danger',     // 红色
        '质检未通过-返单': 'bg-soft-danger', // 红色
        '质检未通过-返单(生产)': 'bg-soft-danger',
        '质检未通过-返单(外发)': 'bg-soft-danger',
        '待出货': 'bg-soft-primary',        // 蓝色
        '已完成': 'bg-soft-success',        // 绿色
        '已出货': 'bg-soft-success',        // 绿色
        '已完成-待送货': 'bg-soft-info',    // 青色
        '已送货完成': 'bg-soft-success',    // 绿色

        // 外发状态
        '待外发': 'bg-soft-secondary',      // 灰色
        '外发中': 'bg-soft-warning',        // 橙色
        '已完成-待出货': 'bg-soft-success', // 绿色

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

// ===== 获取订单 =====
function getOrder(id) {
    return data.orders.find(o => o.id === id);
}

// ===== 首字母大写 =====
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===== 获取列宽 =====
function getColumnWidths() {
    try {
        var stored = localStorage.getItem('erp_order_column_widths');
        return stored ? JSON.parse(stored) : {};
    } catch (e) { return {}; }
}

// ===== 获取单个列宽 =====
function getColumnWidth(colKey) {
    var widths = getColumnWidths();
    return widths[colKey] || null;
}

// ============================================================
//  列宽拖拽调节（通用）
//  用法：initColumnResize('ordersTable', 'erp_order_column_widths')
// ============================================================
function initColumnResize(tableId, storageKey) {
    var table = document.getElementById(tableId);
    if (!table) return;

    // 移除旧的手柄
    var oldHandles = table.querySelectorAll('.col-resize-handle');
    oldHandles.forEach(function(h) { h.remove(); });

    var headers = table.querySelectorAll('thead th');
    var dragData = null;
    var ghostLine = null;

    // 创建拖拽辅助线
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
        if (colKey === 'checkbox') return; // 复选框列不拖拽

        // 恢复保存的宽度
        var savedWidth = getColumnWidth(colKey);
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

        // 创建拖拽手柄
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
        // 保存宽度到 localStorage
        var widths = getColumnWidths();
        widths[dragData.colKey] = newWidth;
        localStorage.setItem(storageKey || 'erp_order_column_widths', JSON.stringify(widths));

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

// ===== 导出到全局 =====
window.statusBadge = statusBadge;
window.getOrder = getOrder;
window.capitalize = capitalize;
window.getColumnWidths = getColumnWidths;
window.getColumnWidth = getColumnWidth;
window.initColumnResize = initColumnResize;