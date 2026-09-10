// ===== 仪表板模块 =====
function initDashboard() {
    renderDashboardStats();
    renderRecentOrders();
    initMonthPicker();
    updateMonthStats();
    renderDashboardCharts();
}

function renderDashboardStats() {
    const statsContainer = document.getElementById('statsCardsContainer');
    if (!statsContainer) return;
    const allStats = [...dashboardCardDefs, ...dashboardCustomCards.filter(c => c.type === 'stat')];
    let statsHtml = '';
    const statsData = getStatsData();
    allStats.forEach(card => {
        if (dashboardCardsVisible[card.id] === false) return;
        const val = statsData[card.field] !== undefined ? statsData[card.field] : 0;
        const colorMap = { blue: 'blue', gold: 'gold', green: 'green', purple: 'purple' };
        const color = colorMap[card.color] || 'blue';
        const deleteBtn = `<button class="card-delete-btn ${dashboardManageMode ? 'visible' : ''}" onclick="deleteDashboardCard('${card.id}')"><i class="bi bi-x-circle"></i></button>`;
        const pageLink = card.page || 'orders';
        statsHtml += `<div class="col-xl-3 col-lg-6 col-md-6 dashboard-card-wrapper"><div class="stat-card d-flex align-items-center justify-content-between" onclick="switchPage('${pageLink}')"><div><div class="label">${card.label}</div><div class="value" id="stat_${card.field}">${val}</div></div><div class="icon-wrap ${color}"><i class="bi ${card.icon}"></i></div>${deleteBtn}</div></div>`;
    });
    statsContainer.innerHTML = statsHtml;

    // 快捷操作
    const actionContainer = document.getElementById('quickActionsContainer');
    if (actionContainer) {
        const allActions = [...defaultActionCards, ...dashboardCustomCards.filter(c => c.type === 'action')];
        let actionHtml = '';
        allActions.forEach(card => {
            if (!defaultActionCards.some(d => d.id === card.id) && dashboardCardsVisible[card.id] === false) return;
            actionHtml += `<span style="display:inline-block;margin:0 6px;"><a href="javascript:void(0)" onclick="${card.action || "alert('功能开发中')"}" style="color:#0a2540;font-weight:500;text-decoration:none;cursor:pointer;"><i class="bi ${card.icon}" style="margin-right:4px;"></i> ${card.label}</a></span>`;
        });
        actionContainer.innerHTML = actionHtml;
    }
    updateStatsValues();
}

function renderRecentOrders() {
    const tbody = document.getElementById('recentOrdersBody');
    if (!tbody) return;
    const recent = data.orders.slice(-5).reverse();
    if (recent.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">暂无订单</td></tr>`; return; }
    tbody.innerHTML = recent.map(o =>
        `<tr><td><span class="badge-status ${statusBadge(o.status)}">${o.status}</span></td><td><strong>${o.orderNo}</strong></td><td>${o.customerCode || ''}</td><td>${o.productName}</td><td>${o.qty}</td><td><button class="btn btn-sm btn-outline-custom" onclick="openOrderDetail(${o.id})">详情</button></td></tr>`
    ).join('');
}

function getStatsData() {
    const allOrders = data.orders;
    return {
        total: allOrders.length,
        production: allOrders.filter(o => o.status === '生产中').length,
        shipment: allOrders.filter(o => o.status === '待出货' || o.status === '已完成-待送货').length,
        reconcile: data.reconciliations.filter(r => r.status === '待对账').length,
        quality: allOrders.filter(o => o.qualityStatus === '质检中' || o.qualityStatus === '未质检').length,
        // 👇 新增：未交订单（状态不是"已完成"的订单）
        unpaidTotal: allOrders.filter(o => o.status !== '已完成' && o.status !== '已出货').length,
        // 👇 新增：已交订单（状态是"已完成"或"已出货"的订单）
        paidTotal: allOrders.filter(o => o.status === '已完成' || o.status === '已出货').length
    };
}

function updateStatsValues() {
    const stats = getStatsData();
    document.querySelectorAll('[id^="stat_"]').forEach(el => {
        const key = el.id.replace('stat_', '');
        if (stats[key] !== undefined) el.textContent = stats[key];
    });
}

function toggleDashboardManage() { dashboardManageMode = !dashboardManageMode; renderDashboardStats(); }

function deleteDashboardCard(id) {
    if (defaultActionCards.some(c => c.id === id)) { alert('默认操作卡片不能删除'); return; }
    if (!confirm('确定要删除此卡片吗？')) return;
    dashboardCardsVisible[id] = false;
    saveDataToStorage();
    renderDashboardStats();
}

function openRecoverDashboardModal() {
    const container = document.getElementById('recoverDashboardList');
    let html = '';
    const allIds = [...dashboardCardDefs.map(c => c.id), ...defaultActionCards.map(c => c.id), ...dashboardCustomCards.map(c => c.id)];
    let hasDeleted = false;
    allIds.forEach(id => {
        if (dashboardCardsVisible[id] === false) {
            const label = dashboardCardDefs.find(c => c.id === id)?.label || defaultActionCards.find(c => c.id === id)?.label || dashboardCustomCards.find(c => c.id === id)?.label || id;
            html += `<div class="recover-item"><input type="checkbox" class="form-check-input" id="recover_card_${id}" value="${id}" /><label for="recover_card_${id}">${label}</label></div>`;
            hasDeleted = true;
        }
    });
    if (!hasDeleted) html = '<p class="text-muted text-center">没有已删除的卡片</p>';
    container.innerHTML = html;
    new bootstrap.Modal(document.getElementById('recoverDashboardModal')).show();
}

function recoverDashboardCards() {
    const checks = document.querySelectorAll('#recoverDashboardList input:checked');
    if (checks.length === 0) { alert('请选择要恢复的卡片'); return; }
    checks.forEach(cb => { dashboardCardsVisible[cb.value] = true; });
    saveDataToStorage();
    closeModal('recoverDashboardModal');
    renderDashboardStats();
    alert('✅ 已恢复选中卡片');
}

function openAddDashboardCardModal() {
    document.getElementById('newCardName').value = '';
    document.getElementById('newCardActionLabel').value = '';
    document.getElementById('statCardConfig').style.display = 'block';
    document.getElementById('actionCardConfig').style.display = 'none';
    new bootstrap.Modal(document.getElementById('addDashboardCardModal')).show();
}
document.getElementById('newCardType')?.addEventListener('change', function() {
    if (this.value === 'stat') { document.getElementById('statCardConfig').style.display = 'block'; document.getElementById('actionCardConfig').style.display = 'none'; }
    else { document.getElementById('statCardConfig').style.display = 'none'; document.getElementById('actionCardConfig').style.display = 'block'; }
});

function addDashboardCard() {
    const name = document.getElementById('newCardName').value.trim();
    if (!name) { alert('请输入卡片名称'); return; }
    const type = document.getElementById('newCardType').value;
    const id = 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2,4);
    let newCard = { id, label: name, type, isCustom: true };
    if (type === 'stat') {
        const field = document.getElementById('newCardStatField').value;
        const iconMap = { total: 'bi-file-earmark-text', production: 'bi-gear', shipment: 'bi-box-seam', reconcile: 'bi-cash', quality: 'bi-check2-circle' };
        const colorMap = { total: 'blue', production: 'gold', shipment: 'green', reconcile: 'purple', quality: 'blue' };
        newCard.field = field;
        newCard.icon = iconMap[field] || 'bi-file-earmark-text';
        newCard.color = colorMap[field] || 'blue';
        newCard.page = 'orders';
    } else {
        const label = document.getElementById('newCardActionLabel').value.trim() || name;
        newCard.icon = 'bi-plus-circle';
        newCard.action = "alert('" + name + "功能开发中')";
        newCard.label = label;
    }
    dashboardCustomCards.push(newCard);
    dashboardCardsVisible[id] = true;
    saveDataToStorage();
    closeModal('addDashboardCardModal');
    renderDashboardStats();
    alert('✅ 已添加自定义卡片');
}

