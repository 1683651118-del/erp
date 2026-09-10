// ============================================================
//  产品管理模块（完整版 · 修复版）
//  包含：产品列表、磁石明细、物料明细、图片上传、文件上传
//  支持：新版11列模板 + 旧版14列模板 自动识别
//  修复：客户号、板材、壳子显示空白问题
// ============================================================

// ★★★ 数据迁移：为物料明细增加类型字段（第5位） ★★★
function migrateProductData() {
    if (!data.products) return;
    var migrated = false;
    data.products.forEach(function(product) {
        if (product.materialDetail && Array.isArray(product.materialDetail)) {
            product.materialDetail = product.materialDetail.map(function(row) {
                if (!Array.isArray(row)) row = [];
                while (row.length < 4) row.push('');
                if (row.length === 4) {
                    var name = row[0] || '';
                    var type = getMaterialType(name);
                    row.push(type);
                    migrated = true;
                } else if (row.length >= 5 && !row[4]) {
                    var name2 = row[0] || '';
                    row[4] = getMaterialType(name2);
                    migrated = true;
                }
                return row;
            });
        }
        // 确保 customerCode 有值
        if (product.name && !product.customerCode) {
            product.customerCode = extractCustomerCode(product.name);
            migrated = true;
        }
    });
    if (migrated) {
        saveDataToStorage();
        console.log('✅ 产品数据已迁移（客户号 + 类型字段）');
    }
}

// ★★★ 确保 data.products 初始化 ★★★
function ensureProductsData() {
    if (!data.products) data.products = [];
    if (!data._nextId) data._nextId = {};
    if (!data._nextId.product) data._nextId.product = 1;
}

function normalizeProductRecord(product) {
    if (!product || typeof product !== 'object') return product;
    const normalized = { ...product };
    normalized.id = normalized.id ?? normalized.ID ?? normalized.productId ?? normalized.product_id;
    normalized.code = normalized.code || normalized.productCode || normalized.product_code || '';
    normalized.name = normalized.name || normalized.productName || normalized.product_name || '';
    normalized.customerCode = normalized.customerCode || normalized.customer_code || extractCustomerCode(normalized.name);
    normalized.stock = Number(normalized.stock ?? normalized.inventory ?? 0) || 0;
    normalized.status = normalized.status || '在库';
    normalized.remark = normalized.remark || '';
    return normalized;
}

async function loadProductsFromApi() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) {
            throw new Error('请求失败: ' + response.status);
        }
        const rows = await response.json();
        const products = Array.isArray(rows) ? rows.map(normalizeProductRecord) : [];
        data.products = products;
        return products;
    } catch (error) {
        console.error('加载产品失败:', error);
        data.products = [];
        return [];
    }
}

// ★★★ 提取客户编号（增强版）★★★
function extractCustomerCode(name) {
    if (!name) return '';
    // 匹配 4位数字- 或 4位数字_ 或 A开头的4位编码
    var match = name.match(/^([A-Z0-9]{3,5})[-_]/);
    if (match) return match[1];
    // 匹配 1009 这样的4位数字
    match = name.match(/^(\d{4})/);
    if (match) return match[1];
    // 匹配 A037 这样的编码
    match = name.match(/^([A-Z]\d{3})/);
    if (match) return match[1];
    return '';
}

// 判断是否为款式名称行
function isProductName(cellText) {
    if (!cellText) return false;
    return /^(1009|5409|2500|8300|7001|A037|2045|2022|2800|5209|1011|1008|5400|2013|1001|2008|5400|5409)/i.test(cellText.trim()) &&
           /[-_]/.test(cellText.trim());
}

// 生成产品编码（用于列表）
function generateProductCode(name) {
    return name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');
}

// ★★★ 统一磁石行解析 ★★★
function parseMagnetRow(row) {
    if (!Array.isArray(row) || row.length === 0) {
        return { magnetic: '', size: '', qty: '', remark: '' };
    }
    var cells = row.map(function(c) {
        if (c === null || c === undefined) return '';
        return String(c).trim();
    });
    var filtered = cells.filter(function(c) { return c !== ''; });
    if (filtered.length === 0) {
        return { magnetic: '', size: '', qty: '', remark: '' };
    }
    var magnetic = '';
    var size = '';
    var qty = '';
    var remark = '';
    if (filtered.length >= 4) {
        magnetic = filtered[0] || '';
        size = filtered[1] || '';
        qty = filtered[2] || '';
        remark = filtered[3] || '';
        if (!size && filtered[1]) {
            var sizeMatch = filtered[1].match(/(\d+[\*\-]\d+[\*\-]\d+)/);
            if (sizeMatch) {
                size = sizeMatch[1];
                var remaining = filtered[1].replace(size, '').trim();
                if (remaining && !/^\d+\s*个?$/.test(remaining)) {
                    remark = remaining;
                }
            }
        }
        if (remark && /^\d+\s*个?$/.test(remark)) {
            remark = '';
        }
        return { magnetic: magnetic, size: size, qty: qty, remark: remark };
    }
    if (filtered.length >= 3) {
        magnetic = filtered[0] || '';
        var desc = filtered[1] || '';
        qty = filtered[2] || '';
        var sizeMatch2 = desc.match(/(\d+[\*\-]\d+[\*\-]\d+)/);
        if (sizeMatch2) {
            size = sizeMatch2[1];
            var remainder = desc.replace(size, '').trim();
            remainder = remainder.replace(/^--?\s*/, '').trim();
            if (remainder && /^\d+\s*个?$/.test(remainder)) {
                remainder = '';
            }
            if (remainder) {
                var extraQtyMatch = remainder.match(/--?\s*\d+\s*个?$/);
                if (extraQtyMatch) {
                    remainder = remainder.replace(extraQtyMatch[0], '').trim();
                }
            }
            if (remainder && /^\d+$/.test(remainder)) {
                remainder = '';
            }
            remark = remainder;
        } else {
            if (!/^\d+\s*个?$/.test(desc)) {
                remark = desc;
            }
        }
        if (!magnetic) {
            var magMatch = desc.match(/N(42|52|40|38)/i);
            if (magMatch) magnetic = 'N' + magMatch[1];
        }
        return { magnetic: magnetic, size: size, qty: qty, remark: remark };
    }
    if (filtered.length === 2) {
        var desc2 = filtered.join(' ');
        var sizeMatch3 = desc2.match(/(\d+[\*\-]\d+[\*\-]\d+)/);
        if (sizeMatch3) {
            size = sizeMatch3[1];
            var remainder2 = desc2.replace(size, '').trim();
            remainder2 = remainder2.replace(/^--?\s*/, '').trim();
            if (remainder2 && !/^\d+\s*个?$/.test(remainder2)) {
                remark = remainder2;
            }
        } else {
            remark = desc2;
        }
        var magMatch2 = desc2.match(/N(42|52|40|38)/i);
        if (magMatch2) magnetic = 'N' + magMatch2[1];
        return { magnetic: magnetic, size: size, qty: filtered[1] || '1', remark: remark };
    }
    if (filtered.length === 1) {
        var desc3 = filtered[0];
        var sizeMatch4 = desc3.match(/(\d+[\*\-]\d+[\*\-]\d+)/);
        if (sizeMatch4) {
            size = sizeMatch4[1];
            var remainder3 = desc3.replace(size, '').trim();
            remainder3 = remainder3.replace(/^--?\s*/, '').trim();
            if (remainder3 && !/^\d+\s*个?$/.test(remainder3)) {
                remark = remainder3;
            }
        }
        var magMatch3 = desc3.match(/N(42|52|40|38)/i);
        if (magMatch3) magnetic = 'N' + magMatch3[1];
        return { magnetic: magnetic, size: size, qty: '1', remark: remark };
    }
    return { magnetic: filtered[0] || '', size: '', qty: '', remark: '' };
}

// ★★★ 从产品 materialDetail 提取板材汇总（增强版）★★★
function extractBoardSummary(product) {
    if (!product.materialDetail || !Array.isArray(product.materialDetail) || product.materialDetail.length === 0) {
        return '-';
    }
    var boardItems = [];
    product.materialDetail.forEach(function(row) {
        if (row && row.length >= 4) {
            var name = (row[0] || '').trim();
            var color = (row[1] || '').trim();
            var qty = (row[2] || '').trim();
            var remark = (row[3] || '').trim();
            // 类型可能在第4位，也可能从名称判断
            var type = (row[4] || '').trim();
            var lowerName = name.toLowerCase();
            // 判断是否为板材：名称包含"板"字，或类型为"板材"
            if (lowerName.indexOf('板') !== -1 || lowerName.indexOf('板材') !== -1 || type === '板材') {
                var parts = [];
                if (name) parts.push(name);
                if (color) parts.push('(' + color + ')');
                if (qty) parts.push(qty + '个');
                if (remark) parts.push('【' + remark + '】');
                var text = parts.join(' ');
                if (text.trim()) boardItems.push(text);
            }
        }
    });
    if (boardItems.length > 0) {
        return boardItems.join('；');
    }
    return '-';
}

// ★★★ 从产品 materialDetail 提取壳子汇总（增强版）★★★
function extractShellSummary(product) {
    if (!product.materialDetail || !Array.isArray(product.materialDetail) || product.materialDetail.length === 0) {
        return '-';
    }
    var shellItems = [];
    product.materialDetail.forEach(function(row) {
        if (row && row.length >= 4) {
            var name = (row[0] || '').trim();
            var color = (row[1] || '').trim();
            var qty = (row[2] || '').trim();
            var remark = (row[3] || '').trim();
            var type = (row[4] || '').trim();
            var lowerName = name.toLowerCase();
            // 判断是否为壳子：名称包含"壳"或"皮套"，或类型为"壳子"
            if (lowerName.indexOf('壳') !== -1 || lowerName.indexOf('壳子') !== -1 || 
                lowerName.indexOf('皮套') !== -1 || type === '壳子') {
                var parts = [];
                if (name) parts.push(name);
                if (color) parts.push('(' + color + ')');
                if (qty) parts.push(qty + '个');
                if (remark) parts.push('【' + remark + '】');
                var text = parts.join(' ');
                if (text.trim()) shellItems.push(text);
            }
        }
    });
    if (shellItems.length > 0) {
        return shellItems.join('；');
    }
    return '-';
}

// ★★★ 从Excel行中提取四列数据 ★★★
function extractFourColumns(row) {
    if (!Array.isArray(row)) return ['', '', '', ''];
    var cells = row.map(function(c) { return (c && typeof c === 'string') ? c.trim() : (c || ''); });
    var filtered = cells.filter(function(c) { return c !== ''; });
    if (filtered.length === 0) return ['', '', '', ''];
    if (filtered.length >= 4) {
        return [filtered[0] || '', filtered[1] || '', filtered[2] || '', filtered[3] || ''];
    }
    if (filtered.length === 3) {
        return [filtered[0] || '', filtered[1] || '', filtered[2] || '', ''];
    }
    if (filtered.length === 2) {
        return [filtered[0] || '', filtered[1] || '', '', ''];
    }
    return [filtered[0] || '', '', '', ''];
}

// ★★★ 根据物料名称判断类型 ★★★
function getMaterialType(name) {
    if (!name) return '其他';
    var lower = name.toLowerCase();
    if (lower.indexOf('板') !== -1 || lower.indexOf('板材') !== -1) {
        return '板材';
    } else if (lower.indexOf('壳') !== -1 || lower.indexOf('壳子') !== -1 || lower.indexOf('皮套') !== -1) {
        return '壳子';
    } else {
        return '其他';
    }
}

// ★★★ 当物料名称输入变化时，自动填充类型 ★★★
function updateMaterialType(input) {
    var row = input.closest('tr');
    if (!row) return;
    var nameVal = input.value.trim();
    var typeLabel = getMaterialType(nameVal);
    var typeInput = row.querySelector('.material-type');
    if (typeInput) {
        var currentType = typeInput.value.trim();
        if (!currentType || currentType === getMaterialType(currentType) || currentType === typeLabel) {
            typeInput.value = typeLabel;
        }
    }
}

