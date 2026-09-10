// ============================================================
//  出货管理模块（完整版 · 服务器存储）
//  功能：出货列表、送货单打印、标签打印、数量更新、回退重填、列设置
//  数据直接更新订单的 extra 字段，通过订单 API 保存
//  外发来源订单显示“外发”紫色标签 + 供应商名字
// ============================================================

// ★★★ 确保 showToast 存在 ★★★
if (typeof showToast === 'undefined') {
    window.showToast = function(message, type) {
        console.log('📢 [Toast]', type, message);
        alert(message);
    };
    console.warn('⚠️ showToast 未加载，已使用备用 alert 替代');
}

// ★★★ 列顺序持久化 Key ★★★
const SHIP_COLUMN_ORDER_KEY = 'erp_shipment_column_order';
const SHIP_COLUMN_WIDTHS_KEY = 'erp_shipment_column_widths';

// ============================================================
//  列设置相关函数
// ============================================================

function getShipmentColumnOrder() {
    try {
        const stored = localStorage.getItem(SHIP_COLUMN_ORDER_KEY);
        if (stored) {
            const order = JSON.parse(stored);
            const allKeys = shipmentColumns.map(c => c.key);
            const missingKeys = allKeys.filter(k => !order.includes(k));
            if (missingKeys.length > 0) {
                const newOrder = [...order, ...missingKeys];
                saveShipmentColumnOrder(newOrder);
                return newOrder;
            }
            return order;
        }
    } catch (e) {}
    return shipmentColumns.map(c => c.key);
}

function saveShipmentColumnOrder(orderArray) {
    localStorage.setItem(SHIP_COLUMN_ORDER_KEY, JSON.stringify(orderArray));
}

function getShipmentColumnWidths() {
    try {
        const stored = localStorage.getItem(SHIP_COLUMN_WIDTHS_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
}

function saveShipmentColumnWidth(colKey, width) {
    const widths = getShipmentColumnWidths();
    widths[colKey] = width;
    localStorage.setItem(SHIP_COLUMN_WIDTHS_KEY, JSON.stringify(widths));
}

function getShipmentColumnWidth(colKey, defaultWidth) {
    const widths = getShipmentColumnWidths();
    return widths[colKey] || defaultWidth;
}

function initShipmentColumnResize(tableId) {
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
        if (!colKey || colKey === 'deliveryQtyInput' || colKey === 'remainingQtyDisplay' || colKey === 'actions') return;

        const savedWidth = getShipmentColumnWidth(colKey);
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
        saveShipmentColumnWidth(dragData.colKey, newWidth);
        document.body.classList.remove('resizing');
        if (dragData.handle) {
            dragData.handle.classList.remove('dragging');
        }
        ghostLine.classList.remove('visible');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        dragData = null;
        renderShipment();
    }
}

// ============================================================
//  辅助函数：获取选中的订单ID、全选等
// ============================================================

function getSelectedShipmentIds() {
    const checkedBoxes = document.querySelectorAll('#shipBody input[type="checkbox"]:checked');
    const ids = [];
    checkedBoxes.forEach(cb => {
        const id = parseInt(cb.dataset.orderId);
        if (!isNaN(id)) ids.push(id);
    });
    return ids;
}

function toggleAllShipments(checked) {
    document.querySelectorAll('#shipBody input[type="checkbox"]').forEach(cb => {
        cb.checked = checked;
    });
}

// ============================================================
//  核心 API 更新订单送货数据
// ============================================================

async function updateOrderDeliveryViaAPI(order, qty, deliveryNo, printDate, isRollback = false) {
    // ★★★ 确保订单号字段兼容 ★★★
    if (!order.orderNo && order.order_no) {
        order.orderNo = order.order_no;
    }

    const url = '/api/orders/' + order.id;
    console.log('📤 更新订单送货数据 URL:', url);
    console.log('📤 订单 ID:', order.id, '订单号:', order.orderNo);

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

    if (!isRollback) {
        const oldDelivered = order.deliveredQty || 0;
        const newDelivered = oldDelivered + qty;
        const remaining = Math.max(0, (order.qty || 0) - newDelivered);

        if (!order.deliveryHistory) order.deliveryHistory = [];
        order.deliveryHistory.push({
            date: printDate,
            qty: qty,
            deliveryNo: deliveryNo,
            cumulativeQty: newDelivered
        });

        order.deliveredQty = newDelivered;
        order.remainingQty = remaining;
        order.deliveryNo = deliveryNo;
        order.deliveryPrintDate = printDate;

        if (remaining <= 0) {
            order.status = '已完成';
            order.shipmentStatus = '已送货完成';
        }

        extraData.deliveryHistory = order.deliveryHistory;
        extraData.deliveredQty = order.deliveredQty;
        extraData.remainingQty = order.remainingQty;
        extraData.deliveryNo = order.deliveryNo;
        extraData.deliveryPrintDate = order.deliveryPrintDate;
        extraData.status = order.status;
        extraData.shipmentStatus = order.shipmentStatus;
    }

    const updateData = {
        order_no: order.orderNo,
        customer_code: order.customerCode || order.customer_code || '',
        product_code: order.productCode || order.product_code || '',
        product_name: order.productName || order.product_name || '',
        qty: order.qty || 0,
        order_date: order.orderDate || '',
        delivery_date: order.deliveryDate || '',
        remark: order.remark || '',
        status: order.status || '待生产',
        extra: JSON.stringify(extraData)
    };

    console.log('📤 请求数据:', updateData);

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            let errorMsg = `更新订单失败（状态码: ${response.status}）`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.message) {
                    errorMsg = errorData.message;
                }
            } catch (e) {
                const text = await response.text();
                errorMsg = text || errorMsg;
            }
            console.error('❌ 请求失败:', { url, orderNo: order.orderNo, statusCode: response.status, errorMsg });
            throw new Error(errorMsg);
        }

        const updated = await response.json();
        console.log('✅ 订单更新成功:', updated);

        const parsed = typeof window.parseExtraFields === 'function'
            ? window.parseExtraFields(updated)
            : updated;

        const index = data.orders.findIndex(o => o.id === order.id);
        if (index !== -1) {
            data.orders[index] = parsed;
            Object.assign(order, parsed);
        }

        return parsed;
    } catch (error) {
        console.error('❌ updateOrderDeliveryViaAPI 出错:', error);
        throw error;
    }
}

// ============================================================
//  构建送货单内容（独立函数，避免重复）
// ============================================================

