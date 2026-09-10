function initReconciliation() {
    const tbody = document.getElementById('reconcileBody');
    if (!tbody) return;
    if (data.reconciliations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">暂无对账记录</td></tr>`;
        return;
    }
    tbody.innerHTML = data.reconciliations.map(r =>
        `<tr><td>RC-${r.id}</td><td>${r.customerCode||''}</td><td>${r.period||''}</td><td>¥${(r.total||0).toFixed(2)}</td><td>¥${(r.paid||0).toFixed(2)}</td><td>¥${(r.balance||0).toFixed(2)}</td><td><span class="badge-status ${statusBadge(r.status)}">${r.status}</span></td><td><button class="btn btn-sm btn-outline-custom">查看</button></td></tr>`
    ).join('');
}
window.initReconciliation = initReconciliation;