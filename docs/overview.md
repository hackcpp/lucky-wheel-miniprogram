# 幸运转盘小程序 · 实现概览

> 状态：**代码已完成**（按 Plan v1.2），下一步用微信开发者工具编译联调 + 提审发布。
> 形态：纯前端小程序，零后端、零域名，本地 `wx.storage` 存储。

## 如何运行

1. 打开**微信开发者工具** → 「导入项目」→ 目录选 `D:\Work\lucky-wheel`。
2. AppID 已填真实小程序 AppID（`wx1310aa70dcd3e3fe`）；若要换号，到 mp.weixin.qq.com 注册个人主体后在 `project.config.json` 替换。
3. 编译后即可在模拟器看到：首页转盘 + 分类 Tab（吃什么/玩什么/自定义）+ 管理入口。
4. **真机预览 / 上传前**：AppID 已就位，直接编译即可；如需换号，到 mp.weixin.qq.com 注册个人主体后替换 `project.config.json` 里的 `appid`。

## 已实现（对照 Plan 里程碑 ①→⑤）

| 阶段 | 文件 | 内容 |
|---|---|---|
| ① 脚手架 | `app.json` `app.js` `app.wxss` `project.config.json` `sitemap.json` | 页面路由、窗口、简约清新全局样式、游客模式 AppID |
| ② 数据层 | `utils/presets.js` `utils/storage.js` | 吃/玩/自定义预设（含权重 1–5）；`load`（版本兼容补齐）/ `save` 走 `wx.storage` |
| ③ 转盘组件 | `components/wheel/`（js/json/wxml/wxss） | canvas 2d 等分绘制 + 单色系明度梯度配色 + 按权重随机 + ease-out 3.5s 旋转（`canvas.requestAnimationFrame`，禁 setData）+ 中心「开始」按钮 + `result`/`spinstat` 事件 |
| ④ 首页 | `pages/index/`（4 文件） | 分类 Tab + 转盘 + 结果卡片（就它了 / 再转一次）+ 管理入口（旋转中禁用）+ 转发分享 |
| ⑤ 管理页 | `pages/manage/`（4 文件） | 分类 Tab（与首页同步）+ 选项增删改 + 权重 1–5（±按钮）+ 持久化 |

## 关键实现点

- **指针固定 12 点 = `-π/2`**；结果用预先按权重随机选中的索引，动画停的位置与结果严格一致。
- **扇区等分**；权重仅影响概率（`weightedPick`），不体现于盘面大小。
- **旋转中锁定**：禁用「开始」按钮 + 禁用「管理选项」入口，防止切换状态错乱。
- **切分类重置旋转角**；首页 ↔ 管理页 `cur` 通过 `app.globalData.activeCat` 实时同步（切换分类即写入，不再等 `onUnload` 回写，避免首页 `onShow` 先于 `onUnload` 执行造成错位）。
- **本地存储版本兼容**：以 `DEFAULTS` 为基准补齐，旧数据缺某分类也不崩。

## 发布前自查（个人主体）

- 类目选「工具」；名称 / 简介 / 头像提前备好（参考 PLAN.md 第 11.6 节候选）。
- 本版无需隐私声明 / ICP 备案 / 认证费 / 微信支付。
- 主包体积远小于 2MB（纯前端、无图片资源），无 `wx.request` 故无需域名白名单。

## 待联调验证清单

- [ ] 微信开发者工具编译无报错、无警告
- [ ] 转盘旋转顺滑、停下准确指向选中扇区中心
- [ ] 三类切换正常重绘；管理页增删改即时生效并持久化
- [ ] 「分享给好友」「分享到朋友圈」卡片正常弹出
- [ ] 真机预览（iOS / Android 各一次）动画与性能 OK