function buildDeliveryContent(deliveryData, sharedDeliveryNo, sharedPrintDate) {
    const customerName = deliveryData[0]?.order?.partyName || '深圳市杰德仕科技有限公司';
    const customerAddress = deliveryData[0]?.order?.partyAddress || '广东省东莞市大朗镇富民北路598号A栋6楼';
    let rowsHtml = '';
deliveryData.forEach((item, idx) => {
    const o = item.order;
    const qty = item.qty;
    const deliveredQty = o.deliveredQty || 0;
    // ★★★ 兼容两种字段命名 ★★★
    const productCode = o.productCode || o.product_code || '';
    const productName = o.productName || o.product_name || '';
    const orderNo = o.orderNo || o.order_no || '';
    const spec = o.spec || '';
    const color = o.color || '';
    const qtyVal = o.qty || 0;

    rowsHtml += `
        <tr>
            <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${idx+1}</td>
            <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${orderNo}</td>
            <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${productCode}</td>
            <td style="padding:2px;border:1px solid #ccc;font-size:11px;word-wrap:break-word;">${productName}</td>
            <td style="padding:2px;border:1px solid #ccc;font-size:11px;word-wrap:break-word;">${spec}</td>
            <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${color}</td>
            <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${qtyVal}</td>
            <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${qty}</td>
            <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${deliveredQty}</td>
            <td style="padding:2px;border:1px solid #ccc;text-align:center;font-size:11px;">&nbsp;</td>
            <td style="padding:2px;border:1px solid #ccc;text-align:center;font-size:11px;">&nbsp;</td>
        </tr>
    `;
});
    const totalPieces = deliveryData.reduce((sum, item) => sum + item.qty, 0);

    return `
        <div id="printArea" style="background:#fff;padding:3px 6px;font-family:'Microsoft YaHei','PingFang SC',Arial,sans-serif;max-width:100%;">
            <div style="text-align:center;padding-bottom:2px;">
                <div style="font-size:14px;font-weight:700;color:#0a2540;letter-spacing:1px;">东莞市旺米数码科技有限公司</div>
                <div style="font-size:9px;color:#555;margin-top:1px;">地址：广东省东莞市大朗镇富民北路598号A栋6楼 &nbsp;|&nbsp; 电话：18665993896</div>
            </div>
            <div style="display:flex; justify-content:center; align-items:center; padding:3px 0 4px 0;">
                <div style="flex:1; display:flex; justify-content:flex-end; align-items:center;">
                    <span contenteditable="true" id="titlePrefix" style="min-width:1.2em; display:inline-block; border:1px dashed #ccc; padding:0 4px; outline:none; font-size:18px; font-weight:700; color:#0a2540; line-height:1.4;"></span>
                </div>
                <div style="flex:0 0 auto; font-size:18px; font-weight:700; color:#0a2540; letter-spacing:8px; padding:0 8px 2px 8px;">送货单</div>
                <div style="flex:1;"></div>
            </div>
            <div style="display:flex;flex-wrap:wrap;font-size:11px;padding:2px 0 4px 0;border-bottom:1px solid #ccc;">
                <div style="width:50%;padding:0 2px;"><strong>送货单位：</strong>旺米</div>
                <div style="width:50%;padding:0 2px;text-align:right;"><strong>送货单号：</strong>${sharedDeliveryNo}</div>
                <div style="width:50%;padding:0 2px;"><strong>收货单位：</strong>${customerName}</div>
                <div style="width:50%;padding:0 2px;text-align:right;"><strong>送货日期：</strong>${sharedPrintDate}</div>
                <div style="width:100%;padding:0 2px;"><strong>送货地址：</strong>${customerAddress}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-top:3px;font-size:11px;table-layout:fixed;">
                <colgroup>
                    <col style="width:4%;" /><col style="width:10%;" /><col style="width:12%;" /><col style="width:20%;" /><col style="width:15%;" />
                    <col style="width:5%;" /><col style="width:7%;" /><col style="width:7%;" /><col style="width:7%;" />
                    <col style="width:5%;" /><col style="width:5%;" />
                </colgroup>
                <thead>
                    <tr>
                        <th style="padding:2px;border:1px solid #ccc;background:#f5f6f8;text-align:center;font-weight:600;font-size:11px;">序号</th>
                        <th style="padding:2px;border:1px solid #ccc;background:#f5f6f8;text-align:center;font-weight:600;font-size:11px;">采购订单编号</th>
                        <th style="padding:2px;border:1px solid #ccc;background:#f5f6f8;text-align:center;font-weight:600;font-size:11px;">产品编号</th>
                        <th style="padding:2px;border:1px solid #ccc;background:#f5f6f8;text-align:center;font-weight:600;font-size:11px;">产品名称</th>
                        <th style="padding:2px;border:1px solid #ccc;background:#f5f6f8;text-align:center;font-weight:600;font-size:11px;">规格/描述</th>
                        <th style="padding:2px;border:1px solid #ccc;background:#f5f6f8;text-align:center;font-weight:600;font-size:11px;">颜色</th>
                        <th style="padding:2px;border:1px solid #ccc;background:#f5f6f8;text-align:center;font-weight:600;font-size:11px;">订单数量</th>
                        <th style="padding:2px;border:1px solid #ccc;background:#f5f6f8;text-align:center;font-weight:600;font-size:11px;">送货数量</th>
                        <th style="padding:2px;border:1px solid #ccc;background:#f5f6f8;text-align:center;font-weight:600;font-size:11px;">累计送货</th>
                        <th style="padding:2px;border:1px solid #ccc;background:#f5f6f8;text-align:center;font-weight:600;font-size:11px;">备品</th>
                        <th style="padding:2px;border:1px solid #ccc;background:#f5f6f8;text-align:center;font-weight:600;font-size:11px;">件数</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                    <tr>
                        <td style="padding:2px 4px;border:1px solid #ccc;text-align:right;font-weight:600;font-size:11px;" colspan="10">合计</td>
                        <td style="padding:2px 4px;border:1px solid #ccc;text-align:right;font-weight:700;font-size:11px;">${totalPieces}</td>
                    </tr>
                </tbody>
            </table>
            <div style="display:flex;justify-content:space-between;margin-top:6px;padding-top:4px;border-top:1px solid #ccc;font-size:11px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span>收货单位及经手人：（盖章）</span>
                    <span style="display:inline-block;width:80px;border-bottom:1px solid #555;">&nbsp;</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span>送货方：（盖章）</span>
                    <span style="display:inline-block;width:80px;border-bottom:1px solid #555;">&nbsp;</span>
                </div>
            </div>
        </div>
        <style>
            @media print {
                html, body { margin:0; padding:0; background:#fff; width:100%; height:auto; }
                body * { visibility:hidden; }
                #printArea, #printArea * { visibility:visible; }
                #printArea { position:fixed; left:0; top:0; width:100%; padding:3px 4px; background:#fff; box-sizing:border-box; z-index:9999; }
                .modal-header, .modal-footer, .btn-close, .modal-backdrop, .modal-title { display:none !important; visibility:hidden !important; opacity:0; width:0; height:0; padding:0; margin:0; border:none; overflow:hidden; position:absolute; left:-9999px; }
                .modal-body { display:block; visibility:visible; padding:0; margin:0; background:#fff; border:none; box-shadow:none; overflow:visible; position:static; width:100%; height:auto; }
                .modal-dialog, .modal-content { display:block; visibility:visible; position:static; width:100%; max-width:100%; margin:0; padding:0; border:none; box-shadow:none; background:#fff; }
                table { page-break-inside:auto; }
                tr { page-break-inside:avoid; }
                @page { margin:2mm 3mm; size:210mm 140mm; }
            }
        </style>
    `;
}