// ★★★ 从产品库读取关联产品（供采购管理使用）★★★
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

// ★★★ 解析单个 Sheet，提取产品款式（兼容旧格式）★★★
function parseProductSheet(sheet) {
    try {
        var range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        var rows = [];
        for (var r = range.s.r; r <= range.e.r; r++) {
            var row = [];
            for (var c = range.s.c; c <= range.e.c; c++) {
                var addr = XLSX.utils.encode_cell({ r: r, c: c });
                var cell = sheet[addr];
                row.push(cell && cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : '');
            }
            rows.push(row);
        }
        if (rows.length === 0) return [];
        var products = [];
        var totalRows = rows.length;
        var totalCols = rows[0] ? rows[0].length : 0;
        if (totalCols === 0) return [];

        for (var ri = 0; ri < totalRows; ri++) {
            for (var ci = 0; ci < totalCols; ci++) {
                var cellText = rows[ri]?.[ci] || '';
                if (isProductName(cellText)) {
                    var product = {
                        customerCode: extractCustomerCode(cellText),
                        productCode: generateProductCode(cellText),
                        productName: cellText,
                        magnetRows: [],
                        boardRows: [],
                        shellRows: []
                    };

                    var dataRows = [];
                    var endRow = ri + 1;
                    var consecutiveEmpty = 0;
                    var colStart = Math.max(0, ci);
                    var colEnd = Math.min(ci + 5, totalCols - 1);
                    while (endRow < totalRows) {
                        var rowData = rows[endRow] || [];
                        var hasData = false;
                        for (var cc = colStart; cc <= colEnd; cc++) {
                            if (rowData[cc] && rowData[cc].trim() !== '') {
                                hasData = true;
                                break;
                            }
                        }
                        if (!hasData) {
                            consecutiveEmpty++;
                            if (consecutiveEmpty >= 3) break;
                        } else {
                            consecutiveEmpty = 0;
                            var magnetRow = [];
                            for (var mc = colStart; mc <= colEnd; mc++) {
                                magnetRow.push(rowData[mc] || '');
                            }
                            if (Array.isArray(magnetRow) && magnetRow.some(function(cell) { return cell.trim() !== ''; })) {
                                var potentialName = magnetRow[0];
                                if (isProductName(potentialName)) break;
                                dataRows.push(magnetRow);
                            }
                        }
                        endRow++;
                    }

                    if (dataRows.length > 0) {
                        var firstRow = dataRows[0] || [];
                        var firstCell = firstRow[0] || '';
                        if (/个数|数量|规格|材质|磁性/i.test(firstCell) && !/^N(42|40|52|38)$/i.test(firstCell)) {
                            dataRows.shift();
                        }
                    }

                    dataRows = dataRows.filter(function(row) {
                        return Array.isArray(row) && row.some(function(cell) { return cell.trim() !== ''; });
                    });

                    dataRows.forEach(function(row) {
                        var cells = row.map(function(c) { return c ? String(c).trim() : ''; });
                        var first = cells[0] || '';
                        if (/^N(42|52|40|38)/i.test(first)) {
                            product.magnetRows.push(extractFourColumns(row));
                        } else {
                            var lowerFirst = first.toLowerCase();
                            if (lowerFirst.indexOf('板') !== -1 || lowerFirst.indexOf('板材') !== -1) {
                                product.boardRows.push(extractFourColumns(row));
                            } else if (lowerFirst.indexOf('壳') !== -1 || lowerFirst.indexOf('壳子') !== -1 || lowerFirst.indexOf('皮套') !== -1) {
                                product.shellRows.push(extractFourColumns(row));
                            } else {
                                product.boardRows.push(extractFourColumns(row));
                            }
                        }
                    });

                    if (!products.some(function(p) { return p.productName === product.productName; })) {
                        products.push(product);
                    }
                }
            }
        }
        return products;
    } catch (e) {
        console.warn('Sheet 解析出错:', e);
        return [];
    }
}

