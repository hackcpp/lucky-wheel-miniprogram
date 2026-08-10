# 幸运转盘 · 微信小程序

> 帮选择困难症决定「今天吃什么、玩什么」。

一个**纯前端、零后端、零网络请求**的微信小程序。所有数据存在本机 `wx.storage`，打开即用，不收集任何用户信息。

- 页面数：2（首页 / 管理页）
- 自定义组件：1（Canvas 2D 转盘）
- 依赖：无第三方库，原生小程序框架
- 主包体积：< 100 KB（远低于 2 MB 限制）

---

## 功能

| 功能 | 说明 |
| --- | --- |
| 三套分类 | 「吃什么」「玩什么」「自定义」，Tab 一键切换 |
| Canvas 转盘 | 60fps 缓动旋转（ease-out cubic），3.5s 转 5 圈后精准停在结果扇区 |
| 权重抽奖 | 每个选项可设 1–5 级权重，权重越高越容易被抽中 |
| 选项管理 | 增 / 删 / 调权重，实时持久化到本地存储 |
| 结果卡片 | 弹出中奖结果，支持「再来一次」 |
| 分享 | 支持转发好友与分享朋友圈，链接携带当前分类 |

### 关于权重的设计取舍

**权重只影响中奖概率，不改变扇区大小**——转盘始终等分绘制（`2π / n`）。

这是刻意的：如果扇区按权重画成不等分，1:5 的权重会让小扇区窄到看不清文字，视觉体验很差。当前方案是"看起来公平、实际有偏好"，用户感知上更舒服。

实现上先用 `weightedPick()` 按权重抽出目标索引，再反推转盘该停在哪个角度，因此**动画落点与结果永远一致**，不存在"转到 A 却提示 B"的问题。

---

## 快速开始

```bash
git clone https://github.com/hackcpp/lucky-wheel-miniprogram.git
```

1. 用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)导入项目根目录
2. 填入自己的 AppID（或选「测试号」）——`project.config.json` 里的 `appid` 需替换成你自己的
3. 基础库建议 ≥ 2.9.0（Canvas 2D 接口要求）
4. 直接编译运行，无需安装任何依赖

> 项目未使用 npm，无 `node_modules`，不需要「构建 npm」。

---

## 项目结构

```
.
├── app.js                    # App 生命周期；globalData 持有 categories 与 activeCat
├── app.json                  # 全局配置（页面路由、窗口、lazyCodeLoading）
├── app.wxss                  # 全局样式与主题色变量
├── sitemap.json              # 微信搜索索引配置
├── project.config.json       # 开发者工具项目配置
├── components/
│   └── wheel/                # Canvas 2D 转盘组件（绘制 + 旋转动画 + 权重抽奖）
├── pages/
│   ├── index/                # 首页：分类 Tab、转盘、结果卡、分享
│   └── manage/               # 管理页：选项增删改、权重调节
├── utils/
│   ├── presets.js            # 三套分类的预设选项
│   └── storage.js            # 本地存储读写 + 版本兼容补齐
└── docs/
    ├── PLAN.md               # 开发计划与需求拆解
    ├── overview.md           # 项目概览
    └── prototype.html        # 交互原型（浏览器直接打开）
```

---

## 技术实现要点

### 1. Canvas 2D + requestAnimationFrame，不用 setData 驱动动画

转盘旋转的每一帧都走 `canvas.requestAnimationFrame(step)` 直接重绘，**全程不调用 `setData`**。

```js
const step = () => {
  const t = Math.min((Date.now() - startTs) / duration, 1);
  const eased = 1 - Math.pow(1 - t, 3);   // ease-out cubic
  this.drawWheel(startRot + delta * eased);
  if (t < 1) canvas.requestAnimationFrame(step);
};
```

小程序是双线程架构，每次 `setData` 都要跨 JS ↔ 渲染层通信。如果按 60fps 用 `setData` 驱动动画，3.5 秒就是 210 次跨线程调用，低端安卓机必卡。只在动画结束时 `setData` 一次同步最终角度。

### 2. 扇区配色统一用 HEX，不用 hsl()

微信小程序**真机** Canvas 2D 对 `hsl()` 字符串支持不全，会静默回退成默认色，导致模拟器正常、真机配色错乱。

因此组件内置了 `hslToHex()`，在单一绿色系（H=150, S=46%）上按明度 92% → 60% 生成等差梯度：

```js
const L = Lmax - (Lmax - Lmin) * i / (n - 1);
```

相邻扇区色差恒定、首尾差最大，**奇数个扇区也不会首尾撞色**。

### 3. `globalData.activeCat` 作为分类的单一真相源

小程序的生命周期顺序是：**返回时首页 `onShow` 先执行，管理页 `onUnload` 后执行**。

所以「管理页在 `onUnload` 里回写分类给首页」这种写法必然错位——首页已经用旧分类刷完界面了，回写才姗姗来迟。本项目改为管理页在 `onLoad` / `switchCat` 时**实时**写入 `app.globalData.activeCat`，首页 `onShow` 直接以它为准，从根上消除时序竞态。

同时注意：**更新分类必须用 `setData`**。直接 `this.data.cur = xxx` 不触发视图更新，会出现"列表内容对了、Tab 高亮没变"的诡异现象。

### 4. 存储的版本兼容补齐

`storage.load()` 以当前版本的预设结构为基准，再用本地存储值**逐分类覆盖**：

```js
const base = JSON.parse(JSON.stringify(PRESETS.DEFAULTS));
for (const k of Object.keys(base)) {
  if (s[k] && Array.isArray(s[k].items)) base[k] = s[k];
}
```

这样老用户升级后新增的分类会自动补默认值，不会因为 `cats['custom']` 为 `undefined` 而在访问 `.items` 时白屏。

### 5. 其它细节

- `lazyCodeLoading: "requiredComponents"` — 按需注入组件代码，缩短启动耗时
- 旋转过程中锁定分类切换与管理页入口，防止状态错乱
- 转盘文字超过 5 字自动截断加省略号，避免溢出扇区
- Canvas 节点未就绪时 100ms 后重试初始化，规避 `ready` 时机不稳的问题

---

## 数据模型

```js
{
  eat: {
    name: '吃什么',
    items: [{ text: '火锅', weight: 1 }, ...]
  },
  play:   { name: '玩什么', items: [...] },
  custom: { name: '自定义', items: [...] }
}
```

- 存储键：`wheel_categories`
- `weight` 取值 1–5，默认 1
- 全量读写（数据量极小，无需增量同步）

---

## 隐私与合规

本小程序**不发起任何网络请求**，不接入服务器，不采集、不上传任何用户数据。所有选项仅存储于用户本机，卸载即清除。

因此无需配置服务器域名白名单、无需 ICP 备案、无需隐私政策弹窗。适合以**个人主体**注册后提交审核（类目建议选「工具」）。

---

## Roadmap

- [ ] 抽奖历史记录
- [ ] 转盘旋转音效与震动反馈
- [ ] 结果卡生成分享海报图
- [ ] 多套自定义转盘（不止一个 custom）

---

## License

MIT
