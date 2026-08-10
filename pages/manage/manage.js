const app = getApp();

Page({
  data: {
    cur: 'eat',
    items: [],
    newName: '',
    weights: [1, 2, 3, 4, 5],
    newWeightIdx: 0
  },

  onLoad(options) {
    let cat = 'eat';
    if (options && options.cat && ['eat', 'play', 'custom'].includes(options.cat)) {
      cat = options.cat;
    }
    // 必须用 setData 更新 cur，否则 Tab 高亮不会刷新（直接赋值 this.data.cur 不触发视图更新）
    this.setData({ cur: cat });
    // 实时同步激活分类给首页；不再等 onUnload 回写，避免首页 onShow 先于
    // onUnload 执行导致 cur 与 items 错位。
    app.globalData.activeCat = cat;
    this.refresh();
  },

  // 返回首页前无需回写 cur：分类已在加载/切换时实时同步到 globalData.activeCat

  refresh() {
    const cats = app.globalData.categories;
    const cur = this.data.cur;
    const cat = cats[cur];
    const items = (cat && cat.items) ? cat.items : [];
    this.setData({ items: items.slice() });
  },

  switchCat(e) {
    const cat = e.currentTarget.dataset.cat;
    if (cat === this.data.cur) return;
    this.setData({ cur: cat });
    app.globalData.activeCat = cat; // 实时同步，返回首页时保持一致
    this.refresh();
  },

  onNameInput(e) {
    this.setData({ newName: e.detail.value });
  },

  onWeightChange(e) {
    this.setData({ newWeightIdx: Number(e.detail.value) });
  },

  inc(e) {
    const i = e.currentTarget.dataset.i;
    const items = this.data.items.slice();
    items[i].weight = Math.min(5, items[i].weight + 1);
    this.commit(items);
  },

  dec(e) {
    const i = e.currentTarget.dataset.i;
    const items = this.data.items.slice();
    items[i].weight = Math.max(1, items[i].weight - 1);
    this.commit(items);
  },

  del(e) {
    const i = e.currentTarget.dataset.i;
    const items = this.data.items.slice();
    items.splice(i, 1);
    this.commit(items);
  },

  add() {
    const name = (this.data.newName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }
    const w = this.data.weights[this.data.newWeightIdx];
    const items = this.data.items.slice();
    const exist = items.find(x => x.text === name);
    if (exist) exist.weight = w; // 同名则更新权重
    else items.push({ text: name, weight: w });
    this.setData({ newName: '' });
    this.commit(items);
  },

  // 写入 globalData 并持久化；首页 onShow 会重新读取
  commit(items) {
    const cats = app.globalData.categories;
    cats[this.data.cur].items = items;
    const storage = require('../../utils/storage.js');
    storage.save(cats);
    this.setData({ items: items.slice() });
  },

  noop() {}
});