// ★★★ 导入Excel（兼容旧格式） ★★★
// ============================================================
//  从 Excel 导入产品（完整版 · 改为 API 存储）
// ============================================================
async function importProductsFromExcel(event) {
    var file = event.target.files[0];
    if (!file) return;
    ensureProductsData();

    var reader = new FileReader();
    reader.onload = async function(ev) {
        try {
            var dataBytes = new Uint8Array(ev.target.result);
            var workbook = XLSX.read(dataBytes, { type: 'array' });
            var allProducts = [];

            workbook.SheetNames.forEach(function(sheetName) {
                var sheet = workbook.Sheets[sheetName];
                var parsed = parseProductSheet(sheet);
                if (parsed && parsed.length) {
                    console.log('📄 Sheet "' + sheetName + '" 解析到 ' + parsed.length + ' 个款式');
                    allProducts.push.apply(allProducts, parsed);
                }
            });

            if (allProducts.length === 0) {
                alert('未解析到任何产品款式，请检查 Excel 格式。');
                return;
            }

            var existingNames = new Set(data.products.map(function(p) { return p.productName; }));
            var addedCount = 0, skipCount = 0;

            // ★★★ 循环调用 API 创建产品 ★★★
            for (var idx = 0; idx < allProducts.length; idx++) {
                var p = allProducts[idx];
                if (existingNames.has(p.productName)) {
                    skipCount++;
                    continue;
                }

                // 构建物料明细（板材 + 壳子）
                var materialDetail = [];
                if (p.boardRows && p.boardRows.length > 0) {
                    p.boardRows.forEach(function(row) {
                        if (row.some(function(cell) { return cell && cell.trim() !== ''; })) {
                            var name = row[0] || '';
                            var type = getMaterialType(name);
                            row.push(type);
                            materialDetail.push(row);
                        }
                    });
                }
                if (p.shellRows && p.shellRows.length > 0) {
                    p.shellRows.forEach(function(row) {
                        if (row.some(function(cell) { return cell && cell.trim() !== ''; })) {
                            var name = row[0] || '';
                            var type = getMaterialType(name);
                            row.push(type);
                            materialDetail.push(row);
                        }
                    });
                }

                var magnetRows = p.magnetRows || [];
                var customerCode = p.customerCode || extractCustomerCode(p.productName);

                // ★★★ 构建 extra 对象 ★★★
                var extraData = {
                    customerCode: customerCode,
                    magnetDetail: JSON.stringify(magnetRows),
                    materialDetail: materialDetail,
                    images: [],
                    files: [],
                    desc: magnetRows.length > 0 ? magnetRows.length + ' 种磁石规格' : '',
                    unit: '个',
                    price: 0
                };

                var productData = {
                    code: p.productCode,
                    name: p.productName,
                    spec: '',
                    customer_code: customerCode,
                    stock: 0,
                    status: '在库',
                    remark: '',
                    extra: JSON.stringify(extraData)
                };

                try {
                    var response = await fetch('/api/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(productData)
                    });

                    if (!response.ok) {
                        var errText = await response.text();
                        console.warn('导入产品失败:', p.productName, errText);
                        skipCount++;
                        continue;
                    }

                    var created = await response.json();
                    var parsed = typeof window.parseProductExtraFields === 'function'
                        ? window.parseProductExtraFields(created)
                        : created;

                    data.products.push(parsed);
                    addedCount++;
                    existingNames.add(p.productName); // 避免重复导入同一批次
                } catch (err) {
                    console.warn('导入产品异常:', p.productName, err);
                    skipCount++;
                }
            }

            saveDataToStorage();
            initProducts();
            document.getElementById('productExcelInput').value = '';
            alert('✅ 导入完成！\n新增 ' + addedCount + ' 个产品，跳过 ' + skipCount + ' 个（已存在或失败）。');
        } catch (err) {
            console.error('导入失败:', err);
            alert('导入失败：' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// ★★★ 填充客户筛选下拉框 ★★★
function populateCustomerFilter() {
    var select = document.getElementById('productCustomerFilter');
    if (!select) return;
    var currentValue = select.value;
    var codes = new Set();
    data.products.forEach(function(p) { if (p.customerCode) codes.add(p.customerCode); });
    var sortedCodes = Array.from(codes).sort();
    var html = '<option value="">全部客户</option>';
    sortedCodes.forEach(function(code) {
        html += '<option value="' + code + '">' + code + '</option>';
    });
    select.innerHTML = html;
    if (currentValue) select.value = currentValue;
    renderQuickFilterButtons();
}

// ★★★ 渲染客户号快速切换按钮 ★★★
function renderQuickFilterButtons() {
    var container = document.getElementById('customerQuickFilterItems');
    var countEl = document.getElementById('customerFilterCount');
    if (!container) return;
    var codes = new Set();
    data.products.forEach(function(p) { if (p.customerCode) codes.add(p.customerCode); });
    var sortedCodes = Array.from(codes).sort();
    var select = document.getElementById('productCustomerFilter');
    var currentFilter = select ? select.value : '';
    var html = '';
    sortedCodes.forEach(function(code) {
        var count = data.products.filter(function(p) { return p.customerCode === code; }).length;
        var active = currentFilter === code ? 'active' : '';
        html += '<button class="btn btn-sm btn-outline-custom customer-filter-btn ' + active + '" data-code="' + code + '" onclick="setCustomerFilter(\'' + code + '\')" style="font-size:12px;padding:2px 14px;border-radius:14px;">';
        html += code + ' <span style="font-size:10px;opacity:0.6;font-weight:400;">(' + count + ')</span>';
        html += '</button>';
    });
    container.innerHTML = html;
    var allBtn = document.querySelector('.customer-filter-btn[data-code=""]');
    if (allBtn) {
        allBtn.classList.toggle('active', currentFilter === '');
    }
    if (countEl) {
        var total = data.products.length;
        var searchKeyword = document.getElementById('productSearchInput')?.value?.toLowerCase() || '';
        var filteredCount = total;
        if (searchKeyword) {
            if (currentFilter) {
                filteredCount = data.products.filter(function(p) {
                    return p.customerCode === currentFilter && (
                        (p.code || '').toLowerCase().includes(searchKeyword) ||
                        (p.name || '').toLowerCase().includes(searchKeyword) ||
                        (p.customerCode || '').toLowerCase().includes(searchKeyword)
                    );
                }).length;
            } else {
                filteredCount = data.products.filter(function(p) {
                    return (p.code || '').toLowerCase().includes(searchKeyword) ||
                           (p.name || '').toLowerCase().includes(searchKeyword) ||
                           (p.customerCode || '').toLowerCase().includes(searchKeyword);
                }).length;
            }
        } else if (currentFilter) {
            filteredCount = data.products.filter(function(p) { return p.customerCode === currentFilter; }).length;
        }
        countEl.textContent = '共 ' + filteredCount + ' 个产品 (总计 ' + total + ')';
    }
}

// ★★★ 设置客户筛选 ★★★
function setCustomerFilter(code) {
    var select = document.getElementById('productCustomerFilter');
    if (select) {
        select.value = code;
    }
    renderQuickFilterButtons();
    initProducts();
}

// ===== ★★★ 渲染产品列表 ★★★ =====
async function initProducts() {
    migrateProductData();
    ensureProductsData();
    // ★★★ 如果 data.products 为空，才从 API 加载（但 app.js 已加载，所以直接使用现有数据） ★★★
    if (!data.products || data.products.length === 0) {
        try {
            const res = await fetch('/api/products');
            if (res.ok) {
                const products = await res.json();
                data.products = products.map(function(p) {
                    return typeof window.parseProductExtraFields === 'function' 
                        ? window.parseProductExtraFields(p) 
                        : p;
                });
            }
        } catch (e) {
            console.warn('加载产品数据失败，使用已有数据', e);
        }
    }
    populateCustomerFilter();
    renderQuickFilterButtons();
    var filterValue = document.getElementById('productCustomerFilter')?.value || '';
    var searchKeyword = document.getElementById('productSearchInput')?.value?.toLowerCase() || '';
    var tbody = document.getElementById('productBody');
    if (!tbody) return;

    var filteredProducts = data.products;
    if (filterValue) {
        filteredProducts = filteredProducts.filter(function(p) { return p.customerCode === filterValue; });
    }
    if (searchKeyword) {
        filteredProducts = filteredProducts.filter(function(p) {
            return (p.code || '').toLowerCase().includes(searchKeyword) ||
                   (p.name || '').toLowerCase().includes(searchKeyword) ||
                   (p.customerCode || '').toLowerCase().includes(searchKeyword);
        });
    }

    if (filteredProducts.length === 0) {
        var msg = '暂无产品';
        if (searchKeyword) msg = '没有匹配 "' + searchKeyword + '" 的产品';
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">' + msg + '</td></tr>';
        return;
    }

    tbody.innerHTML = filteredProducts.map(function(p) {
        var magnetSummary = '-';
        try {
            var arr = JSON.parse(p.magnetDetail || '[]');
            if (Array.isArray(arr) && arr.length > 0) {
                var firstTwo = arr.slice(0, 2).map(function(row) {
                    var parsed = parseMagnetRow(row);
                    if (parsed) {
                        var parts = [];
                        if (parsed.size) parts.push(parsed.size);
                        if (parsed.remark && parsed.remark !== '') parts.push('(' + parsed.remark + ')');
                        return parts.join('') || parsed.magnetic || '磁石';
                    }
                    return '磁石';
                });
                magnetSummary = firstTwo.join('；') + (arr.length > 2 ? ' 等' + arr.length + '种' : '');
                if (!magnetSummary || magnetSummary === '；') magnetSummary = '有磁石数据';
            }
        } catch (e) { /* ignore */ }

        var boardSummary = extractBoardSummary(p);
        var shellSummary = extractShellSummary(p);

        // 调试：如果板材或壳子为空但 materialDetail 有数据，打印日志
        if (boardSummary === '-' || shellSummary === '-') {
            var hasMaterial = p.materialDetail && p.materialDetail.length > 0;
            if (hasMaterial) {
                console.log('🔍 产品 ' + p.name + ' materialDetail:', JSON.stringify(p.materialDetail));
            }
        }

        return '<tr>' +
            '<td><code style="font-size:12px;">' + (p.code || '-') + '</code></td>' +
            '<td><strong>' + (p.name || '-') + '</strong></td>' +
            '<td><span class="badge bg-soft-secondary">' + (p.customerCode || '-') + '</span></td>' +
            '<td style="font-size:12px;max-width:200px;word-break:break-all;">' + magnetSummary + '</td>' +
            '<td style="font-size:12px;max-width:150px;word-break:break-all;">' + boardSummary + '</td>' +
            '<td style="font-size:12px;max-width:150px;word-break:break-all;">' + shellSummary + '</td>' +
            '<td>' + (p.unit || '个') + '</td>' +
            '<td>' +
            '<button class="btn btn-sm btn-outline-custom" onclick="viewProductDetail(' + p.id + ')"><i class="bi bi-eye"></i></button>' +
            '<button class="btn btn-sm btn-outline-custom text-danger" onclick="deleteProduct(' + p.id + ')"><i class="bi bi-trash3"></i></button>' +
            '</td>' +
            '</tr>';
    }).join('');
}

// ★★★ 导出模板（新版11列） ★★★
function exportProductTemplate() {
    try {
        var headers = [
            '款式名称', '客户号',
            '磁石磁性', '磁石尺寸规格', '磁石数量', '磁石备注',
            '物料类型', '物料名称', '物料颜色', '物料个数/码', '物料备注'
        ];

        var sampleData = [
            ['1009-06-2024 Pro11寸', '1009', 'N42', '25*1*5', '8', '边磁', '板材', '1009-06-2024 板材', '黑色', '100', ''],
            ['1009-06-2024 Pro11寸', '1009', 'N42', '12*6*1', '4', '', '壳子', '1009-06-2024 壳子', '深灰', '100', ''],
            ['1009-06-2024 Pro11寸', '1009', '', '', '', '', '其他', '辅料', '', '50', ''],
            ['', '', '', '', '', '', '', '', '', '', ''],
            ['【填写说明】', '', '', '', '', '', '', '', '', '', ''],
            ['1. 款式名称：产品款式的完整名称，相同款式名称会自动合并', '', '', '', '', '', '', '', '', '', ''],
            ['2. 客户号：款式名称前4位数字（如 1009），用于分类筛选', '', '', '', '', '', '', '', '', '', ''],
            ['3. 磁石部分：填写"磁石磁性"列（如 N42），每行一个规格', '', '', '', '', '', '', '', '', '', ''],
            ['4. 物料部分：填写"物料类型"列（板材/壳子/其他），每行一个物料', '', '', '', '', '', '', '', '', '', ''],
            ['5. 同一行可同时填写磁石和物料数据，系统会分别导入', '', '', '', '', '', '', '', '', '', ''],
            ['6. 导入时会根据"款式名称"去重，已存在的款式将被跳过', '', '', '', '', '', '', '', '', '', ''],
            ['7. 产品编码由系统自动生成，无需手动填写', '', '', '', '', '', '', '', '', '', '']
        ];

        var wsData = [headers].concat(sampleData);
        var ws = XLSX.utils.aoa_to_sheet(wsData);

        ws['!cols'] = [
            { wch: 30 }, { wch: 12 },
            { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 20 },
            { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 20 }
        ];

        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '产品导入模板');

        var fileName = '产品导入模板_' + new Date().toISOString().slice(0, 10) + '.xlsx';
        XLSX.writeFile(wb, fileName);

        alert('✅ 模板已下载！\n\n• 款式名称和客户号必填\n• 磁石部分：填写"磁石磁性"列\n• 物料部分：填写"物料类型"列\n• 产品编码由系统自动生成');
    } catch (err) {
        console.error('导出模板失败:', err);
        alert('导出失败：' + err.message);
    }
}

// ============================================================
//  模板导入（完整版 · 改为 API 存储）
// ============================================================
async function importProductTemplate(event) {
    var file = event.target.files[0];
    if (!file) return;
    ensureProductsData();

    var reader = new FileReader();
    reader.onload = async function(ev) {
        try {
            var dataBytes = new Uint8Array(ev.target.result);
            var workbook = XLSX.read(dataBytes, { type: 'array' });
            var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            var jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            // 查找表头行
            var headerRowIndex = -1;
            for (var i = 0; i < jsonData.length; i++) {
                var row = jsonData[i];
                if (row && row.length > 0 && String(row[0]).includes('款式名称')) {
                    headerRowIndex = i;
                    break;
                }
            }
            if (headerRowIndex === -1) {
                alert('❌ 未找到表头行，请确保使用最新模板。');
                document.getElementById('templateImportInput').value = '';
                return;
            }

            var headerRow = jsonData[headerRowIndex];
            var headerStr = headerRow.join(' ');

            // ★★★ 自动检测模板格式 ★★★
            var isNewFormat = headerStr.indexOf('磁石磁性') !== -1 &&
                              headerStr.indexOf('物料类型') !== -1;

            var colMap = {};
            if (isNewFormat) {
                // 新版11列模板
                var newHeaders = [
                    '款式名称', '客户号',
                    '磁石磁性', '磁石尺寸规格', '磁石数量', '磁石备注',
                    '物料类型', '物料名称', '物料颜色', '物料个数/码', '物料备注'
                ];
                for (var hidx = 0; hidx < headerRow.length; hidx++) {
                    var hVal = String(headerRow[hidx] || '').trim();
                    for (var nidx = 0; nidx < newHeaders.length; nidx++) {
                        if (hVal.indexOf(newHeaders[nidx]) !== -1 || newHeaders[nidx].indexOf(hVal) !== -1) {
                            colMap[newHeaders[nidx]] = hidx;
                            break;
                        }
                    }
                }
                console.log('📌 检测到新版11列模板');
            } else {
                // 旧版14列模板（兼容）
                var oldHeaders = [
                    '款式名称', '客户号',
                    '磁石磁性', '磁石尺寸规格', '磁石数量', '磁石备注',
                    '板材名称', '板材颜色', '板材数量', '板材备注',
                    '壳子名称', '壳子颜色', '壳子数量', '壳子备注'
                ];
                for (var oidx = 0; oidx < headerRow.length; oidx++) {
                    var oVal = String(headerRow[oidx] || '').trim();
                    for (var j = 0; j < oldHeaders.length; j++) {
                        if (oVal.indexOf(oldHeaders[j]) !== -1 || oldHeaders[j].indexOf(oVal) !== -1) {
                            colMap[oldHeaders[j]] = oidx;
                            break;
                        }
                    }
                }
                console.log('📌 检测到旧版14列模板');
            }

            // 检查关键列
            if (colMap['款式名称'] === undefined) {
                alert('❌ 模板格式不正确，请下载最新模板。');
                document.getElementById('templateImportInput').value = '';
                return;
            }

            // 解析数据行
            var productsMap = new Map();
            for (var ri = headerRowIndex + 1; ri < jsonData.length; ri++) {
                var row2 = jsonData[ri];
                if (!row2 || row2.length < 2) continue;
                var name = String(row2[colMap['款式名称']] || '').trim();
                if (!name || name.startsWith('【') || name.includes('填写说明')) continue;
                if (name === '款式名称' || name === '') continue;

                var customerCode = String(row2[colMap['客户号']] || '').trim();
                if (!customerCode) {
                    customerCode = extractCustomerCode(name);
                }

                // 读取磁石数据
                var magnetic = (colMap['磁石磁性'] !== undefined) ? String(row2[colMap['磁石磁性']] || '').trim() : '';
                var magnetSize = (colMap['磁石尺寸规格'] !== undefined) ? String(row2[colMap['磁石尺寸规格']] || '').trim() : '';
                var magnetQty = (colMap['磁石数量'] !== undefined) ? String(row2[colMap['磁石数量']] || '').trim() : '';
                var magnetRemark = (colMap['磁石备注'] !== undefined) ? String(row2[colMap['磁石备注']] || '').trim() : '';

                var materialType = '';
                var materialName = '';
                var materialColor = '';
                var materialQty = '';
                var materialRemark = '';

                if (isNewFormat) {
                    // 新版11列：物料类型 + 物料名称
                    materialType = (colMap['物料类型'] !== undefined) ? String(row2[colMap['物料类型']] || '').trim() : '';
                    materialName = (colMap['物料名称'] !== undefined) ? String(row2[colMap['物料名称']] || '').trim() : '';
                    materialColor = (colMap['物料颜色'] !== undefined) ? String(row2[colMap['物料颜色']] || '').trim() : '';
                    materialQty = (colMap['物料个数/码'] !== undefined) ? String(row2[colMap['物料个数/码']] || '').trim() : '';
                    materialRemark = (colMap['物料备注'] !== undefined) ? String(row2[colMap['物料备注']] || '').trim() : '';
                } else {
                    // 旧版14列：板材和壳子分开
                    var boardName = (colMap['板材名称'] !== undefined) ? String(row2[colMap['板材名称']] || '').trim() : '';
                    var boardColor = (colMap['板材颜色'] !== undefined) ? String(row2[colMap['板材颜色']] || '').trim() : '';
                    var boardQty = (colMap['板材数量'] !== undefined) ? String(row2[colMap['板材数量']] || '').trim() : '';
                    var boardRemark = (colMap['板材备注'] !== undefined) ? String(row2[colMap['板材备注']] || '').trim() : '';

                    var shellName = (colMap['壳子名称'] !== undefined) ? String(row2[colMap['壳子名称']] || '').trim() : '';
                    var shellColor = (colMap['壳子颜色'] !== undefined) ? String(row2[colMap['壳子颜色']] || '').trim() : '';
                    var shellQty = (colMap['壳子数量'] !== undefined) ? String(row2[colMap['壳子数量']] || '').trim() : '';
                    var shellRemark = (colMap['壳子备注'] !== undefined) ? String(row2[colMap['壳子备注']] || '').trim() : '';

                    // 如果有板材数据，生成一条物料行（类型=板材）
                    if (boardName || boardColor || boardQty || boardRemark) {
                        if (!productsMap.has(name)) {
                            productsMap.set(name, {
                                customerCode: customerCode,
                                productCode: generateProductCode(name),
                                magnetRows: [],
                                materialRows: []
                            });
                        }
                        var entryB = productsMap.get(name);
                        entryB.materialRows.push([
                            boardName || '',
                            boardColor || '',
                            boardQty || '',
                            boardRemark || '',
                            '板材'
                        ]);
                    }

                    // 如果有壳子数据，生成一条物料行（类型=壳子）
                    if (shellName || shellColor || shellQty || shellRemark) {
                        if (!productsMap.has(name)) {
                            productsMap.set(name, {
                                customerCode: customerCode,
                                productCode: generateProductCode(name),
                                magnetRows: [],
                                materialRows: []
                            });
                        }
                        var entryS = productsMap.get(name);
                        entryS.materialRows.push([
                            shellName || '',
                            shellColor || '',
                            shellQty || '',
                            shellRemark || '',
                            '壳子'
                        ]);
                    }

                    // 如果有磁石数据，添加到磁石列表
                    if (magnetic || magnetSize || magnetQty || magnetRemark) {
                        if (!productsMap.has(name)) {
                            productsMap.set(name, {
                                customerCode: customerCode,
                                productCode: generateProductCode(name),
                                magnetRows: [],
                                materialRows: []
                            });
                        }
                        var entryM = productsMap.get(name);
                        entryM.magnetRows.push([magnetic, magnetSize, magnetQty, magnetRemark]);
                    }

                    // 如果没有任何数据，跳过
                    if (!magnetic && !magnetSize && !magnetQty && !boardName && !shellName) continue;
                    continue; // 旧版处理完直接进入下一行
                }

                // 新版11列的处理
                if (!magnetic && !magnetSize && !magnetQty && !materialType && !materialName) continue;

                if (!productsMap.has(name)) {
                    productsMap.set(name, {
                        customerCode: customerCode,
                        productCode: generateProductCode(name),
                        magnetRows: [],
                        materialRows: []
                    });
                }
                var entry = productsMap.get(name);

                // 添加磁石行
                if (magnetic || magnetSize || magnetQty || magnetRemark) {
                    entry.magnetRows.push([magnetic, magnetSize, magnetQty, magnetRemark]);
                }

                // 添加物料行
                if (materialType || materialName || materialColor || materialQty || materialRemark) {
                    var materialRow = [
                        materialName || '',
                        materialColor || '',
                        materialQty || '',
                        materialRemark || '',
                        materialType || getMaterialType(materialName)
                    ];
                    entry.materialRows.push(materialRow);
                }
            }

            if (productsMap.size === 0) {
                alert('❌ 未解析到有效产品数据，请检查模板格式。');
                document.getElementById('templateImportInput').value = '';
                return;
            }

            var totalRowsCount = 0;
            productsMap.forEach(function(p) {
                totalRowsCount += p.magnetRows.length + p.materialRows.length;
            });

            var confirmMsg = '共解析到 ' + productsMap.size + ' 个产品款式，' + totalRowsCount + ' 行明细。\n确认导入？（已存在的款式将被跳过）';
            if (!confirm(confirmMsg)) {
                document.getElementById('templateImportInput').value = '';
                return;
            }

            var existingNames = new Set(data.products.map(function(p) { return p.productName; }));
            var addedCount = 0, skipCount = 0;

            // ★★★ 循环调用 API 创建产品 ★★★
            var entries = Array.from(productsMap.entries());
            for (var idx2 = 0; idx2 < entries.length; idx2++) {
                var entryData = entries[idx2];
                var name = entryData[0];
                var entry = entryData[1];

                if (existingNames.has(name)) {
                    skipCount++;
                    continue;
                }

                var magnetRows = entry.magnetRows || [];
                var materialDetail = entry.materialRows || [];
                var finalCustomerCode = entry.customerCode || extractCustomerCode(name);

                // ★★★ 构建 extra 对象 ★★★
                var extraData2 = {
                    customerCode: finalCustomerCode,
                    magnetDetail: JSON.stringify(magnetRows),
                    materialDetail: materialDetail,
                    images: [],
                    files: [],
                    desc: magnetRows.length > 0 ? magnetRows.length + ' 种磁石规格' : '',
                    unit: '个',
                    price: 0
                };

                var productData2 = {
                    code: entry.productCode,
                    name: name,
                    spec: '',
                    customer_code: finalCustomerCode,
                    stock: 0,
                    status: '在库',
                    remark: '',
                    extra: JSON.stringify(extraData2)
                };

                try {
                    var resp2 = await fetch('/api/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(productData2)
                    });

                    if (!resp2.ok) {
                        var errText2 = await resp2.text();
                        console.warn('模板导入失败:', name, errText2);
                        skipCount++;
                        continue;
                    }

                    var created2 = await resp2.json();
                    var parsed2 = typeof window.parseProductExtraFields === 'function'
                        ? window.parseProductExtraFields(created2)
                        : created2;

                    data.products.push(parsed2);
                    addedCount++;
                    existingNames.add(name);
                } catch (err2) {
                    console.warn('模板导入异常:', name, err2);
                    skipCount++;
                }
            }

            saveDataToStorage();
            initProducts();
            document.getElementById('templateImportInput').value = '';
            alert('✅ 导入完成！\n新增 ' + addedCount + ' 个产品，跳过 ' + skipCount + ' 个（已存在或失败）。\n磁石和物料明细已自动分类导入。');
        } catch (err) {
            console.error('模板导入失败:', err);
            alert('导入失败：' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// ============================================================
//  ★★★ 产品详情 - 可编辑表格 + 图片/文件上传 ★★★
// ============================================================

var previewProductId = null;
var previewImageIndex = 0;

function viewProductDetail(id) {
    ensureProductsData();
    var product = data.products.find(function(p) { return p.id === id; });
    if (!product) { alert('产品不存在'); return; }
    if (!product.images) product.images = [];
    if (!product.files) product.files = [];
    if (!product.materialDetail) product.materialDetail = [];

    function renderMaterialTable() {
        if (product.materialDetail.length === 0) {
            return '<div class="text-muted text-center py-2" style="font-size:15px;">暂无物料数据</div>' +
                '<div class="mt-2"><button class="btn btn-sm btn-outline-custom" onclick="addMaterialRow(' + product.id + ')" style="font-size:15px;"><i class="bi bi-plus-lg"></i> 添加物料</button></div>';
        }
        var html = '<table class="table table-sm table-bordered" style="font-size:15px;margin-top:4px;">' +
            '<thead style="background:#f0f4f8;font-size:15px;font-weight:600;"><tr>' +
            '<th style="text-align:center;width:14%;">类型</th>' +
            '<th style="text-align:center;width:22%;">物料</th>' +
            '<th style="text-align:center;width:18%;">颜色</th>' +
            '<th style="text-align:center;width:12%;">个数/码</th>' +
            '<th style="text-align:center;width:24%;">备注</th>' +
            '<th style="text-align:center;width:10%;">操作</th></tr></thead><tbody id="materialTableBody">';
        product.materialDetail.forEach(function(row, index) {
            var nameVal = (row[0] !== undefined && row[0] !== null) ? String(row[0]).trim() : '';
            var colorVal = (row[1] !== undefined && row[1] !== null) ? String(row[1]).trim() : '';
            var qtyVal = (row[2] !== undefined && row[2] !== null) ? String(row[2]).trim() : '';
            var remarkVal = (row[3] !== undefined && row[3] !== null) ? String(row[3]).trim() : '';
            var typeVal = (row[4] !== undefined && row[4] !== null) ? String(row[4]).trim() : getMaterialType(nameVal);
            html += '<tr data-index="' + index + '">' +
                '<td style="text-align:center;font-size:15px;font-weight:600;padding:4px 4px;">' +
                '<input type="text" class="form-control form-control-sm material-type" value="' + typeVal + '" style="font-size:15px;font-weight:600;text-align:center;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;width:100%;min-width:70px;" placeholder="类型" />' +
                '</td>' +
                '<td><input type="text" class="form-control form-control-sm material-name" value="' + nameVal + '" style="font-size:15px;font-weight:500;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;" placeholder="如 板材" oninput="updateMaterialType(this)" /></td>' +
                '<td><input type="text" class="form-control form-control-sm material-color" value="' + colorVal + '" style="font-size:15px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;" placeholder="如 黑色" /></td>' +
                '<td><input type="text" class="form-control form-control-sm material-qty" value="' + qtyVal + '" style="font-size:15px;text-align:center;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;" placeholder="如 100" /></td>' +
                '<td><input type="text" class="form-control form-control-sm material-remark" value="' + remarkVal + '" style="font-size:15px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;" placeholder="" /></td>' +
                '<td style="text-align:center;"><button class="btn btn-sm btn-outline-danger" onclick="deleteMaterialRow(' + product.id + ', ' + index + ')" title="删除此行" style="font-size:14px;padding:2px 6px;"><i class="bi bi-trash3"></i></button></td>' +
                '</tr>';
        });
        html += '</tbody></table>' +
            '<div class="mt-2"><button class="btn btn-sm btn-outline-custom" onclick="addMaterialRow(' + product.id + ')" style="font-size:15px;"><i class="bi bi-plus-lg"></i> 添加物料</button>' +
            '<button class="btn btn-sm btn-primary-custom" onclick="saveMaterialTable(' + product.id + ')" style="font-size:15px;margin-left:8px;"><i class="bi bi-save"></i> 保存物料</button></div>';
        return html;
    }

    function renderMagnetTable() {
        try {
            var magnetArr = JSON.parse(product.magnetDetail || '[]');
            if (!Array.isArray(magnetArr) || magnetArr.length === 0) {
                return '<div class="text-muted text-center py-3" style="font-size:15px;">暂无磁石数据</div>' +
                    '<div class="mt-2"><button class="btn btn-sm btn-outline-custom" onclick="addMagnetRow(' + product.id + ')" style="font-size:15px;"><i class="bi bi-plus-lg"></i> 添加磁石</button></div>';
            }
            var validRows = magnetArr.filter(function(row) {
                if (!Array.isArray(row)) return false;
                return row.some(function(cell) { return cell && String(cell).trim() !== ''; });
            });
            if (validRows.length === 0) {
                return '<div class="text-muted text-center py-3" style="font-size:15px;">暂无磁石数据</div>' +
                    '<div class="mt-2"><button class="btn btn-sm btn-outline-custom" onclick="addMagnetRow(' + product.id + ')" style="font-size:15px;"><i class="bi bi-plus-lg"></i> 添加磁石</button></div>';
            }
            var html = '<table class="table table-sm table-bordered" style="font-size:15px;margin-top:4px;">' +
                '<thead style="background:#f0f4f8;font-size:15px;font-weight:600;"><tr>' +
                '<th style="text-align:center;width:16%;">磁石磁性</th>' +
                '<th style="text-align:center;width:24%;">尺寸规格</th>' +
                '<th style="text-align:center;width:12%;">数量</th>' +
                '<th style="text-align:center;width:33%;">备注</th>' +
                '<th style="text-align:center;width:15%;">操作</th></tr></thead><tbody id="magnetTableBody">';
            validRows.forEach(function(row, index) {
                var magVal = (row[0] !== undefined && row[0] !== null) ? String(row[0]).trim() : '';
                var sizeVal = (row[1] !== undefined && row[1] !== null) ? String(row[1]).trim() : '';
                var qtyVal = (row[2] !== undefined && row[2] !== null) ? String(row[2]).trim() : '';
                var remarkVal = (row[3] !== undefined && row[3] !== null) ? String(row[3]).trim() : '';
                html += '<tr data-index="' + index + '">' +
                    '<td><input type="text" class="form-control form-control-sm mag-magnetic" value="' + magVal + '" style="font-size:15px;font-weight:600;min-width:60px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;text-align:center;" placeholder="如 N42" /></td>' +
                    '<td><input type="text" class="form-control form-control-sm mag-size" value="' + sizeVal + '" style="font-size:15px;font-family:monospace;text-align:center;padding:4px 6px;font-weight:600;" placeholder="如 25*1*5" /></td>' +
                    '<td><input type="number" class="form-control form-control-sm mag-qty" value="' + qtyVal + '" style="font-size:15px;text-align:center;width:100%;min-width:50px;padding:4px 6px;font-weight:600;" min="0" step="1" /></td>' +
                    '<td><input type="text" class="form-control form-control-sm mag-remark" value="' + remarkVal + '" style="font-size:15px;padding:4px 6px;font-weight:600;" placeholder="" /></td>' +
                    '<td style="text-align:center;"><button class="btn btn-sm btn-outline-danger" onclick="deleteMagnetRow(' + product.id + ', ' + index + ')" title="删除此行" style="font-size:14px;padding:2px 8px;"><i class="bi bi-trash3"></i></button></td>' +
                    '</tr>';
            });
            html += '</tbody></table>' +
                '<div class="mt-2 d-flex gap-2"><button class="btn btn-sm btn-outline-custom" onclick="addMagnetRow(' + product.id + ')" style="font-size:15px;padding:6px 14px;"><i class="bi bi-plus-lg"></i> 添加磁石</button>' +
                '<button class="btn btn-sm btn-primary-custom" onclick="saveMagnetTable(' + product.id + ')" style="font-size:15px;padding:6px 14px;"><i class="bi bi-save"></i> 保存修改</button></div>';
            return html;
        } catch (e) {
            console.warn('渲染表格失败:', e);
            return '<div class="text-danger text-center py-3" style="font-size:15px;">⚠️ 数据格式异常</div>';
        }
    }

    function renderImages() {
        var images = product.images || [];
        if (images.length === 0) {
            return '<div class="text-muted text-center py-2" style="font-size:14px;">暂无图片</div>';
        }
        var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;">';
        images.forEach(function(img, index) {
            html += '<div style="position:relative;width:100px;height:100px;border:1px solid #e9edf2;border-radius:8px;overflow:hidden;cursor:pointer;" onclick="openImagePreview(' + product.id + ', ' + index + ')">' +
                '<img src="' + img + '" style="width:100%;height:100%;object-fit:cover;" />' +
                '<button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation();removeProductImage(' + product.id + ', ' + index + ')" style="position:absolute;top:2px;right:2px;padding:0 6px;font-size:12px;border-radius:50%;background:rgba(255,255,255,0.9);"><i class="bi bi-x"></i></button>' +
                '</div>';
        });
        html += '</div>';
        return html;
    }

    function renderFiles() {
        var files = product.files || [];
        if (files.length === 0) {
            return '<div class="text-muted text-center py-2" style="font-size:14px;">暂无文件</div>';
        }
        var html = '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
        files.forEach(function(file, index) {
            var icon = file.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i) ? 'bi-file-earmark-pdf' : 'bi-file-earmark';
            html += '<div style="display:flex;align-items:center;gap:8px;background:#f8fafc;padding:6px 12px;border-radius:6px;border:1px solid #e9edf2;">' +
                '<i class="bi ' + icon + '" style="font-size:18px;color:#0066cc;"></i>' +
                '<span style="font-size:15px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;color:#0066cc;font-weight:500;" onclick="previewProductFile(' + product.id + ', ' + index + ')" title="点击预览">' + file.name + '</span>' +
                '<button class="btn btn-sm btn-outline-danger" onclick="removeProductFile(' + product.id + ', ' + index + ')" style="padding:0 4px;font-size:14px;"><i class="bi bi-x"></i></button>' +
                '<button class="btn btn-sm btn-outline-custom" onclick="downloadProductFile(' + product.id + ', ' + index + ')" style="padding:0 4px;font-size:14px;" title="下载文件"><i class="bi bi-download"></i></button>' +
                '</div>';
        });
        html += '</div>';
        return html;
    }

    // 构建产品详情模态框
    var modalId = 'productDetailModal';
    var modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = '<div class="modal-dialog modal-xl"><div class="modal-content"><div class="modal-header"><h5 class="modal-title"><i class="bi bi-box"></i> 产品详情</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body" id="productDetailBody" style="max-height:70vh;overflow-y:auto;"></div><div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">关闭</button></div></div></div>';
        document.body.appendChild(modal);
    }

    var body = document.getElementById('productDetailBody');
    body.innerHTML =
        '<div style="position:sticky;top:0;z-index:10;background:#fff;padding:4px 0 6px 0;border-bottom:2px solid #e9edf2;margin-bottom:4px;">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px;font-size:16px;">' +
        '<div style="padding:1px 0;"><strong>产品编码：</strong>' + (product.code || '-') + '</div>' +
        '<div style="padding:1px 0;"><strong>款式名称：</strong>' + (product.name || '-') + '</div>' +
        '<div style="padding:1px 0;"><strong>客户号：</strong>' + (product.customerCode || '-') + '</div>' +
        '<div style="padding:1px 0;"><strong>单位：</strong>' + (product.unit || '个') + '</div>' +
        '</div></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:16px;">' +
        '<div style="flex:1;min-width:280px;"><p style="margin:0 0 4px 0;font-weight:600;font-size:16px;">📦 物料明细 <span style="font-size:14px;color:#999;font-weight:400;">（类型、物料、颜色、个数/码、备注）</span></p>' +
        '<div id="materialTableContainer" style="background:#fafbfc;padding:6px 10px;border-radius:8px;border:1px solid #e9edf2;max-height:350px;overflow-y:auto;">' + renderMaterialTable() + '</div></div>' +
        '<div style="flex:1;min-width:280px;"><p style="margin:0 0 4px 0;font-weight:600;font-size:16px;">🧲 磁石明细</p>' +
        '<div id="magnetTableContainer" style="background:#fafbfc;padding:6px 10px;border-radius:8px;border:1px solid #e9edf2;max-height:350px;overflow-y:auto;">' + renderMagnetTable() + '</div></div></div>' +
        '<hr style="margin:8px 0;" />' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">' +
        '<p style="margin:0;font-size:16px;"><strong>📷 产品图片</strong> <span style="font-size:14px;color:#999;font-weight:400;">（点击图片可放大，支持 JPG/PNG）</span></p>' +
        '<button class="btn btn-sm btn-outline-custom" onclick="document.getElementById(\'productImageInput_' + product.id + '\').click()" style="font-size:15px;"><i class="bi bi-plus-lg"></i> 上传图片</button>' +
        '<input type="file" id="productImageInput_' + product.id + '" accept="image/*" multiple style="display:none" onchange="uploadProductImages(' + product.id + ', this)" />' +
        '</div>' +
        '<div id="productImagesContainer" style="margin-top:6px;padding:6px 10px;background:#fafbfc;border-radius:8px;border:1px solid #e9edf2;min-height:50px;font-size:15px;">' + renderImages() + '</div>' +
        '<hr style="margin:8px 0;" />' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">' +
        '<p style="margin:0;font-size:16px;"><strong>📄 样板文件</strong> <span style="font-size:14px;color:#999;font-weight:400;">（点击文件名可预览）</span></p>' +
        '<button class="btn btn-sm btn-outline-custom" onclick="document.getElementById(\'productFileInput_' + product.id + '\').click()" style="font-size:15px;"><i class="bi bi-plus-lg"></i> 上传文件</button>' +
        '<input type="file" id="productFileInput_' + product.id + '" multiple style="display:none" onchange="uploadProductFiles(' + product.id + ', this)" />' +
        '</div>' +
        '<div id="productFilesContainer" style="margin-top:6px;padding:6px 10px;background:#fafbfc;border-radius:8px;border:1px solid #e9edf2;min-height:50px;font-size:15px;">' + renderFiles() + '</div>';

    var bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// ============================================================
//  ★★★ 磁石明细 CRUD ★★★
// ============================================================

function refreshMagnetTable(productId) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) return;
    var container = document.getElementById('magnetTableContainer');
    if (!container) return;
    try {
        var arr = JSON.parse(product.magnetDetail || '[]');
        if (!Array.isArray(arr)) arr = [];
        var validRows = arr.filter(function(row) {
            if (!Array.isArray(row)) return false;
            return row.some(function(cell) { return cell && String(cell).trim() !== ''; });
        });
        var magnetData = validRows.map(function(row) {
            if (Array.isArray(row) && row.length >= 4) {
                return [row[0] || '', row[1] || '', row[2] || '', row[3] || ''];
            }
            if (Array.isArray(row) && row.length === 3) {
                return [row[0] || '', row[1] || '', row[2] || '', ''];
            }
            return ['', '', '', ''];
        }).filter(function(row) { return row.some(function(cell) { return cell.trim() !== ''; }); });
        if (magnetData.length === 0) {
            container.innerHTML = '<div class="text-muted text-center py-3" style="font-size:15px;">暂无磁石数据</div>' +
                '<div class="mt-2"><button class="btn btn-sm btn-outline-custom" onclick="addMagnetRow(' + product.id + ')" style="font-size:15px;padding:6px 14px;"><i class="bi bi-plus-lg"></i> 添加磁石</button></div>';
            return;
        }
        var html = '<table class="table table-sm table-bordered" style="font-size:15px;margin-top:4px;">' +
            '<thead style="background:#f0f4f8;font-size:15px;font-weight:600;"><tr>' +
            '<th style="text-align:center;width:16%;">磁石磁性</th>' +
            '<th style="text-align:center;width:24%;">尺寸规格</th>' +
            '<th style="text-align:center;width:12%;">数量</th>' +
            '<th style="text-align:center;width:33%;">备注</th>' +
            '<th style="text-align:center;width:15%;">操作</th></tr></thead><tbody id="magnetTableBody">';
        magnetData.forEach(function(row, index) {
            var magVal = row[0] || '';
            var sizeVal = row[1] || '';
            var qtyVal = row[2] || '';
            var remarkVal = row[3] || '';
            html += '<tr data-index="' + index + '">' +
                '<td><input type="text" class="form-control form-control-sm mag-magnetic" value="' + magVal + '" style="font-size:15px;font-weight:600;min-width:60px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;text-align:center;" placeholder="如 N42" /></td>' +
                '<td><input type="text" class="form-control form-control-sm mag-size" value="' + sizeVal + '" style="font-size:15px;font-family:monospace;text-align:center;padding:4px 6px;font-weight:600;" placeholder="如 25*1*5" /></td>' +
                '<td><input type="number" class="form-control form-control-sm mag-qty" value="' + qtyVal + '" style="font-size:15px;text-align:center;width:100%;min-width:50px;padding:4px 6px;font-weight:600;" min="0" step="1" /></td>' +
                '<td><input type="text" class="form-control form-control-sm mag-remark" value="' + remarkVal + '" style="font-size:15px;padding:4px 6px;font-weight:600;" placeholder="" /></td>' +
                '<td style="text-align:center;"><button class="btn btn-sm btn-outline-danger" onclick="deleteMagnetRow(' + product.id + ', ' + index + ')" title="删除此行" style="font-size:14px;padding:2px 8px;"><i class="bi bi-trash3"></i></button></td>' +
                '</tr>';
        });
        html += '</tbody></table>' +
            '<div class="mt-2 d-flex gap-2"><button class="btn btn-sm btn-outline-custom" onclick="addMagnetRow(' + product.id + ')" style="font-size:15px;padding:6px 14px;"><i class="bi bi-plus-lg"></i> 添加磁石</button>' +
            '<button class="btn btn-sm btn-primary-custom" onclick="saveMagnetTable(' + product.id + ')" style="font-size:15px;padding:6px 14px;"><i class="bi bi-save"></i> 保存修改</button></div>';
        container.innerHTML = html;
    } catch (e) {
        console.warn('刷新表格失败:', e);
        container.innerHTML = '<span class="text-danger" style="font-size:15px;">数据格式错误</span>';
    }
}

function saveMagnetTable(productId) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    var tbody = document.querySelector('#magnetTableBody');
    if (!tbody) { alert('表格不存在，请重新打开详情页'); return; }
    var rows = tbody.querySelectorAll('tr');
    if (rows.length === 0) { alert('没有磁石数据可保存'); return; }
    var newMagnetRows = [];
    var hasValidData = false;
    rows.forEach(function(row, index) {
        var magneticInput = row.querySelector('.mag-magnetic');
        var sizeInput = row.querySelector('.mag-size');
        var qtyInput = row.querySelector('.mag-qty');
        var remarkInput = row.querySelector('.mag-remark');
        if (!magneticInput || !sizeInput || !qtyInput || !remarkInput) {
            console.warn('第 ' + index + ' 行缺少输入框，跳过');
            return;
        }
        var magnetic = magneticInput.value?.trim() || '';
        var size = sizeInput.value?.trim() || '';
        var qty = qtyInput.value?.trim() || '';
        var remark = remarkInput.value?.trim() || '';
        var rowData = [magnetic, size, qty, remark];
        if (rowData.some(function(cell) { return cell && cell.trim() !== ''; })) {
            newMagnetRows.push(rowData);
            hasValidData = true;
        }
    });
    if (!hasValidData) {
        alert('至少需要保留一条有效磁石数据');
        return;
    }
    product.magnetDetail = JSON.stringify(newMagnetRows);
    product.desc = newMagnetRows.length + ' 种磁石规格';
    saveDataToStorage();
    refreshMagnetTable(productId);
    initProducts();
    alert('✅ 磁石明细已保存！');
}

function deleteMagnetRow(productId, rowIndex) {
    if (!confirm('确定删除此行磁石数据吗？')) return;
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    try {
        var arr = JSON.parse(product.magnetDetail || '[]');
        if (Array.isArray(arr) && rowIndex < arr.length) {
            arr.splice(rowIndex, 1);
            product.magnetDetail = JSON.stringify(arr);
            product.desc = arr.length > 0 ? arr.length + ' 种磁石规格' : '';
            saveDataToStorage();
            refreshMagnetTable(productId);
            initProducts();
        }
    } catch (e) {
        console.error('删除磁石失败:', e);
        alert('删除失败，请重试');
    }
}

function addMagnetRow(productId) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    var tbody = document.querySelector('#magnetTableBody');
    if (tbody) {
        var rows = tbody.querySelectorAll('tr');
        var newRows = [];
        rows.forEach(function(row) {
            var magInput = row.querySelector('.mag-magnetic');
            var sizeInput = row.querySelector('.mag-size');
            var qtyInput = row.querySelector('.mag-qty');
            var remarkInput = row.querySelector('.mag-remark');
            if (magInput && sizeInput && qtyInput && remarkInput) {
                var mag = magInput.value?.trim() || '';
                var size = sizeInput.value?.trim() || '';
                var qty = qtyInput.value?.trim() || '';
                var remark = remarkInput.value?.trim() || '';
                if (mag || size || qty || remark) {
                    newRows.push([mag, size, qty, remark]);
                }
            }
        });
        product.magnetDetail = JSON.stringify(newRows);
        saveDataToStorage();
    }
    var arr = [];
    try { arr = JSON.parse(product.magnetDetail || '[]'); } catch (e) { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    arr.push(['', '', '', '']);
    product.magnetDetail = JSON.stringify(arr);
    saveDataToStorage();
    refreshMagnetTable(productId);
    initProducts();
    setTimeout(function() {
        var tbodyNew = document.querySelector('#magnetTableBody');
        if (tbodyNew) {
            var lastRow = tbodyNew.querySelector('tr:last-child');
            if (lastRow) {
                var firstInput = lastRow.querySelector('.mag-magnetic');
                if (firstInput) firstInput.focus();
            }
        }
    }, 100);
}

// ============================================================
//  ★★★ 物料明细 CRUD ★★★
// ============================================================

function addMaterialRow(productId) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    var tbody = document.querySelector('#materialTableBody');
    if (tbody) {
        var rows = tbody.querySelectorAll('tr');
        var newRows = [];
        rows.forEach(function(row) {
            var nameInput = row.querySelector('.material-name');
            var colorInput = row.querySelector('.material-color');
            var qtyInput = row.querySelector('.material-qty');
            var remarkInput = row.querySelector('.material-remark');
            var typeInput = row.querySelector('.material-type');
            if (nameInput && colorInput && qtyInput && remarkInput) {
                var name = nameInput.value?.trim() || '';
                var color = colorInput.value?.trim() || '';
                var qty = qtyInput.value?.trim() || '';
                var remark = remarkInput.value?.trim() || '';
                var type = typeInput ? typeInput.value?.trim() : '';
                if (name || color || qty || remark) {
                    newRows.push([name, color, qty, remark, type || getMaterialType(name)]);
                }
            }
        });
        product.materialDetail = newRows;
        saveDataToStorage();
    }
    if (!product.materialDetail) product.materialDetail = [];
    product.materialDetail.push(['', '', '', '', '']);
    saveDataToStorage();
    refreshMaterialTable(productId);
    setTimeout(function() {
        var tbodyNew = document.querySelector('#materialTableBody');
        if (tbodyNew) {
            var lastRow = tbodyNew.querySelector('tr:last-child');
            if (lastRow) {
                var firstInput = lastRow.querySelector('.material-name');
                if (firstInput) firstInput.focus();
            }
        }
    }, 100);
}

