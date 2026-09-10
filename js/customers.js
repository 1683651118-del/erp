function initCustomers() {
    const tbody = document.getElementById('customerBody');
    if (!tbody) return;
    tbody.innerHTML = data.customers.map(c =>
        `<tr><td>CUST-${c.id}</td><td>${c.name}</td><td>${c.contact||'-'}</td><td>${c.phone||'-'}</td><td>${c.email||'-'}</td><td><button class="btn btn-sm btn-outline-custom">编辑</button></td></tr>`
    ).join('');
}
window.initCustomers = initCustomers;