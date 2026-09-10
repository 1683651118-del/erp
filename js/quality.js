function initQuality() {
    const tbody = document.getElementById('qualityBody');
    if (!tbody) return;
    if (data.qualities.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">暂无质检记录</td></tr>`;
        return;
    }
    tbody.innerHTML = data.qualities.map(q =>
        `<tr><td>QC-${q.id}</td><td>${q.productionId||''}</td><td>${q.checkedQty||0}</td><td>${q.qualifiedQty||0}</td><td>${q.defectRate||0}%</td><td><span class="badge-status ${statusBadge(q.result)}">${q.result}</span></td><td><button class="btn btn-sm btn-outline-custom">查看</button></td></tr>`
    ).join('');
}
window.initQuality = initQuality;