function deleteMaterialRow(productId, rowIndex) {
    if (!confirm('确定删除此行物料数据吗？')) return;
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    if (!product.materialDetail) product.materialDetail = [];
    if (rowIndex < product.materialDetail.length) {
        product.materialDetail.splice(rowIndex, 1);
        saveDataToStorage();
        refreshMaterialTable(productId);
    }
}

function saveMaterialTable(productId) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    var tbody = document.querySelector('#materialTableBody');
    if (!tbody) { alert('表格不存在，请重新打开详情页'); return; }
    var rows = tbody.querySelectorAll('tr');
    if (rows.length === 0) { alert('没有物料数据可保存'); return; }
    var newRows = [];
    var hasValidData = false;
    rows.forEach(function(row, index) {
        var nameInput = row.querySelector('.material-name');
        var colorInput = row.querySelector('.material-color');
        var qtyInput = row.querySelector('.material-qty');
        var remarkInput = row.querySelector('.material-remark');
        var typeInput = row.querySelector('.material-type');
        if (!nameInput || !colorInput || !qtyInput || !remarkInput) {
            console.warn('第 ' + index + ' 行缺少输入框，跳过');
            return;
        }
        var name = nameInput.value?.trim() || '';
        var color = colorInput.value?.trim() || '';
        var qty = qtyInput.value?.trim() || '';
        var remark = remarkInput.value?.trim() || '';
        var type = typeInput ? typeInput.value?.trim() : getMaterialType(name);
        var rowData = [name, color, qty, remark, type || getMaterialType(name)];
        if (name || color || qty || remark) {
            newRows.push(rowData);
            hasValidData = true;
        }
    });
    if (!hasValidData) {
        alert('至少需要保留一条有效物料数据');
        return;
    }
    product.materialDetail = newRows;
    saveDataToStorage();
    refreshMaterialTable(productId);
    alert('✅ 物料明细已保存！');
}

