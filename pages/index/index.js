const app = getApp();

Page({
  data: {
    cur: 'eat',
    items: [],
    spinning: false,
    showResultCard: false,
    resultText: ''
  },

  onLoad(options) {
    // 分享进入时带 cat 参数；同步设置 this.data.cur 避免 onShow 读取滞后
    if (options && options.cat && ['eat', 'play', 'custom'].includes(options.cat)) {
      this.data.cur = options.cat;
    }
    this.refreshItems();
  },

  onShow() {
    // 从管理页返回时重新读取（管理页可能已修改数据）
    this.refreshItems();
  },

  refreshItems() {
    const cats = app.globalData.categories;
    const cur = this.data.cur;
    const cat = cats[cur];
    const items = (cat && cat.items) ? cat.items : [];
    this.setData({ items: items.slice() });
  },

  switchCat(e) {
    if (this.data.spinning) return; // 旋转中禁止切分类，避免状态错乱
    const cat = e.currentTarget.dataset.cat;
    if (cat === this.data.cur) return;
    const wheel = this.selectComponent('#wheel');
    if (wheel) wheel.resetRotation();
    this.setData({ cur: cat, showResultCard: false });
    this.refreshItems();
  },

  onResult(e) {
    const val = e.detail.value;
    if (val) this.setData({ showResultCard: true, resultText: val.text });
  },

  onSpinStat(e) {
    this.setData({ spinning: e.detail.spinning });
  },

  closeResult() {
    this.setData({ showResultCard: false });
  },

  spinAgain() {
    this.setData({ showResultCard: false });
    const wheel = this.selectComponent('#wheel');
    if (wheel) wheel.spin();
  },

  goManage() {
    if (this.data.spinning) return; // 旋转中锁定入口，防止切入管理页错乱
    wx.navigateTo({ url: '/pages/manage/manage?cat=' + this.data.cur });
  },

  noop() {},

  onShareAppMessage() {
    return {
      title: '帮我决定今天吃什么玩什么！',
      path: '/pages/index/index?cat=' + this.data.cur
    };
  },

  onShareTimeline() {
    return {
      title: '帮我决定今天吃什么玩什么！',
      query: 'cat=' + this.data.cur
    };
  }
});
