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
    if (options && options.cat && ['eat', 'play', 'custom'].includes(options.cat)) {
      this.data.cur = options.cat;
    }
    this.refresh();
  },

  // 返回首页前：把当前分类同步回父页，保持首页 Tab 高亮与转盘一致
  onUnload() {
    const pages = getCurrentPages();
    const prev = pages[pages.length - 2];
    if (prev) prev.setData({ cur: this.data.cur });
  },

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