function refreshMaterialTable(productId) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) return;
    var container = document.getElementById('materialTableContainer');
    if (!container) return;
    if (!product.materialDetail) product.materialDetail = [];
    if (product.materialDetail.length === 0) {
        container.innerHTML = '<div class="text-muted text-center py-2" style="font-size:15px;">暂无物料数据</div>' +
            '<div class="mt-2"><button class="btn btn-sm btn-outline-custom" onclick="addMaterialRow(' + product.id + ')" style="font-size:15px;"><i class="bi bi-plus-lg"></i> 添加物料</button></div>';
        return;
    }
    var html = '<table class="table table-sm table-bordered" style="font-size:15px;margin-top:4px;">' +
        '<thead style="background:#f0f4f8;font-size:15px;font-weight:600;"><tr>' +
        '<th style="text-align:center;width:14%;">类型</th>' +
        '<th style="text-align:center;width:22%;">物料</th>' +
        '<th style="text-align:center;width:18%;">颜色</th>' +
        '<th style="text-align:center;width:12%;">个数/码</th>' +
        '<th style="text-align:center;width:24%;">备注</th>' +
        '<th style="text-align:center;width:10%;">操作</th></tr></thead><tbody id="materialTableBody">';
    product.materialDetail.forEach(function(row, index) {
        var nameVal = (row[0] !== undefined && row[0] !== null) ? String(row[0]).trim() : '';
        var colorVal = (row[1] !== undefined && row[1] !== null) ? String(row[1]).trim() : '';
        var qtyVal = (row[2] !== undefined && row[2] !== null) ? String(row[2]).trim() : '';
        var remarkVal = (row[3] !== undefined && row[3] !== null) ? String(row[3]).trim() : '';
        var typeVal = (row[4] !== undefined && row[4] !== null) ? String(row[4]).trim() : getMaterialType(nameVal);
        html += '<tr data-index="' + index + '">' +
            '<td style="text-align:center;font-size:15px;font-weight:600;padding:4px 4px;">' +
            '<input type="text" class="form-control form-control-sm material-type" value="' + typeVal + '" style="font-size:15px;font-weight:600;text-align:center;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;width:100%;min-width:70px;" placeholder="类型" />' +
            '</td>' +
            '<td><input type="text" class="form-control form-control-sm material-name" value="' + nameVal + '" style="font-size:15px;font-weight:500;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;" placeholder="如 板材" oninput="updateMaterialType(this)" /></td>' +
            '<td><input type="text" class="form-control form-control-sm material-color" value="' + colorVal + '" style="font-size:15px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;" placeholder="如 黑色" /></td>' +
            '<td><input type="text" class="form-control form-control-sm material-qty" value="' + qtyVal + '" style="font-size:15px;text-align:center;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;" placeholder="如 100" /></td>' +
            '<td><input type="text" class="form-control form-control-sm material-remark" value="' + remarkVal + '" style="font-size:15px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;" placeholder="" /></td>' +
            '<td style="text-align:center;"><button class="btn btn-sm btn-outline-danger" onclick="deleteMaterialRow(' + product.id + ', ' + index + ')" title="删除此行" style="font-size:14px;padding:2px 6px;"><i class="bi bi-trash3"></i></button></td>' +
            '</tr>';
    });
    html += '</tbody></table>' +
        '<div class="mt-2"><button class="btn btn-sm btn-outline-custom" onclick="addMaterialRow(' + product.id + ')" style="font-size:15px;"><i class="bi bi-plus-lg"></i> 添加物料</button>' +
        '<button class="btn btn-sm btn-primary-custom" onclick="saveMaterialTable(' + product.id + ')" style="font-size:15px;margin-left:8px;"><i class="bi bi-save"></i> 保存物料</button></div>';
    container.innerHTML = html;
}

