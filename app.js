App({
  globalData: {
    categories: null
  },
  onLaunch() {
    // 启动时初始化本地分类（storage.load 内部做版本兼容补齐）
    const storage = require('./utils/storage.js');
    this.globalData.categories = storage.load();
  }
});