// ============================================================
//  打印功能（送货单 + 标签）
// ============================================================

let _deliverySnapshot = null;
let _lastDeliveryData = null;

function printShipments(type) {
    if (window._printing) {
        console.warn('⚠️ 正在打印，请稍候');
        return;
    }
    window._printing = true;
    console.log('🖨️ printShipments 被调用');

    try {
        if (type === 'label') {
            openBoxQtyModal();
            window._printing = false;
            return;
        }

        const checkedBoxes = document.querySelectorAll('#shipBody input[type="checkbox"]:checked');
        if (checkedBoxes.length === 0) {
            alert('请至少选择一个订单');
            window._printing = false;
            return;
        }

        // 收集送货数据
        const deliveryMap = new Map();
        let hasError = false;

        checkedBoxes.forEach((cb) => {
            const row = cb.closest('tr');
            if (!row) return;
            const orderId = parseInt(cb.dataset.orderId);
            if (isNaN(orderId) || deliveryMap.has(orderId)) return;

            const order = data.orders.find(o => o.id === orderId);
            if (!order) return;

            const qtyInput = row.querySelector('.delivery-qty-input');
            if (!qtyInput) return;
            const rawValue = qtyInput.value.trim();
            if (rawValue === '' || rawValue === '0') return;
            const qty = parseInt(rawValue, 10);
            if (isNaN(qty) || qty <= 0) {
                alert(`订单 ${order.orderNo} 的本次数量无效`);
                hasError = true;
                return;
            }
            const remaining = order.remainingQty || 0;
            if (qty > remaining) {
                alert(`订单 ${order.orderNo} 的本次数量不能大于剩余 ${remaining}`);
                hasError = true;
                return;
            }
            deliveryMap.set(orderId, { order, qty });
        });

        if (hasError) { window._printing = false; return; }
        const deliveryData = Array.from(deliveryMap.values());
        if (deliveryData.length === 0) {
            alert('没有需要打印的订单');
            window._printing = false;
            return;
        }

        // 保存快照
        _deliverySnapshot = deliveryData.map(item => ({
            orderId: item.order.id,
            deliveredQty: item.order.deliveredQty || 0,
            remainingQty: item.order.remainingQty || 0,
            deliveryNo: item.order.deliveryNo || '',
            deliveryPrintDate: item.order.deliveryPrintDate || '',
            deliveryHistory: JSON.parse(JSON.stringify(item.order.deliveryHistory || [])),
            status: item.order.status || '',
            shipmentStatus: item.order.shipmentStatus || ''
        }));
        _lastDeliveryData = deliveryData.map(item => ({ order: item.order, qty: item.qty }));

        // 生成送货单号
        const now = new Date();
        const dateStr = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
        const existingCount = data.orders.filter(o => o.deliveryNo && o.deliveryNo.startsWith('JDS' + dateStr)).length;
        const count = existingCount + 1;
        const sharedDeliveryNo = 'JDS' + dateStr + String(count).padStart(4,'0');
        const sharedPrintDate = now.getFullYear() + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' + String(now.getDate()).padStart(2,'0');

        // 更新订单
        showToast('⏳ 正在更新订单数据...', 'info');
        (async function() {
            for (const item of deliveryData) {
                await updateOrderDeliveryViaAPI(item.order, item.qty, sharedDeliveryNo, sharedPrintDate);
            }
            if (typeof window.saveDataToStorage === 'function') {
                window.saveDataToStorage();
            }

            // ★★★ 构建送货单 HTML（只包含内容，无模态框） ★★★
            const customerName = deliveryData[0]?.order?.partyName || '深圳市杰德仕科技有限公司';
            const customerAddress = deliveryData[0]?.order?.partyAddress || '广东省东莞市大朗镇富民北路598号A栋6楼';

            let rowsHtml = '';
            deliveryData.forEach((item, idx) => {
                const o = item.order;
                const qty = item.qty;
                const deliveredQty = o.deliveredQty || 0;
                rowsHtml += `
                    <tr>
                        <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${idx+1}</td>
                        <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${o.orderNo || ''}</td>
                        <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${o.productCode || ''}</td>
                        <td style="padding:2px;border:1px solid #ccc;font-size:11px;word-wrap:break-word;">${o.productName || ''}</td>
                        <td style="padding:2px;border:1px solid #ccc;font-size:11px;word-wrap:break-word;">${o.spec || ''}</td>
                        <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${o.color || ''}</td>
                        <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${o.qty || 0}</td>
                        <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${qty}</td>
                        <td style="text-align:center;padding:2px;border:1px solid #ccc;font-size:11px;">${deliveredQty}</td>
                        <td style="padding:2px;border:1px solid #ccc;text-align:center;font-size:11px;">&nbsp;</td>
                        <td style="padding:2px;border:1px solid #ccc;text-align:center;font-size:11px;">&nbsp;</td>
                    </tr>
                `;
            });
            const totalPieces = deliveryData.reduce((sum, item) => sum + item.qty, 0);

            // 构建完整 HTML（包含样式和内容，不依赖任何外部样式）
            const printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>送货单</title>
                    <style>
                        body { font-family: 'Microsoft YaHei','PingFang SC',Arial,sans-serif; padding:10px; background:#fff; }
                        .print-area { max-width:100%; margin:0 auto; }
                        .header { text-align:center; padding-bottom:5px; }
                        .header h1 { font-size:14px; margin:0; font-weight:700; color:#0a2540; }
                        .header p { font-size:9px; color:#555; margin:2px 0; }
                        .title { text-align:center; font-size:18px; font-weight:700; color:#0a2540; letter-spacing:8px; padding:8px 0; }
                        .info { display:flex; flex-wrap:wrap; font-size:11px; padding:5px 0; border-bottom:1px solid #ccc; }
                        .info div { width:50%; padding:2px; }
                        .info .full { width:100%; }
                        table { width:100%; border-collapse:collapse; font-size:11px; margin-top:5px; }
                        table th { padding:4px; border:1px solid #ccc; background:#f5f6f8; text-align:center; font-weight:600; }
                        table td { padding:4px; border:1px solid #ccc; text-align:center; }
                        .footer { display:flex; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px solid #ccc; font-size:11px; }
                        @media print {
                            body { margin:0; padding:0; }
                            .no-print { display:none; }
                            @page { margin:2mm 3mm; size:210mm 140mm; }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-area">
                        <div class="header">
                            <h1>东莞市旺米数码科技有限公司</h1>
                            <p>地址：广东省东莞市大朗镇富民北路598号A栋6楼 &nbsp;|&nbsp; 电话：18665993896</p>
                        </div>
                        <div class="title">送货单</div>
                        <div class="info">
                            <div><strong>送货单位：</strong>旺米</div>
                            <div style="text-align:right;"><strong>送货单号：</strong>${sharedDeliveryNo}</div>
                            <div><strong>收货单位：</strong>${customerName}</div>
                            <div style="text-align:right;"><strong>送货日期：</strong>${sharedPrintDate}</div>
                            <div class="full"><strong>送货地址：</strong>${customerAddress}</div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width:4%;">序号</th>
                                    <th style="width:10%;">采购订单编号</th>
                                    <th style="width:12%;">产品编号</th>
                                    <th style="width:20%;">产品名称</th>
                                    <th style="width:15%;">规格/描述</th>
                                    <th style="width:5%;">颜色</th>
                                    <th style="width:7%;">订单数量</th>
                                    <th style="width:7%;">送货数量</th>
                                    <th style="width:7%;">累计送货</th>
                                    <th style="width:5%;">备品</th>
                                    <th style="width:5%;">件数</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                                <tr>
                                    <td colspan="10" style="text-align:right;font-weight:600;">合计</td>
                                    <td style="font-weight:700;">${totalPieces}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div class="footer">
                            <div>收货单位及经手人：（盖章）</div>
                            <div>送货方：（盖章）</div>
                        </div>
                    </div>
                </body>
                </html>
            `;

            // ★★★ 使用新窗口打印，完全隔离 ★★★
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (!printWindow) {
                alert('请允许弹出窗口，以便打印');
                window._printing = false;
                return;
            }
            printWindow.document.write(printContent);
            printWindow.document.close();
            // 等待内容加载完成后打印
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
                // 打印完成后关闭窗口（可选）
                // printWindow.close();
            }, 300);

            window._printing = false;
            setTimeout(() => renderShipment(), 500);
        })();

    } catch (error) {
        console.error('❌ 打印出错:', error);
        alert('打印失败：' + error.message);
        window._printing = false;
    }
}

function goBackToDeliveryQty() {
    if (!_deliverySnapshot || !_lastDeliveryData) {
        alert('没有可回退的数据（本次未打印）');
        return;
    }

    if (!confirm('确定要撤销本次打印的数据更新吗？\n订单将恢复到打印前的状态，你可以重新输入数量。')) {
        return;
    }

    (async function() {
        try {
            showToast('⏳ 正在回退...', 'info');
            for (const snap of _deliverySnapshot) {
                const order = data.orders.find(o => o.id === snap.orderId);
                if (order) {
                    order.deliveredQty = snap.deliveredQty;
                    order.remainingQty = snap.remainingQty;
                    order.deliveryNo = snap.deliveryNo || '';
                    order.deliveryPrintDate = snap.deliveryPrintDate || '';
                    order.deliveryHistory = snap.deliveryHistory || [];
                    if (snap.status) order.status = snap.status;
                    if (snap.shipmentStatus) order.shipmentStatus = snap.shipmentStatus;
                    await updateOrderDeliveryViaAPI(order, 0, snap.deliveryNo, snap.deliveryPrintDate, true);
                }
            }
            if (typeof window.saveDataToStorage === 'function') {
                window.saveDataToStorage();
            }

            const previewModal = bootstrap.Modal.getInstance(document.getElementById('printPreviewModal'));
            if (previewModal) previewModal.hide();

            renderShipment();
            _deliverySnapshot = null;
            _lastDeliveryData = null;

            showToast('✅ 已回退到打印前状态', 'success');
        } catch (err) {
            showToast('❌ 回退失败: ' + err.message, 'error');
            console.error(err);
        }
    })();
}

function executePrintPreview() {
    const prefixEl = document.getElementById('titlePrefix');
    if (prefixEl) {
        const text = prefixEl.innerText.trim();
        if (text === '') {
            prefixEl.style.display = 'none';
        } else {
            prefixEl.style.border = 'none';
        }
    }
    window.print();
}

// ============================================================
//  标签打印相关
// ============================================================

function openBoxQtyModal() {
    const checkedBoxes = document.querySelectorAll('#shipBody input[type="checkbox"]:checked');
    if (checkedBoxes.length === 0) {
        alert('请至少选择一个订单');
        return;
    }

    const selectedOrders = [];
    let totalQty = 0;
    checkedBoxes.forEach(cb => {
        const orderId = parseInt(cb.dataset.orderId);
        const order = data.orders.find(o => o.id === orderId);
        if (order) {
            const row = cb.closest('tr');
            const qtyInput = row?.querySelector('.delivery-qty-input');
            let qty = parseInt(qtyInput?.value) || 0;
            if (qty <= 0) {
                qty = order.remainingQty || 0;
            }
            if (qty > 0) {
                selectedOrders.push({ ...order, _deliveryQty: qty });
                totalQty += qty;
            }
        }
    });

    if (selectedOrders.length === 0) {
        alert('请先填写本次送货数量（或确保订单有剩余数量）');
        return;
    }

    window._labelOrders = selectedOrders;
    window._labelTotalQty = totalQty;

    document.getElementById('boxQtyTotal').textContent = totalQty + ' 个';
    document.getElementById('boxQtyInput').value = '';
    document.getElementById('boxQtyResult').textContent = '0 张';
    document.getElementById('boxQtyInput').max = totalQty;

    document.getElementById('boxQtyInput').oninput = function() {
        const boxQty = parseInt(this.value) || 0;
        if (boxQty <= 0) {
            document.getElementById('boxQtyResult').textContent = '0 张';
            return;
        }
        const total = window._labelTotalQty || 0;
        const count = Math.ceil(total / boxQty);
        document.getElementById('boxQtyResult').textContent = count + ' 张';
    };

    document.getElementById('confirmBoxQtyBtn').onclick = function() {
        confirmBoxQtyAndPrint();
    };

    const modal = new bootstrap.Modal(document.getElementById('boxQtyModal'));
    modal.show();
}

function confirmBoxQtyAndPrint() {
    const boxQty = parseInt(document.getElementById('boxQtyInput').value) || 0;
    if (boxQty <= 0) {
        alert('请输入有效的每箱数量（大于0）');
        return;
    }

    const orders = window._labelOrders || [];
    if (orders.length === 0) {
        alert('没有可打印的订单');
        return;
    }

    const modal = bootstrap.Modal.getInstance(document.getElementById('boxQtyModal'));
    if (modal) modal.hide();

    const contentHtml = generateLabelsByBox(orders, boxQty);

    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) {
        alert('请允许弹出窗口，以便打印标签');
        return;
    }

    win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>出货标签</title>');
    win.document.write('<style>');
    win.document.write(`
        .label-item {
            width: 80mm; height: 60mm; background: #fff; border: 1.5px solid #0066cc; border-radius: 4px;
            padding: 3px 5px; box-sizing: border-box; display: flex; flex-direction: column;
            justify-content: space-between; font-size: 8px; line-height: 1.2; margin: 0;
            page-break-after: always; page-break-inside: avoid;
        }
        .label-item:last-child { page-break-after: auto; }
        @page { size: 80mm 60mm; margin: 0; }
        .label-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #0066cc; padding-bottom: 1px; margin-bottom: 1px; }
        .label-title { font-weight: 700; font-size: 9px; color: #0a2540; }
        .label-date { font-size: 6.5px; color: #999; }
        .label-box-info { display: flex; justify-content: space-between; background: #e8f0fe; border-radius: 2px; padding: 1px 4px; margin-bottom: 1px; font-size: 7.5px; font-weight: 600; }
        .box-number { color: #0047ab; }
        .box-qty { color: #0f7b4a; }
        .label-body { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 0.5px; }
        .label-body > div { display: flex; align-items: baseline; padding: 0.5px 0; }
        .label-key { color: #6c7a8a; width: 28px; flex-shrink: 0; font-size: 7px; }
        .label-value { color: #1a2a3a; font-size: 7px; word-break: break-word; flex: 1; }
        .label-total { color: #0066cc; font-weight: 700; font-size: 9px; }
        .label-footer { display: flex; justify-content: space-between; border-top: 1px dashed #ddd; padding-top: 1px; margin-top: 1px; font-size: 6.5px; color: #999; }
        @media screen {
            .label-item { width: 240px; height: 180px; font-size: 9px; }
            .label-item .label-key { font-size: 8px; width: 32px; }
            .label-item .label-value { font-size: 8px; }
            .label-item .label-title { font-size: 11px; }
            .label-item .label-date { font-size: 7px; }
            .label-item .label-footer { font-size: 7px; }
            .label-item .label-total { font-size: 10px; }
            .label-item .label-box-info { font-size: 8.5px; }
        }
    `);
    win.document.write('</style></head><body>');
    win.document.write(contentHtml);
    win.document.write('</body></html>');
    win.document.close();

    setTimeout(() => {
        win.focus();
        win.print();
    }, 500);
}

function generateLabelsByBox(orders, boxQty) {
    let allLabelsHtml = '';
    let totalLabelCount = 0;

    orders.forEach(order => {
        const qty = order._deliveryQty || order.remainingQty || 0;
        const count = Math.ceil(qty / boxQty);
        totalLabelCount += count;
    });

    orders.forEach((order, orderIdx) => {
        const qty = order._deliveryQty || order.remainingQty || 0;
        const labelCount = Math.ceil(qty / boxQty);

        if (orders.length > 1) {
            allLabelsHtml += `
                <div style="width:100%;text-align:center;padding:4px 0;font-size:12px;font-weight:600;color:#0066cc;background:#f0f4f8;border-radius:4px;margin-bottom:4px;page-break-after:avoid;">
                    📦 ${order.orderNo}（共 ${labelCount} 箱）
                </div>
            `;
        }

        for (let i = 0; i < labelCount; i++) {
            const actualQty = (i === labelCount - 1) ? (qty - i * boxQty) : boxQty;
            allLabelsHtml += `
                <div class="label-item">
                    <div class="label-header">
                        <span class="label-title">📦 出货标签</span>
                        <span class="label-date">${new Date().toISOString().slice(0,10)}</span>
                    </div>
                    <div class="label-box-info">
                        <span class="box-number">第 ${i+1} 箱 / 共 ${labelCount} 箱</span>
                        <span class="box-qty">${actualQty} 个</span>
                    </div>
                    <div class="label-body">
                        <div><span class="label-key">订单号</span><span class="label-value">${order.orderNo || ''}</span></div>
                        <div><span class="label-key">客户号</span><span class="label-value">${order.customerCode || ''}</span></div>
                        <div><span class="label-key">客户</span><span class="label-value">${order.partyName || ''}</span></div>
                        <div><span class="label-key">产品</span><span class="label-value">${order.productName || ''}</span></div>
                        <div><span class="label-key">颜色</span><span class="label-value">${order.color || ''}</span></div>
                        <div><span class="label-key">规格</span><span class="label-value">${order.spec || ''}</span></div>
                        <div><span class="label-key">本箱数量</span><span class="label-total">${actualQty}</span></div>
                    </div>
                    <div class="label-footer">
                        <span>品质：合格</span>
                        <span>日期：${new Date().toISOString().slice(0,10)}</span>
                    </div>
                </div>
            `;
        }
    });

    return `
        <div style="background:#f5f6f8;padding:10px;font-family:'Microsoft YaHei','PingFang SC',Arial,sans-serif;max-width:100%;">
            <div style="text-align:center;margin-bottom:8px;font-size:12px;color:#999;">
                共 ${totalLabelCount} 张标签 
                <span style="margin-left:12px;">每箱 ${boxQty} 个</span>
                <span style="margin-left:12px;">打印日期：${new Date().toISOString().slice(0,10)}</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-start;">
                ${allLabelsHtml}
            </div>
        </div>
    `;
}

// ============================================================
//  页面渲染（包含外发标签显示）
// ============================================================

function initShipment() {
    renderShipment();
    document.getElementById('shipFilterOrderNo')?.addEventListener('input', renderShipment);
    document.getElementById('shipFilterProduct')?.addEventListener('input', renderShipment);
    document.getElementById('shipFilterStatus')?.addEventListener('change', renderShipment);
    document.getElementById('shipFilterQualityStatus')?.addEventListener('change', renderShipment);
}

function renderShipment() {
    console.log('🔄 执行完整版 renderShipment...');
    try {
        const filterOrderNo = document.getElementById('shipFilterOrderNo')?.value?.toLowerCase() || '';
        const filterProduct = document.getElementById('shipFilterProduct')?.value?.toLowerCase() || '';
        const filterStatus = document.getElementById('shipFilterStatus')?.value || '';
        const filterQualityStatus = document.getElementById('shipFilterQualityStatus')?.value || '';

        // 兼容驼峰和下划线命名
        let list = data.orders.filter(o => {
            const status = o.status || '';
            const isShipmentReady = status === '待出货' || status === '已完成-待送货' || status === '已送货完成' || status === '已完成';
            if (!isShipmentReady) return false;

            const orderNo = o.orderNo || o.order_no || '';
            const productName = o.productName || o.product_name || '';
            const shipmentStatus = o.shipmentStatus || '';

            const matchNo = orderNo.toLowerCase().includes(filterOrderNo);
            const matchProd = productName.toLowerCase().includes(filterProduct);
            const matchStatus = filterStatus === '' || status === filterStatus;
            const matchQuality = filterQualityStatus === '' || shipmentStatus === filterQualityStatus;
            return matchNo && matchProd && matchStatus && matchQuality;
        });
        list.sort((a,b) => b.id - a.id);

        // 列配置
        const colOrder = getShipmentColumnOrder();
        const normalCols = [];
        colOrder.forEach(key => {
            if (key === 'actions') return;
            const col = shipmentColumns.find(c => c.key === key);
            if (col) normalCols.push(col);
        });
        shipmentColumns.forEach(col => {
            if (col.key !== 'actions' && !normalCols.some(c => c.key === col.key)) {
                normalCols.push(col);
            }
        });
        const visibleNormalCols = normalCols.filter(col => shipColumnsVisible[col.key] !== false);
        const showActions = shipColumnsVisible['actions'] !== false;

        const actionsDefaultWidth = 120;
        const remainingDefaultWidth = 100;
        const deliveryDefaultWidth = 120;

        const actionsWidth = getShipmentColumnWidth('actions') || actionsDefaultWidth;
        const remainingWidth = getShipmentColumnWidth('remainingQtyDisplay') || remainingDefaultWidth;
        const deliveryWidth = getShipmentColumnWidth('deliveryQtyInput') || deliveryDefaultWidth;

        const actionsRight = 0;
        const remainingRight = actionsWidth + 2;
        const deliveryRight = actionsWidth + remainingWidth + 4;

        const defaultWidths = {
            'status': 80, 'customerCode': 90, 'deliveryNo': 140, 'deliveryPrintDate': 110,
            'orderNo': 140, 'productCode': 160, 'productName': 220, 'spec': 200,
            'color': 80, 'stamp': 80, 'qty': 80, 'materialBoard': 80, 'materialShell': 80,
            'orderDate': 110, 'deliveryDate': 110, 'boardCode': 100, 'shellStock': 100,
            'progress': 80, 'qualityStatus': 90, 'shipmentSchedule': 120,
            'partyName': 160, 'partyContact': 100, 'remark': 180,
            'shipmentStatus': 90, 'source': 80
        };

        // 表头
        const thead = document.getElementById('shipThead');
        if (!thead) return;
        let headerHtml = '<tr>';
        headerHtml += `<th style="width:36px;text-align:center;position:sticky;left:0;top:0;z-index:15;background:#fafbfc;">
            <input type="checkbox" id="shipSelectAll" onchange="toggleAllShipments(this.checked)" />
        </th>`;
        visibleNormalCols.forEach(col => {
            const isSticky = (col.key === 'remark' || col.key === 'source');
            const stickyClass = isSticky ? 'sticky-col' : '';
            const remarkClass = col.key === 'remark' ? 'sticky-col-remark' : '';
            const width = getShipmentColumnWidth(col.key) || defaultWidths[col.key] || 120;
            headerHtml += `<th data-col="${col.key}" class="${stickyClass} ${remarkClass}" style="position:sticky;top:0;z-index:10;width:${width}px;min-width:${width}px;background:#fafbfc;">${col.label}</th>`;
        });
        headerHtml += `<th data-col="deliveryQtyInput" style="position:sticky;right:${deliveryRight}px;top:0;z-index:999;width:${deliveryWidth}px;min-width:${deliveryWidth}px;text-align:center;background:#fafbfc;border-left:2px solid #e9edf2;">本次送货</th>`;
        headerHtml += `<th data-col="remainingQtyDisplay" style="position:sticky;right:${remainingRight}px;top:0;z-index:999;width:${remainingWidth}px;min-width:${remainingWidth}px;text-align:center;background:#fafbfc;border-left:2px solid #e9edf2;">剩余送货数量</th>`;
        if (showActions) {
            headerHtml += `<th data-col="actions" class="sticky-col sticky-col-actions" style="position:sticky;right:${actionsRight}px;top:0;z-index:999;width:${actionsWidth}px;min-width:${actionsWidth}px;background:#fafbfc;border-left:2px solid #e9edf2;">操作</th>`;
        }
        headerHtml += '</tr>';

        // 筛选行
        const filterBg = '#f8fafc';
        headerHtml += '<tr class="filter-row">';
        headerHtml += `<th style="background:${filterBg};"></th>`;
        visibleNormalCols.forEach(col => {
            if (col.key === 'actions') return;
            const options = new Set();
            list.forEach(o => {
                let val = '';
                switch (col.key) {
                    case 'status': val = o.status || ''; break;
                    case 'customerCode': val = o.customerCode || o.customer_code || ''; break;
                    case 'deliveryNo': val = o.deliveryNo || ''; break;
                    case 'deliveryPrintDate': val = o.deliveryPrintDate || ''; break;
                    case 'orderNo': val = o.orderNo || o.order_no || ''; break;
                    case 'productCode': val = o.productCode || o.product_code || ''; break;
                    case 'productName': val = o.productName || o.product_name || ''; break;
                    case 'spec': val = o.spec || ''; break;
                    case 'color': val = o.color || ''; break;
                    case 'stamp': val = o.stamp || ''; break;
                    case 'qty': val = String(o.qty || ''); break;
                    case 'materialBoard': val = o.materialBoard || ''; break;
                    case 'materialShell': val = o.materialShell || ''; break;
                    case 'orderDate': val = o.orderDate || ''; break;
                    case 'deliveryDate': val = o.deliveryDate || ''; break;
                    case 'boardCode': val = o.boardCode || ''; break;
                    case 'shellStock': val = o.shellStock || ''; break;
                    case 'progress': val = String(o.progress || ''); break;
                    case 'qualityStatus': val = o.qualityStatus || ''; break;
                    case 'shipmentSchedule': val = o.shipmentSchedule || ''; break;
                    case 'remark': val = o.remark || ''; break;
                    case 'shipmentStatus': val = o.shipmentStatus || ''; break;
                    case 'source': val = o.source || ''; break;
                    default: break;
                }
                if (val) options.add(val);
            });
            const sortedOptions = Array.from(options).sort();
            let selectHtml = `<select data-col="${col.key}" class="form-select form-select-sm" style="font-size:12px;border:1px solid #e2e8f0;border-radius:4px;padding:2px 4px;background:#fff;" onchange="renderShipment()"><option value="">全部</option>`;
            sortedOptions.forEach(opt => {
                selectHtml += `<option value="${opt}">${opt}</option>`;
            });
            selectHtml += '</select>';
            headerHtml += `<th>${selectHtml}</th>`;
        });
        headerHtml += `<th style="position:sticky;right:${deliveryRight}px;z-index:10;background:${filterBg};width:${deliveryWidth}px;min-width:${deliveryWidth}px;border-left:none;"></th>`;
        headerHtml += `<th style="position:sticky;right:${remainingRight}px;z-index:10;background:${filterBg};width:${remainingWidth}px;min-width:${remainingWidth}px;border-left:none;"></th>`;
        if (showActions) {
            headerHtml += `<th style="position:sticky;right:${actionsRight}px;z-index:10;background:${filterBg};width:${actionsWidth}px;min-width:${actionsWidth}px;border-left:none;"></th>`;
        }
        headerHtml += '</tr>';
        thead.innerHTML = headerHtml;

        // 表格体
        const tbody = document.getElementById('shipBody');
        if (!tbody) return;
        if (list.length === 0) {
            const total = data.orders.filter(o => {
                const status = o.status || '';
                return status === '待出货' || status === '已完成-待送货' || status === '已送货完成' || status === '已完成';
            }).length;
            const extraMsg = total > 0 ? `<div class="mt-2 text-muted small">（共 ${total} 条出货订单，当前筛选条件未匹配）</div>` : '';
            const colspan = visibleNormalCols.length + (showActions ? 1 : 0) + 3 + 1;
            tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted">暂无出货订单${extraMsg}</td></tr>`;
            return;
        }

        let rowsHtml = '';
        list.forEach(o => {
            // 兼容字段
            const orderNo = o.orderNo || o.order_no || '';
            const productCode = o.productCode || o.product_code || '';
            const productName = o.productName || o.product_name || '';
            const customerCode = o.customerCode || o.customer_code || '';
            const spec = o.spec || '';
            const color = o.color || '';
            const stamp = o.stamp || '';
            const qty = o.qty || 0;
            const materialBoard = o.materialBoard || '';
            const materialShell = o.materialShell || '';
            const orderDate = o.orderDate || '';
            const deliveryDate = o.deliveryDate || '';
            const boardCode = o.boardCode || '';
            const shellStock = o.shellStock || '';
            const progress = o.progress || 0;
            const qualityStatus = o.qualityStatus || '';
            const shipmentSchedule = o.shipmentSchedule || '';
            const remark = o.remark || '';
            const partyName = o.partyName || '';
            const partyContact = o.partyContact || '';
            const shipmentStatus = o.shipmentStatus || '';
            const source = o.source || '';

            const remaining = Math.max(0, o.remainingQty || 0);
            const rowBg = source === 'outsource' ? 'background-color: #f8f0ff;' : '';

            rowsHtml += `<tr style="${rowBg}">`;
            rowsHtml += `<td style="text-align:center;position:sticky;left:0;top:auto;z-index:5;background:#fff;">
                <input type="checkbox" class="ship-select-item" data-order-id="${o.id}" />
            </td>`;

            visibleNormalCols.forEach(col => {
                let val = '';
                let extraClass = '';
                if (col.key === 'productName' || col.key === 'spec' || col.key === 'remark' || col.key === 'partyName' || col.key === 'partyContact' || col.key === 'deliveryNo' || col.key === 'orderNo') {
                    extraClass = 'wrap-cell';
                    if (col.key === 'productName') extraClass += ' product-name';
                    if (col.key === 'spec') extraClass += ' spec-cell';
                }

                switch (col.key) {
                    case 'status':
                        const statusHtml = `<span class="badge-status ${statusBadge(o.status)}">${o.status || '待生产'}</span>`;
                        if (source === 'outsource') {
                            const outRecord = data.outsourceOrders.find(os => os.orderId === o.id);
                            const supplierName = outRecord ? outRecord.supplier : '';
                            val = statusHtml + `<div style="display:inline-flex;flex-direction:column;align-items:center;margin-left:8px;vertical-align:middle;">
                                <span class="badge" style="font-size:12px;padding:2px 12px;border-radius:12px;background-color:#6f42c1!important;color:#fff!important;font-weight:600;line-height:1.5;">外发</span>
                                ${supplierName ? `<span style="font-size:11px;color:#6f42c1;font-weight:600;line-height:1.3;margin-top:1px;">${supplierName}</span>` : ''}
                            </div>`;
                        } else {
                            val = statusHtml;
                        }
                        break;
                    case 'customerCode': val = customerCode; break;
                    case 'deliveryNo': val = o.deliveryNo || ''; break;
                    case 'deliveryPrintDate': val = o.deliveryPrintDate || ''; break;
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
                    case 'partyName': val = partyName; break;
                    case 'partyContact': val = partyContact; break;
                    case 'remark': val = remark; break;
                    case 'shipmentStatus': val = `<span class="badge-status ${statusBadge(shipmentStatus)}">${shipmentStatus}</span>`; break;
                    case 'source': val = source; break;
                    default: break;
                }
                const isSticky = (col.key === 'remark' || col.key === 'source');
                const stickyClass = isSticky ? 'sticky-col' : '';
                const remarkClass = col.key === 'remark' ? 'sticky-col-remark' : '';
                const width = getShipmentColumnWidth(col.key) || defaultWidths[col.key] || 120;
                rowsHtml += `<td class="${stickyClass} ${remarkClass} ${extraClass}" style="width:${width}px;min-width:${width}px;background:#fff;">${val}</td>`;
            });

            rowsHtml += `<td style="text-align:center;position:sticky;right:${deliveryRight}px;z-index:5;background:#fff;border-left:2px solid #e9edf2;width:${deliveryWidth}px;min-width:${deliveryWidth}px;">
                <input type="number" class="form-control form-control-sm delivery-qty-input" 
                       data-order-id="${o.id}" value="${remaining}" min="0" max="${remaining}" step="1"
                       style="width:100%;display:inline-block;text-align:center;" />
            </td>`;
            rowsHtml += `<td style="text-align:center;font-weight:bold;color:#0066cc;position:sticky;right:${remainingRight}px;z-index:5;background:#fff;border-left:2px solid #e9edf2;width:${remainingWidth}px;min-width:${remainingWidth}px;">${remaining}</td>`;
            if (showActions) {
                rowsHtml += `<td class="sticky-col sticky-col-actions" style="position:sticky;right:${actionsRight}px;z-index:5;background:#fff;border-left:2px solid #e9edf2;width:${actionsWidth}px;min-width:${actionsWidth}px;">
                    <button class="btn btn-sm btn-outline-custom" onclick="openOrderDetail(${o.id})"><i class="bi bi-eye"></i> 查看</button>
                </td>`;
            }
            rowsHtml += '</tr>';
        });
        tbody.innerHTML = rowsHtml;

        // 更新全选状态
        const allCheckbox = document.getElementById('shipSelectAll');
        if (allCheckbox) {
            const items = document.querySelectorAll('#shipBody .ship-select-item');
            const checkedItems = document.querySelectorAll('#shipBody .ship-select-item:checked');
            allCheckbox.checked = items.length > 0 && checkedItems.length === items.length;
        }

        // 列宽拖拽
        setTimeout(() => {
            try {
                initShipmentColumnResize('shipTable');
            } catch (e) {
                console.warn('列宽拖拽初始化失败:', e);
            }
        }, 200);

    } catch (e) {
        console.error('渲染出错:', e);
        alert('页面渲染出错：' + e.message);
    }
}

function resetShipFilters() {
    document.getElementById('shipFilterOrderNo').value = '';
    document.getElementById('shipFilterProduct').value = '';
    document.getElementById('shipFilterStatus').value = '';
    document.getElementById('shipFilterQualityStatus').value = '';
    renderShipment();
}

// ============================================================
//  列设置模态框
// ============================================================

function openShipColumnSettings() {
    const content = document.getElementById('shipColumnSettingsContent');
    const order = getShipmentColumnOrder();
    let html = `<div class="mb-2"><strong>调整列顺序（点击 ↑↓ 移动）</strong></div>`;
    html += `<div class="form-check mb-2"><input type="checkbox" class="form-check-input" id="ship_col_all" onchange="toggleShipAllColumns(this.checked)"><label class="form-check-label" for="ship_col_all">全选</label></div>`;
    html += `<div id="shipColumnSortableList" class="list-group">`;
    order.forEach((key) => {
        if (key === 'actions') return;
        const col = shipmentColumns.find(c => c.key === key);
        if (!col) return;
        const checked = shipColumnsVisible[col.key] !== false ? 'checked' : '';
        html += `<div class="list-group-item d-flex align-items-center justify-content-between" data-key="${key}" style="padding:6px 12px;">
            <div class="d-flex align-items-center gap-2">
                <input type="checkbox" class="form-check-input ship-col-check" data-col="${key}" ${checked} onchange="updateShipColumnVisibility()">
                <span style="font-weight:500;">${col.label}</span>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-secondary" onclick="moveShipColumnUp('${key}')" title="上移">↑</button>
                <button class="btn btn-sm btn-outline-secondary" onclick="moveShipColumnDown('${key}')" title="下移">↓</button>
            </div>
        </div>`;
    });
    html += `</div>`;
    content.innerHTML = html;
    new bootstrap.Modal(document.getElementById('shipColumnSettingsModal')).show();
}

function moveShipColumnUp(key) {
    const order = getShipmentColumnOrder();
    const idx = order.indexOf(key);
    if (idx <= 0) return;
    [order[idx-1], order[idx]] = [order[idx], order[idx-1]];
    saveShipmentColumnOrder(order);
    refreshShipColumnSettingsList();
    renderShipment();
}

function moveShipColumnDown(key) {
    const order = getShipmentColumnOrder();
    const idx = order.indexOf(key);
    if (idx === -1 || idx >= order.length - 1) return;
    [order[idx], order[idx+1]] = [order[idx+1], order[idx]];
    saveShipmentColumnOrder(order);
    refreshShipColumnSettingsList();
    renderShipment();
}

function updateShipColumnVisibility() {
    document.querySelectorAll('.ship-col-check').forEach(cb => {
        const col = cb.dataset.col;
        shipColumnsVisible[col] = cb.checked;
    });
    saveDataToStorage();
    renderShipment();
}

function toggleShipAllColumns(checked) {
    document.querySelectorAll('.ship-col-check').forEach(cb => {
        cb.checked = checked;
        const col = cb.dataset.col;
        shipColumnsVisible[col] = checked;
    });
    saveDataToStorage();
    renderShipment();
}

function resetShipColumns() {
    if (!confirm('恢复所有列到默认顺序和可见性，列宽也将重置。确定？')) return;
    const defaultOrder = shipmentColumns.map(c => c.key);
    saveShipmentColumnOrder(defaultOrder);
    shipmentColumns.forEach(col => { if (col.key !== 'actions') shipColumnsVisible[col.key] = true; });
    localStorage.removeItem(SHIP_COLUMN_WIDTHS_KEY);
    saveDataToStorage();
    renderShipment();
    const modal = bootstrap.Modal.getInstance(document.getElementById('shipColumnSettingsModal'));
    if (modal) modal.hide();
    alert('✅ 列已恢复默认（顺序、可见性、宽度）');
}

// ============================================================
//  导出到 Excel
// ============================================================

function exportShipmentsToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Excel 库未加载，请检查网络或刷新页面后重试。');
        return;
    }

    const filterOrderNo = document.getElementById('shipFilterOrderNo')?.value?.toLowerCase() || '';
    const filterProduct = document.getElementById('shipFilterProduct')?.value?.toLowerCase() || '';
    const filterStatus = document.getElementById('shipFilterStatus')?.value || '';
    const filterQualityStatus = document.getElementById('shipFilterQualityStatus')?.value || '';

    let list = data.orders.filter(o => {
        const status = o.status || '';
        const isShipmentReady = status === '待出货' || status === '已完成-待送货' || status === '已送货完成' || status === '已完成';
        if (!isShipmentReady) return false;
        const orderNo = o.orderNo || o.order_no || '';
        const productName = o.productName || o.product_name || '';
        const shipmentStatus = o.shipmentStatus || '';
        const matchNo = orderNo.toLowerCase().includes(filterOrderNo);
        const matchProd = productName.toLowerCase().includes(filterProduct);
        const matchStatus = filterStatus === '' || status === filterStatus;
        const matchQuality = filterQualityStatus === '' || shipmentStatus === filterQualityStatus;
        return matchNo && matchProd && matchStatus && matchQuality;
    });
    list.sort((a,b) => b.id - a.id);

    if (list.length === 0) {
        alert('当前没有匹配的出货订单可导出');
        return;
    }

    const exportData = list.map(o => {
        const remaining = Math.max(0, o.remainingQty || 0);
        return {
            '状态': o.status || '',
            '客户号': o.customerCode || '',
            '送货编号': o.deliveryNo || '',
            '送货日期': o.deliveryPrintDate || '',
            '订单号': o.orderNo || '',
            '产品编号': o.productCode || '',
            '产品名称': o.productName || '',
            '规格型号': o.spec || '',
            '颜色': o.color || '',
            '压唛': o.stamp || '',
            '订单数量': o.qty || 0,
            '物料-板材': o.materialBoard || '',
            '物料-机壳': o.materialShell || '',
            '下单日期': o.orderDate || '',
            '交货日期': o.deliveryDate || '',
            '板材编号': o.boardCode || '',
            '壳子库存': o.shellStock || '',
            '进度(%)': o.progress || 0,
            '质检状态': o.qualityStatus || '',
            '送货安排': o.shipmentSchedule || '',
            '客户名称': o.partyName || '',
            '联系人': o.partyContact || '',
            '备注': o.remark || '',
            '出货状态': o.shipmentStatus || '',
            '来源': o.source || '',
            '剩余送货数量': remaining
        };
    });

    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        const colWidths = Object.keys(exportData[0] || {}).map(key => ({ wch: Math.max(key.length * 2, 12) }));
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, '出货列表');

        const now = new Date();
        const dateStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
        const firstOrder = list[0];
        const deliveryNo = firstOrder?.deliveryNo || '未命名';
        const fileName = `出货列表_${deliveryNo}_${dateStr}.xlsx`;
        XLSX.writeFile(wb, fileName);
        alert(`✅ 成功导出 ${exportData.length} 条出货数据！`);
    } catch (err) {
        alert('导出失败：' + err.message);
    }
}

// ============================================================
//  暴露全局
// ============================================================

window.initShipment = initShipment;
window.renderShipment = renderShipment;
window.resetShipFilters = resetShipFilters;
window.openShipColumnSettings = openShipColumnSettings;
window.moveShipColumnUp = moveShipColumnUp;
window.moveShipColumnDown = moveShipColumnDown;
window.updateShipColumnVisibility = updateShipColumnVisibility;
window.toggleShipAllColumns = toggleShipAllColumns;
window.resetShipColumns = resetShipColumns;
window.toggleAllShipments = toggleAllShipments;
window.printShipments = printShipments;
window.executePrintPreview = executePrintPreview;
window.goBackToDeliveryQty = goBackToDeliveryQty;
window.getSelectedShipmentIds = getSelectedShipmentIds;
window.exportShipmentsToExcel = exportShipmentsToExcel;
window.openBoxQtyModal = openBoxQtyModal;
window.confirmBoxQtyAndPrint = confirmBoxQtyAndPrint;
window.updateOrderDeliveryViaAPI = updateOrderDeliveryViaAPI;

console.log('✅ shipment.js 已完整加载（服务器存储版本）');