// ============================================================
//  ★★★ 图片/文件上传、删除、预览 ★★★
// ============================================================

function uploadProductImages(productId, input) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    var files = input.files;
    if (files.length === 0) return;
    if (!product.images) product.images = [];
    var loadedCount = 0;
    var totalFiles = files.length;
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.size > 2 * 1024 * 1024) {
            alert('图片 "' + file.name + '" 超过2MB限制，请压缩后上传');
            loadedCount++;
            continue;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
            product.images.push(e.target.result);
            loadedCount++;
            if (loadedCount === totalFiles) {
                saveDataToStorage();
                refreshProductMedia(productId);
                alert('✅ 成功上传 ' + product.images.length + ' 张图片');
            }
        };
        reader.onerror = function() {
            loadedCount++;
            alert('图片 "' + file.name + '" 读取失败');
            if (loadedCount === totalFiles && totalFiles > 0) {
                saveDataToStorage();
                refreshProductMedia(productId);
            }
        };
        reader.readAsDataURL(file);
    }
    input.value = '';
}

function uploadProductFiles(productId, input) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    var files = input.files;
    if (files.length === 0) return;
    if (!product.files) product.files = [];
    var loadedCount = 0;
    var totalFiles = files.length;
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.size > 5 * 1024 * 1024) {
            alert('文件 "' + file.name + '" 超过5MB限制，请压缩后上传');
            loadedCount++;
            continue;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
            product.files.push({
                name: file.name,
                size: file.size,
                type: file.type,
                data: e.target.result
            });
            loadedCount++;
            if (loadedCount === totalFiles) {
                saveDataToStorage();
                refreshProductMedia(productId);
                alert('✅ 成功上传 ' + product.files.length + ' 个文件');
            }
        };
        reader.onerror = function() {
            loadedCount++;
            alert('文件 "' + file.name + '" 读取失败');
            if (loadedCount === totalFiles && totalFiles > 0) {
                saveDataToStorage();
                refreshProductMedia(productId);
            }
        };
        reader.readAsDataURL(file);
    }
    input.value = '';
}

