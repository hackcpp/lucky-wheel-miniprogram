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
    // 分享进入时带 cat 参数；与 globalData.activeCat 保持同步
    let cat = 'eat';
    if (options && options.cat && ['eat', 'play', 'custom'].includes(options.cat)) {
      cat = options.cat;
    }
    app.globalData.activeCat = cat;
    this.setData({ cur: cat });
    this.refreshItems(cat);
  },

  onShow() {
    // 从管理页返回时：以 activeCat 为准（管理页切换分类时已实时同步），
    // 清掉残留结果卡并把转盘角度归位，避免 cur/items/角度错位。
    const cat =
      app.globalData.activeCat && ['eat', 'play', 'custom'].includes(app.globalData.activeCat)
        ? app.globalData.activeCat
        : this.data.cur;
    this.setData({ cur: cat, showResultCard: false });
    this.refreshItems(cat);
    const wheel = this.selectComponent('#wheel');
    if (wheel) wheel.resetRotation();
  },

  refreshItems(cur) {
    cur = cur || this.data.cur;
    const cats = app.globalData.categories;
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
    app.globalData.activeCat = cat; // 同步，保证进管理页/返回时分类一致
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
