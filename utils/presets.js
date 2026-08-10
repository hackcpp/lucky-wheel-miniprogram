// 预设分类数据（含默认权重）。weight 默认 1，范围 1–5。
// 以下仅为初始默认值；三类分类在管理页均可自由增删改（含吃什么/玩什么）。
const DEFAULTS = {
  eat: {
    name: '吃什么',
    items: [
      { text: '火锅', weight: 1 },
      { text: '烧烤', weight: 1 },
      { text: '麻辣烫', weight: 1 },
      { text: '炒菜', weight: 1 },
      { text: '面食', weight: 1 },
      { text: '寿司', weight: 1 },
      { text: '轻食沙拉', weight: 1 },
      { text: '快餐', weight: 1 }
    ]
  },
  play: {
    name: '玩什么',
    items: [
      { text: '看电影', weight: 1 },
      { text: '打游戏', weight: 1 },
      { text: '逛街', weight: 1 },
      { text: '运动', weight: 1 },
      { text: '在家躺', weight: 1 },
      { text: '读书', weight: 1 },
      { text: '看剧', weight: 1 },
      { text: '约朋友', weight: 1 },
      { text: '旅行', weight: 1 },
      { text: '看展', weight: 1 }
    ]
  },
  custom: {
    name: '自定义',
    items: [
      { text: '下楼走走', weight: 1 },
      { text: '刷会视频', weight: 1 },
      { text: '发会呆', weight: 1 },
      { text: '随便逛逛', weight: 1 },
      { text: '学点新东西', weight: 1 }
    ]
  }
};

module.exports = { DEFAULTS };