function removeProductImage(productId, index) {
    if (!confirm('确定删除这张图片吗？')) return;
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    if (!product.images) product.images = [];
    product.images.splice(index, 1);
    saveDataToStorage();
    refreshProductMedia(productId);
}

function removeProductFile(productId, index) {
    if (!confirm('确定删除这个文件吗？')) return;
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    if (!product.files) product.files = [];
    product.files.splice(index, 1);
    saveDataToStorage();
    refreshProductMedia(productId);
}

function refreshProductMedia(productId) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) return;
    var imgContainer = document.getElementById('productImagesContainer');
    if (imgContainer) {
        var images = product.images || [];
        if (images.length === 0) {
            imgContainer.innerHTML = '<div class="text-muted text-center py-2" style="font-size:14px;">暂无图片</div>';
        } else {
            var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;">';
            images.forEach(function(img, index) {
                html += '<div style="position:relative;width:100px;height:100px;border:1px solid #e9edf2;border-radius:8px;overflow:hidden;cursor:pointer;" onclick="openImagePreview(' + product.id + ', ' + index + ')">' +
                    '<img src="' + img + '" style="width:100%;height:100%;object-fit:cover;" />' +
                    '<button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation();removeProductImage(' + product.id + ', ' + index + ')" style="position:absolute;top:2px;right:2px;padding:0 6px;font-size:12px;border-radius:50%;background:rgba(255,255,255,0.9);"><i class="bi bi-x"></i></button>' +
                    '</div>';
            });
            html += '</div>';
            imgContainer.innerHTML = html;
        }
    }
    var fileContainer = document.getElementById('productFilesContainer');
    if (fileContainer) {
        var files = product.files || [];
        if (files.length === 0) {
            fileContainer.innerHTML = '<div class="text-muted text-center py-2" style="font-size:14px;">暂无文件</div>';
        } else {
            var html2 = '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
            files.forEach(function(file, index) {
                var icon = file.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i) ? 'bi-file-earmark-pdf' : 'bi-file-earmark';
                html2 += '<div style="display:flex;align-items:center;gap:8px;background:#f8fafc;padding:6px 12px;border-radius:6px;border:1px solid #e9edf2;">' +
                    '<i class="bi ' + icon + '" style="font-size:18px;color:#0066cc;"></i>' +
                    '<span style="font-size:15px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;color:#0066cc;font-weight:500;" onclick="previewProductFile(' + product.id + ', ' + index + ')" title="点击预览">' + file.name + '</span>' +
                    '<button class="btn btn-sm btn-outline-danger" onclick="removeProductFile(' + product.id + ', ' + index + ')" style="padding:0 4px;font-size:14px;"><i class="bi bi-x"></i></button>' +
                    '<button class="btn btn-sm btn-outline-custom" onclick="downloadProductFile(' + product.id + ', ' + index + ')" style="padding:0 4px;font-size:14px;" title="下载文件"><i class="bi bi-download"></i></button>' +
                    '</div>';
            });
            html2 += '</div>';
            fileContainer.innerHTML = html2;
        }
    }
}

function downloadProductFile(productId, index) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    if (!product.files || !product.files[index]) { alert('文件不存在'); return; }
    var file = product.files[index];
    var a = document.createElement('a');
    a.href = file.data;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function previewProductFile(productId, index) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    if (!product.files || !product.files[index]) { alert('文件不存在'); return; }
    var file = product.files[index];
    var fileName = file.name || '文件';
    var fileData = file.data;
    var ext = fileName.split('.').pop().toLowerCase();
    var isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].indexOf(ext) !== -1;
    var isPDF = ext === 'pdf';
    var isText = ['txt', 'log', 'md', 'csv'].indexOf(ext) !== -1;
    var isExcel = ['xls', 'xlsx'].indexOf(ext) !== -1;

    if (isImage) {
        var imgWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
        if (!imgWindow) { alert('请允许弹出窗口查看文件'); return; }
        imgWindow.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + fileName + '</title>' +
            '<style>body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#0a2540;flex-direction:column;}' +
            'img{max-width:95vw;max-height:90vh;border-radius:8px;box-shadow:0 4px 30px rgba(0,0,0,0.5);}' +
            '.info{color:rgba(255,255,255,0.6);font-size:13px;margin-top:16px;font-family:sans-serif;}</style></head><body><img src="' + fileData + '" alt="' + fileName + '" /><div class="info">' + fileName + '</div></body></html>');
        imgWindow.document.close();
        return;
    }
    if (isPDF) {
        var pdfWindow = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes');
        if (!pdfWindow) { alert('请允许弹出窗口查看文件'); return; }
        pdfWindow.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + fileName + '</title>' +
            '<style>body{margin:0;padding:0;height:100vh;overflow:hidden;background:#f0f2f5;}' +
            'iframe{width:100%;height:100%;border:none;}</style></head><body><iframe src="' + fileData + '"></iframe></body></html>');
        pdfWindow.document.close();
        return;
    }
    if (isText) {
        var textWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        if (!textWindow) { alert('请允许弹出窗口查看文件'); return; }
        var textContent = '';
        try {
            if (fileData.startsWith('data:')) {
                var base64Data = fileData.split(',')[1] || '';
                textContent = atob(base64Data);
            } else {
                textContent = fileData;
            }
        } catch (e) {
            textContent = '无法解码文件内容';
        }
        textWindow.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + fileName + '</title>' +
            '<style>body{margin:0;padding:20px;background:#f8fafc;font-family:"Courier New",monospace;font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-all;}' +
            '.header{background:#0a2540;color:#fff;padding:12px 20px;margin:-20px -20px 20px -20px;font-weight:600;font-family:sans-serif;}</style></head><body><div class="header">📄 ' + fileName + '</div><pre>' + textContent + '</pre></body></html>');
        textWindow.document.close();
        return;
    }
    if (isExcel) {
        try {
            if (typeof XLSX === 'undefined') {
                alert('XLSX 库未加载，请刷新页面后重试');
                return;
            }
            var base64Data2 = fileData.split(',')[1] || fileData;
            var binaryString = atob(base64Data2);
            var bytes = new Uint8Array(binaryString.length);
            for (var bi = 0; bi < binaryString.length; bi++) {
                bytes[bi] = binaryString.charCodeAt(bi);
            }
            var workbook2 = XLSX.read(bytes, { type: 'array' });
            var previewHtml2 = '';
            var sheetNames2 = workbook2.SheetNames;
            sheetNames2.forEach(function(sheetName) {
                var sheet = workbook2.Sheets[sheetName];
                var jsonData2 = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                if (jsonData2.length > 0) {
                    previewHtml2 += '<div style="margin-bottom:16px;"><div style="font-weight:600;font-size:16px;color:#0a2540;margin-bottom:8px;background:#e6f0ff;padding:6px 12px;border-radius:6px;">📋 ' + sheetName + '（' + jsonData2.length + ' 行）</div>' +
                        '<div style="overflow:auto;max-height:400px;border:1px solid #e2e8f0;border-radius:6px;"><table style="border-collapse:collapse;width:100%;font-size:13px;font-family:sans-serif;">';
                    jsonData2.forEach(function(row, rowIndex) {
                        var isHeader2 = rowIndex === 0;
                        previewHtml2 += '<tr>';
                        row.forEach(function(cell, colIndex) {
                            var cellValue = cell !== undefined && cell !== null ? String(cell) : '';
                            var style = isHeader2 ? 'background:#f0f4f8;font-weight:600;padding:6px 10px;border:1px solid #d0d8e0;text-align:left;white-space:nowrap;' : 'padding:5px 10px;border:1px solid #e2e8f0;text-align:left;white-space:nowrap;';
                            previewHtml2 += '<td style="' + style + '">' + cellValue + '</td>';
                        });
                        previewHtml2 += '</tr>';
                    });
                    previewHtml2 += '</table></div></div>';
                }
            });
            if (!previewHtml2) {
                alert('Excel 文件为空或无法解析');
                return;
            }
            var excelWindow = window.open('', '_blank', 'width=1100,height=800,scrollbars=yes');
            if (!excelWindow) { alert('请允许弹出窗口查看文件'); return; }
            excelWindow.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + fileName + '</title>' +
                '<style>body{margin:0;padding:20px;background:#f8fafc;font-family:"Segoe UI",sans-serif;}' +
                '.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #0066cc;}' +
                '.header h2{margin:0;color:#0a2540;font-size:20px;}' +
                '.header .close-btn{padding:6px 20px;border-radius:6px;border:1px solid #d0d8e0;background:#fff;cursor:pointer;font-size:14px;}' +
                '.header .close-btn:hover{background:#f0f4f8;}' +
                '.footer{text-align:center;color:#999;font-size:12px;margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;}</style></head><body>' +
                '<div class="header"><h2>📊 ' + fileName + '</h2><button class="close-btn" onclick="window.close()">关闭</button></div>' +
                previewHtml2 +
                '<div class="footer">共 ' + sheetNames2.length + ' 个工作表</div></body></html>');
            excelWindow.document.close();
            return;
        } catch (e) {
            console.error('Excel 预览失败:', e);
            var confirmDownload = confirm('Excel 文件解析失败：' + e.message + '，是否下载后查看？');
            if (confirmDownload) downloadProductFile(productId, index);
            return;
        }
    }
    var confirmDownload2 = confirm('文件 "' + fileName + '" 暂不支持在线预览。\n是否下载后查看？');
    if (confirmDownload2) downloadProductFile(productId, index);
}

// ============================================================
//  ★★★ 图片预览模态框 ★★★
// ============================================================

