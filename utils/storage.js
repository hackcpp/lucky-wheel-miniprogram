// 本地存储工具：分类选项的读写 + 版本兼容补齐
const PRESETS = require('./presets.js');
const STORAGE_KEY = 'wheel_categories';
const VERSION = 1;

// 权重规范化：防御 storage 脏数据（手动篡改 / 旧版迁移导致 weight 变成非数字或越界）。
// 非有限数或 <=0 一律回退 1；超出 1–5 的整数范围则 clamp 到边界，并四舍五入取整。
function normalizeWeight(w) {
  const n = Number(w);
  if (!isFinite(n) || n <= 0) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

// 以当前版本预设结构为基准，用存储值逐分类覆盖；
// 旧版本数据缺某分类（如早期无 custom）时用默认补齐，避免新分类为 undefined 访问 .items 抛错。
function load() {
  const base = JSON.parse(JSON.stringify(PRESETS.DEFAULTS));
  try {
    const s = wx.getStorageSync(STORAGE_KEY);
    if (s && typeof s === 'object') {
      for (const k of Object.keys(base)) {
        if (s[k] && Array.isArray(s[k].items)) {
          base[k] = s[k];
        }
      }
    }
  } catch (e) {}

  // 规范化所有权重为 1–5 的整数，确保抽样与加减权重逻辑不受脏数据影响
  for (const k of Object.keys(base)) {
    const cat = base[k];
    if (cat && Array.isArray(cat.items)) {
      cat.items.forEach((it) => { it.weight = normalizeWeight(it.weight); });
    }
  }
  return base;
}

function save(data) {
  try {
    wx.setStorageSync(STORAGE_KEY, data);
  } catch (e) {}
}

module.exports = { load, save, STORAGE_KEY, VERSION };
