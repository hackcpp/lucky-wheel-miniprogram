App({
  globalData: {
    categories: null,
    // 当前激活分类的单一真相源：首页与管理页共享，避免往返时 cur 与 items 错位
    activeCat: 'eat'
  },
  onLaunch() {
    // 启动时初始化本地分类（storage.load 内部做版本兼容补齐）
    const storage = require('./utils/storage.js');
    this.globalData.categories = storage.load();
  }
});