function initMonthPicker() {
    const picker = document.getElementById('monthPicker');
    if (!picker) return;
    const now = new Date();
    picker.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    picker.addEventListener('change', updateMonthStats);
}

function updateMonthStats() {
    const monthPicker = document.getElementById('monthPicker');
    if (!monthPicker) return;
    const selectedMonth = monthPicker.value;
    if (!selectedMonth) return;
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthOrders = data.orders.filter(o => {
        if (!o.orderDate) return false;
        const parts = o.orderDate.split('-');
        if (parts.length < 2) return false;
        const orderYear = parseInt(parts[0]);
        const orderMonth = parseInt(parts[1]);
        return orderYear === year && orderMonth === month;
    });

    // 当月总订单条数
    const total = monthOrders.length;

    // 当月所有订单的数量总和
    const totalQty = monthOrders.reduce((sum, o) => sum + (parseInt(o.qty) || 0), 0);

    // 【修改】未交订单的数量总和（状态不是"已完成"也不是"已出货"的订单）
    const unpaidQty = monthOrders
        .filter(o => o.status !== '已完成' && o.status !== '已出货')
        .reduce((sum, o) => sum + (parseInt(o.qty) || 0), 0);

    // 【修改】已交订单的数量总和（状态是"已完成"或"已出货"的订单）
    const paidQty = monthOrders
        .filter(o => o.status === '已完成' || o.status === '已出货')
        .reduce((sum, o) => sum + (parseInt(o.qty) || 0), 0);

    // 更新DOM显示
    document.getElementById('monthTotal').textContent = total;
    document.getElementById('monthTotalQty').textContent = totalQty;
    document.getElementById('monthUnpaid').textContent = unpaidQty;  // 现在显示的是数量总和
    document.getElementById('monthPaid').textContent = paidQty;      // 现在显示的是数量总和
}

function renderDashboardCharts() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    const context = ctx.getContext('2d');
    if (trendChartInstance) { trendChartInstance.destroy(); }
    const days = ['08/15','08/16','08/17','08/18','08/19','08/20','08/21'];
    const vals = [3,5,2,7,4,6,5];
    trendChartInstance = new Chart(context, {
        type: 'line',
        data: { labels: days, datasets: [{ label: '订单数', data: vals, borderColor: '#0066cc', backgroundColor: 'rgba(0,102,204,0.08)', tension: 0.3, fill: true, pointBackgroundColor: '#0066cc', pointRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } }, x: { grid: { display: false } } } }
    });
}

window.initDashboard = initDashboard;
window.toggleDashboardManage = toggleDashboardManage;
window.deleteDashboardCard = deleteDashboardCard;
window.openRecoverDashboardModal = openRecoverDashboardModal;
window.recoverDashboardCards = recoverDashboardCards;
window.openAddDashboardCardModal = openAddDashboardCardModal;
window.addDashboardCard = addDashboardCard;
window.updateMonthStats = updateMonthStats;