// ============================================================
//  高亮（多色底色）管理 - 通用模块
//  版本：1.0.0
//  
//  用法：
//    const highlight = new HighlightManager('order', {
//        getSelectedIds: () => { ... 返回选中ID数组 ... },
//        renderCallback: () => { ... 刷新表格 ... },
//        idAttribute: 'data-order-id'  // 可选，默认为 data-row-id
//    });
//    
//    highlight.apply('#fff3cd');   // 为选中行添加底色
//    highlight.clear();            // 清除选中行底色
//    highlight.getColor(id);       // 获取某行的底色
//    highlight.setColor(id, color); // 设置某行底色（不刷新表格）
//    highlight.load();             // 重新加载状态
//    highlight.save();             // 手动保存状态
// ============================================================

(function() {
    'use strict';

    /**
     * HighlightManager - 多色底色管理类
     * @param {string} moduleName - 模块标识，用于生成 localStorage 键名，如 'order'
     * @param {Object} options - 配置选项
     * @param {Function} options.getSelectedIds - 返回当前选中行 ID 数组的函数
     * @param {Function} options.renderCallback - 刷新表格的回调函数
     * @param {string} [options.idAttribute='data-row-id'] - 用于标识行的属性名
     */
    function HighlightManager(moduleName, options) {
        // 参数校验
        if (!moduleName || typeof moduleName !== 'string') {
            throw new Error('HighlightManager: moduleName 必须是一个非空字符串');
        }
        if (!options || typeof options !== 'object') {
            throw new Error('HighlightManager: options 必须是一个对象');
        }
        if (typeof options.getSelectedIds !== 'function') {
            throw new Error('HighlightManager: options.getSelectedIds 必须是一个函数');
        }
        if (typeof options.renderCallback !== 'function') {
            throw new Error('HighlightManager: options.renderCallback 必须是一个函数');
        }

        this.moduleName = moduleName;
        this.storageKey = 'erp_highlight_' + moduleName;
        this.getSelectedIds = options.getSelectedIds;
        this.renderCallback = options.renderCallback;
        this.idAttribute = options.idAttribute || 'data-row-id';
        this.state = {};

        // 自动加载状态
        this.load();

        console.log('✅ HighlightManager 已初始化 [模块: ' + moduleName + ']');
    }

    /**
     * 从 localStorage 加载状态
     */
    HighlightManager.prototype.load = function() {
        try {
            var stored = localStorage.getItem(this.storageKey);
            if (stored) {
                var parsed = JSON.parse(stored);
                // 确保是对象
                if (typeof parsed === 'object' && parsed !== null) {
                    this.state = parsed;
                } else {
                    this.state = {};
                }
            } else {
                this.state = {};
            }
        } catch (e) {
            console.warn('⚠️ HighlightManager [' + this.moduleName + '] 加载状态失败:', e);
            this.state = {};
        }
        return this;
    };

    /**
     * 保存状态到 localStorage
     */
    HighlightManager.prototype.save = function() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (e) {
            console.warn('⚠️ HighlightManager [' + this.moduleName + '] 保存状态失败:', e);
        }
        return this;
    };

    /**
     * 获取某行的颜色
     * @param {string|number} id - 行标识
     * @returns {string|null} 颜色值，不存在则返回 null
     */
    HighlightManager.prototype.getColor = function(id) {
        if (id === undefined || id === null) return null;
        var key = String(id);
        return this.state[key] || null;
    };

    /**
     * 设置某行颜色（不自动刷新表格）
     * @param {string|number} id - 行标识
     * @param {string|null} color - 颜色值，null 表示清除
     */
    HighlightManager.prototype.setColor = function(id, color) {
        if (id === undefined || id === null) return this;
        var key = String(id);
        if (color) {
            this.state[key] = color;
        } else {
            delete this.state[key];
        }
        this.save();
        return this;
    };

    /**
     * 批量设置颜色（不自动刷新表格）
     * @param {Array<string|number>} ids - 行标识数组
     * @param {string|null} color - 颜色值，null 表示清除
     */
    HighlightManager.prototype.setColors = function(ids, color) {
        if (!Array.isArray(ids) || ids.length === 0) return this;
        var self = this;
        ids.forEach(function(id) {
            self.setColor(id, color);
        });
        return this;
    };

    /**
     * 为选中的行添加底色（自动刷新表格）
     * @param {string} color - 颜色值（CSS 颜色字符串）
     */
    HighlightManager.prototype.apply = function(color) {
        if (!color || typeof color !== 'string') {
            console.warn('⚠️ HighlightManager [' + this.moduleName + '] apply: 颜色值无效');
            return this;
        }

        var ids = this.getSelectedIds();
        if (!Array.isArray(ids) || ids.length === 0) {
            alert('请先勾选需要添加底色的行');
            return this;
        }

        var self = this;
        ids.forEach(function(id) {
            self.setColor(id, color);
        });

        // 刷新表格
        this.renderCallback();

        // 恢复选中状态
        this._restoreSelected(ids);

        return this;
    };

    /**
     * 清除选中行的底色（自动刷新表格）
     */
    HighlightManager.prototype.clear = function() {
        var ids = this.getSelectedIds();
        if (!Array.isArray(ids) || ids.length === 0) {
            alert('请先勾选需要清除底色的行');
            return this;
        }

        var self = this;
        ids.forEach(function(id) {
            self.setColor(id, null);
        });

        // 刷新表格
        this.renderCallback();

        // 恢复选中状态
        this._restoreSelected(ids);

        return this;
    };

    /**
     * 清除所有行的底色（不检查选中，自动刷新表格）
     */
    HighlightManager.prototype.clearAll = function() {
        if (!confirm('确定要清除所有行的底色吗？')) return this;

        var keys = Object.keys(this.state);
        if (keys.length === 0) {
            alert('没有底色需要清除');
            return this;
        }

        this.state = {};
        this.save();
        this.renderCallback();

        return this;
    };

    /**
     * 获取所有设置了底色的行 ID
     * @returns {Array<string>} 行 ID 数组
     */
    HighlightManager.prototype.getAllHighlightedIds = function() {
        return Object.keys(this.state);
    };

    /**
     * 获取所有设置了底色的行 ID 及其颜色
     * @returns {Object} { id: color, ... }
     */
    HighlightManager.prototype.getAllHighlights = function() {
        return JSON.parse(JSON.stringify(this.state));
    };

    /**
     * 获取状态统计信息
     * @returns {Object} { total: 总数, colors: { color: count, ... } }
     */
    HighlightManager.prototype.getStats = function() {
        var keys = Object.keys(this.state);
        var colorCount = {};
        var self = this;
        keys.forEach(function(key) {
            var color = self.state[key];
            if (color) {
                colorCount[color] = (colorCount[color] || 0) + 1;
            }
        });
        return {
            total: keys.length,
            colors: colorCount
        };
    };

    /**
     * 恢复选中状态（内部辅助方法）
     * @param {Array<string>} ids - 需要恢复选中的 ID 数组
     * @private
     */
    HighlightManager.prototype._restoreSelected = function(ids) {
        if (!Array.isArray(ids) || ids.length === 0) return;

        var self = this;
        var selector = 'input[type="checkbox"][' + this.idAttribute + ']';
        var checkboxes = document.querySelectorAll(selector);

        // 将 ids 转为字符串数组以便比较
        var idSet = {};
        ids.forEach(function(id) {
            idSet[String(id)] = true;
        });

        checkboxes.forEach(function(cb) {
            var id = cb.getAttribute(self.idAttribute);
            if (id && idSet[id]) {
                cb.checked = true;
            }
        });

        // 如果有更新选中计数的函数，调用它
        if (typeof window.updateSelectedCount === 'function') {
            window.updateSelectedCount();
        }
        if (typeof window.updateInventorySelectedCount === 'function') {
            window.updateInventorySelectedCount();
        }
        if (typeof window.updateDetailSelectedCount === 'function') {
            window.updateDetailSelectedCount();
        }
        if (typeof window.updateOrderSelectedCount === 'function') {
            window.updateOrderSelectedCount();
        }
    };

    /**
     * 销毁实例（清除引用，但不清除数据）
     */
    HighlightManager.prototype.destroy = function() {
        // 清除对外部函数的引用，帮助垃圾回收
        this.getSelectedIds = null;
        this.renderCallback = null;
        console.log('🗑️ HighlightManager [' + this.moduleName + '] 已销毁');
    };

    // ============================================================
    //  全局注册（支持直接使用 new HighlightManager(...)）
    // ============================================================

    // 如果全局已经存在 HighlightManager，不覆盖
    if (typeof window.HighlightManager === 'undefined') {
        window.HighlightManager = HighlightManager;
        console.log('✅ HighlightManager 已注册到全局');
    } else {
        console.warn('⚠️ HighlightManager 已存在，跳过注册');
    }

})();