function openImagePreview(productId, index) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product || !product.images || product.images.length === 0) {
        alert('没有图片可预览');
        return;
    }
    previewProductId = productId;
    previewImageIndex = index;
    if (previewImageIndex >= product.images.length) {
        previewImageIndex = 0;
    }

    var modal = document.getElementById('imagePreviewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'imagePreviewModal';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.setAttribute('data-bs-backdrop', 'static');
        modal.innerHTML = '<div class="modal-dialog modal-fullscreen"><div class="modal-content" style="background:rgba(10,37,64,0.95);border:none;border-radius:0;height:100vh;">' +
            '<div class="modal-header" style="border-bottom:none;padding:12px 20px;position:absolute;top:0;left:0;right:0;z-index:10;background:linear-gradient(180deg,rgba(0,0,0,0.5) 0%,transparent 100%);">' +
            '<span style="color:#fff;font-size:14px;" id="imagePreviewCounter">1 / 1</span>' +
            '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="关闭" onclick="closeImagePreview()" style="opacity:0.8;"></button></div>' +
            '<div class="modal-body" style="display:flex;align-items:center;justify-content:center;padding:60px 20px;position:relative;flex:1;">' +
            '<button class="btn btn-outline-light image-preview-arrow image-preview-arrow-left" onclick="prevImage()" style="position:absolute;left:20px;top:50%;transform:translateY(-50%);z-index:20;border-radius:50%;width:48px;height:48px;font-size:22px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);"><i class="bi bi-chevron-left"></i></button>' +
            '<div id="imagePreviewContainer" style="max-width:90vw;max-height:80vh;display:flex;align-items:center;justify-content:center;"><img id="imagePreviewImg" src="" alt="产品图片" style="max-width:100%;max-height:80vh;border-radius:8px;box-shadow:0 4px 40px rgba(0,0,0,0.4);" /></div>' +
            '<button class="btn btn-outline-light image-preview-arrow image-preview-arrow-right" onclick="nextImage()" style="position:absolute;right:20px;top:50%;transform:translateY(-50%);z-index:20;border-radius:50%;width:48px;height:48px;font-size:22px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.15);"><i class="bi bi-chevron-right"></i></button>' +
            '<div id="imagePreviewName" style="position:absolute;bottom:80px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.7);font-size:13px;z-index:10;background:rgba(0,0,0,0.5);padding:6px 16px;border-radius:20px;max-width:80%;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">产品图片</div></div>' +
            '<div class="modal-footer" style="border-top:1px solid rgba(255,255,255,0.1);padding:12px 20px;justify-content:center;background:rgba(0,0,0,0.3);position:absolute;bottom:0;left:0;right:0;z-index:10;">' +
            '<button class="btn btn-light" onclick="closeImagePreview()" style="border-radius:20px;padding:6px 30px;font-size:14px;font-weight:500;"><i class="bi bi-x-lg"></i> 关闭预览</button></div></div></div>';
        document.body.appendChild(modal);
    }

    updatePreviewImage();
    var bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    document.addEventListener('keydown', imagePreviewKeyHandler);
}

function closeImagePreview() {
    var modal = document.getElementById('imagePreviewModal');
    if (modal) {
        var bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
    }
    document.removeEventListener('keydown', imagePreviewKeyHandler);
    previewProductId = null;
    previewImageIndex = 0;
}

function updatePreviewImage() {
    var product = data.products.find(function(p) { return p.id === previewProductId; });
    if (!product || !product.images || product.images.length === 0) return;
    var img = document.getElementById('imagePreviewImg');
    var counter = document.getElementById('imagePreviewCounter');
    var nameEl = document.getElementById('imagePreviewName');
    var leftArrow = document.querySelector('.image-preview-arrow-left');
    var rightArrow = document.querySelector('.image-preview-arrow-right');

    if (img) {
        img.src = product.images[previewImageIndex] || '';
    }
    if (counter) {
        counter.textContent = (previewImageIndex + 1) + ' / ' + product.images.length;
    }
    if (nameEl) {
        nameEl.textContent = '产品图片 ' + (previewImageIndex + 1);
    }
    if (leftArrow) {
        leftArrow.style.display = previewImageIndex === 0 ? 'none' : 'flex';
    }
    if (rightArrow) {
        rightArrow.style.display = previewImageIndex >= product.images.length - 1 ? 'none' : 'flex';
    }
}

function prevImage() {
    if (previewProductId === null) return;
    var product = data.products.find(function(p) { return p.id === previewProductId; });
    if (!product || !product.images) return;
    if (previewImageIndex > 0) {
        previewImageIndex--;
        updatePreviewImage();
    }
}

function nextImage() {
    if (previewProductId === null) return;
    var product = data.products.find(function(p) { return p.id === previewProductId; });
    if (!product || !product.images) return;
    if (previewImageIndex < product.images.length - 1) {
        previewImageIndex++;
        updatePreviewImage();
    }
}

function imagePreviewKeyHandler(e) {
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevImage();
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextImage();
    } else if (e.key === 'Escape') {
        closeImagePreview();
    }
}

function fixProductData(productId) {
    var product = data.products.find(function(p) { return p.id === productId; });
    if (!product) { alert('产品不存在'); return; }
    try {
        var arr = JSON.parse(product.magnetDetail || '[]');
        if (!Array.isArray(arr)) arr = [];
        var fixedArr = arr.map(function(row) {
            if (!Array.isArray(row)) return ['', '', '', ''];
            while (row.length < 4) row.push('');
            return row.slice(0, 4).map(function(c) { return (c === null || c === undefined) ? '' : String(c).trim(); });
        }).filter(function(row) { return row.some(function(cell) { return cell.trim() !== ''; }); });
        product.magnetDetail = JSON.stringify(fixedArr);
        product.desc = fixedArr.length > 0 ? fixedArr.length + ' 种磁石规格' : '';
        // 修复 customerCode
        if (!product.customerCode && product.name) {
            product.customerCode = extractCustomerCode(product.name);
        }
        saveDataToStorage();
        refreshMagnetTable(productId);
        initProducts();
        alert('✅ 数据已修复！');
    } catch (e) {
        console.error('修复失败:', e);
        alert('修复失败，请检查控制台错误信息');
    }
}

function resetProductForm() {
    var form = document.getElementById('productForm');
    if (!form) return;
    form.reset();
    document.getElementById('productId').value = '';
    document.getElementById('productModalTitle').textContent = '新增产品';
    document.getElementById('productSubmitBtn').textContent = '保存';
    document.getElementById('productStatus').value = '在库';
    document.getElementById('productStock').value = 0;
}

function openProductModal(productId) {
    var form = document.getElementById('productForm');
    if (!form) return;
    resetProductForm();

    if (productId !== undefined && productId !== null && productId !== '') {
        var product = (data.products || []).find(function(item) { return String(item.id) === String(productId); });
        if (product) {
            document.getElementById('productId').value = product.id;
            document.getElementById('productCode').value = product.code || '';
            document.getElementById('productName').value = product.name || '';
            document.getElementById('customerCode').value = product.customerCode || '';
            document.getElementById('productSpec').value = product.spec || '';
            document.getElementById('productStock').value = product.stock || 0;
            document.getElementById('productStatus').value = product.status || '在库';
            document.getElementById('productRemark').value = product.remark || '';
            document.getElementById('productModalTitle').textContent = '编辑产品';
            document.getElementById('productSubmitBtn').textContent = '更新';
        }
    }

    var modal = new bootstrap.Modal(document.getElementById('productModal'));
    modal.show();
}

async function submitProductForm() {
    var form = document.getElementById('productForm');
    if (!form) return;
    if (!form.reportValidity()) return;

    var id = document.getElementById('productId').value;
    var payload = {
        code: document.getElementById('productCode').value.trim(),
        name: document.getElementById('productName').value.trim(),
        customerCode: document.getElementById('customerCode').value.trim(),
        spec: document.getElementById('productSpec').value.trim(),
        stock: Number(document.getElementById('productStock').value || 0),
        status: document.getElementById('productStatus').value || '在库',
        remark: document.getElementById('productRemark').value.trim()
    };

    if (!payload.code || !payload.name) {
        alert('产品编码和产品名称不能为空');
        return;
    }

    try {
        var method = id ? 'PUT' : 'POST';
        var url = id ? '/api/products/' + id : '/api/products';
        var response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        var result = await response.json().catch(function() { return {}; });
        if (!response.ok) {
            throw new Error(result.message || '保存失败');
        }

        var modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
        if (modal) modal.hide();
        await initProducts();
        alert(id ? '✅ 产品已更新' : '✅ 产品已新增');
    } catch (error) {
        console.error('保存产品失败:', error);
        alert(error.message || '保存失败，请重试');
    }
}

// ===== 删除单个产品 =====
async function deleteProduct(id) {
    if (!confirm('确定删除此产品吗？')) return;
    try {
        var response = await fetch('/api/products/' + id, { method: 'DELETE' });
        var result = await response.json().catch(function() { return {}; });
        if (!response.ok) {
            throw new Error(result.message || '删除失败');
        }
        await initProducts();
        alert('✅ 产品已删除');
    } catch (error) {
        console.error('删除产品失败:', error);
        alert(error.message || '删除失败，请重试');
    }
}

// ===== 清空所有产品数据 =====
async function clearAllProducts() {
    if (!confirm('⚠️ 确定要清空所有产品数据吗？此操作不可恢复！')) return;
    var confirmText = prompt('请输入 "确认删除" 以继续：');
    if (confirmText !== '确认删除') { alert('操作已取消'); return; }
    try {
        var response = await fetch('/api/products', { method: 'DELETE' });
        var result = await response.json().catch(function() { return {}; });
        if (!response.ok) {
            throw new Error(result.message || '清空失败');
        }
        await initProducts();
        alert('✅ 所有产品数据已清空');
    } catch (error) {
        console.error('清空产品失败:', error);
        alert(error.message || '清空失败，请重试');
    }
}

// ============================================================
//  暴露全局
// ============================================================

window.initProducts = initProducts;
window.importProductsFromExcel = importProductsFromExcel;
window.importProductTemplate = importProductTemplate;
window.exportProductTemplate = exportProductTemplate;
window.viewProductDetail = viewProductDetail;
window.openProductModal = openProductModal;
window.submitProductForm = submitProductForm;
window.deleteProduct = deleteProduct;
window.clearAllProducts = clearAllProducts;
window.saveMagnetTable = saveMagnetTable;
window.deleteMagnetRow = deleteMagnetRow;
window.addMagnetRow = addMagnetRow;
window.refreshMagnetTable = refreshMagnetTable;
window.fixProductData = fixProductData;
window.parseMagnetRow = parseMagnetRow;
window.setCustomerFilter = setCustomerFilter;
window.renderQuickFilterButtons = renderQuickFilterButtons;

if (document.getElementById('productSubmitBtn')) {
    document.getElementById('productSubmitBtn').addEventListener('click', submitProductForm);
}

if (document.getElementById('productForm')) {
    document.getElementById('productForm').addEventListener('submit', function(event) {
        event.preventDefault();
        submitProductForm();
    });
}
window.populateCustomerFilter = populateCustomerFilter;
window.uploadProductImages = uploadProductImages;
window.uploadProductFiles = uploadProductFiles;
window.removeProductImage = removeProductImage;
window.removeProductFile = removeProductFile;
window.refreshProductMedia = refreshProductMedia;
window.downloadProductFile = downloadProductFile;
window.previewProductFile = previewProductFile;
window.openImagePreview = openImagePreview;
window.closeImagePreview = closeImagePreview;
window.prevImage = prevImage;
window.nextImage = nextImage;
window.updatePreviewImage = updatePreviewImage;
window.imagePreviewKeyHandler = imagePreviewKeyHandler;
window.addMaterialRow = addMaterialRow;
window.deleteMaterialRow = deleteMaterialRow;
window.saveMaterialTable = saveMaterialTable;
window.refreshMaterialTable = refreshMaterialTable;
window.extractBoardSummary = extractBoardSummary;
window.extractShellSummary = extractShellSummary;
window.getLinkedProduct = getLinkedProduct;
window.getMaterialType = getMaterialType;
window.updateMaterialType = updateMaterialType;