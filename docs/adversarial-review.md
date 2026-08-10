# 幸运转盘小程序 · 对抗性审查报告

> 审查对象：当前仓库代码（Plan v1.2 落地版，19 个文件）
> 审查视角：以"找茬/挑刺"为目的，模拟严苛的代码评审 + 微信审核 + 真机边界场景
> 结论概览：架构清晰、转盘落点数学正确、动画未每帧 setData（核心约束达标）。
> 但存在 **1 个数值健壮性隐患、1 个计划在文档里已识别却未落地的上限问题、若干文档与实现不一致、以及若干打磨项**。无会导致崩溃的高危缺陷。

---

## ✅ 修复状态（2026-08-10）

| 项 | 状态 | 改动文件 |
|---|---|---|
| [H1] 数值健壮性（字符串权重恒中末项 / 绕过上限） | **已修复** | `utils/storage.js`（新增 `normalizeWeight` + `load` 规范化）、`components/wheel/wheel.js`（`weightedPick` 防御规范化）、`pages/manage/manage.js`（`inc`/`dec`/`add` 运算前 `Number()`） |
| [M1] 选项数量无上限（PLAN 计划 16 项未落地） | **已修复** | `pages/manage/manage.js`（`add` 超 16 拒绝） |
| [M2-1] presets 注释"eat/play 固定预设"与实现不符 | **已修复** | `utils/presets.js` 注释 |
| [M2-2] overview 称 `manage.onUnload` 回写父页 | **已修复** | `docs/overview.md`（改为 `globalData.activeCat` 实时同步） |
| [M2-3] overview 路径 `D:\Work\mini` 与真实不符 | **已修复** | `docs/overview.md` 路径更正 |
| ⚠️ 措辞"中奖"→"抽中/结果" | **已修复** | `README.md` 两处 |
| [M3] 切分类瞬间 items observer 用旧 rotation 重绘（约 1 帧闪烁） | **已修复** | `components/wheel/wheel.js`（observer 重绘前归位 `-π/2`） |
| [M4] 旋转中切后台→回前台动画被"吃掉"直接落定 | **已修复** | `components/wheel/wheel.js`（基于累计可见时间的暂停/续播 + `pageLifetimes` show/hide）；`pages/index/index.js`（onShow 仅在非旋转时 resetRotation） |
| [L1] `getSystemInfoSync` 废弃告警 | **已修复** | `components/wheel/wheel.js`（优先 `getWindowInfo`，仅极旧基础库降级）；`README.md` 基础库建议提至 ≥2.20.1 |
| [L2] `urlCheck:false` 留坑 | **已修复** | `project.config.json`、`project.private.config.json` 均改为 `true` |
| [L4] 管理页无 `onShareAppMessage` | **已修复** | `pages/manage/manage.js` 新增（分享卡片回首页并带当前分类） |
| [L5] 同名新增仅精确匹配无反馈 | **已修复** | `pages/manage/manage.js`（`add` 同名更新后 toast「已更新权重」） |
| [L6] 死代码 `desired<=startRot` | **已修复** | `components/wheel/wheel.js`（已删除） |
| [L7] 朋友圈分享没配图 | **已修复** | `components/wheel/wheel.js`（`exportImage`/`getShareImage` 导出转盘图）；`pages/index/index.js`（`onShareTimeline` 带 `imageUrl`） |
| [L3] AppID 明文入库 + private.config 应 gitignore | **已满足** | `project.private.config.json` 已在 `.gitignore`；`project.config.json` 中 AppID 为项目公开标识、需随配置入库（AppID 本身公开，非密钥），无需隐藏 |

> 全部审查项已闭环（高优/正确性隐患 + 打磨项均修复或标注满足）。改动均为就地编辑，未提交 git。

---

## 🔴 高优 / 正确性隐患

### [H1] `weightedPick` 未做数值校验 —— 字符串权重会让抽奖"恒中最后一项"
**位置**：`components/wheel/wheel.js:121-130`

```js
let total = 0;
for (const it of items) total += (it.weight || 1);   // ← 若 it.weight 是字符串 "1"
let r = Math.random() * total;                        // "111" * Math.random() → NaN
```

- 当 `it.weight` 为字符串时，`total += "1"` 触发**字符串拼接**，`total` 变成 `"111…"`；`Math.random() * "111"` 得到 `NaN`，后续 `r -= (…)` 后 `r < 0` 永不成立，循环跑完返回 `items.length - 1` —— **永远抽中最后一项**。
- 同样隐患在 `manage.js:51-63` 的 `inc/dec`：`items[i].weight + 1` 对字符串会拼接成 `"11"`，再 `Math.min(5, "11")` 绕过上限，写入 11 甚至更大。
- **正常路径没问题**：本版所有写入（picker/inc/dec/add）都是数字，所以日常使用不会触发。但 `wx.storage` 是用户可改的本地数据，一旦用户手动改存储、或从"把 weight 写成字符串"的历史版本迁移，就会静默出错。
- **修复建议**：在 `weightedPick` 与 `inc/dec` 入口统一 `Number()` 并 clamp：
  ```js
  const w = Math.max(1, Math.min(5, Number(it.weight) || 1));
  ```

---

## 🟠 中优 / 体验与"计划未落地"

### [M1] 选项数量无上限 —— PLAN §9 已识别风险但代码没做
**位置**：`pages/manage/manage.js:72-85`（add 无上限判断）；`components/wheel/wheel.js:59-68`（配色）

- PLAN.md §9 明确列了风险「选项过多(>12) 扇形过窄、文字挤」，应对是"限制单类上限(如 16)"。但**实现里完全没有这个上限**。
- 后果：用户狂加选项后，单色系明度梯度 `L∈[92%,60%]` 在 n 很大时相邻色差趋近 0 → 扇区几乎同色；文字截断 5 字 + 扇区变窄 → 大面积重叠、不可读；每帧绘制扇区数上升，低端机掉帧。
- **修复建议**：在 `add()` 开头加 `if (items.length >= 16) { wx.showToast({title:'单类最多 16 项', icon:'none'}); return; }`。与 PLAN 口径一致。

### [M2] 文档与实现严重不一致（会误导后续维护/审核）
- **README.md:13,20** 写道「吃什么/玩什么保持固定预设」「自定义由用户决定」。但 `manage.js` 对 **eat/play/custom 三类一视同仁**，均可增/删/改。要么把 eat/play 在管理页锁死（只放自定义可编辑），要么改 README 文案。当前是"说了不做"。
- **docs/overview.md:28** 写道「首页 ↔ 管理页 cur 双向同步（`manage.onUnload` 回写父页）」。但 `manage.js` **根本没有 `onUnload`**，实际改成了 `onLoad`/`switchCat` 时实时写 `globalData.activeCat`。文档描述的是已废弃的旧方案。
- **docs/overview.md:8** 写「导入项目目录选 `D:\Work\mini`」，真实路径是 `D:\Work\lucky-wheel`。路径失效。
- **修复建议**：改 README 与 overview 使其与代码一致（或反之）。文档是给审核/接手人看的，错文档比没文档更危险。

### [M3] 切分类瞬间可能用"旧 rotation"重绘（1 帧闪烁）
**位置**：`components/wheel/wheel.js:6-11`（items observer）+ `pages/index/index.js:44-53`（switchCat）

- `switchCat` 先 `resetRotation()`（setData rotation=-π/2），再 `refreshItems()` 触发 wheel 的 `items` observer。observer 里 `drawWheel(this.data.rotation)` 用的 `this.data.rotation` 可能已经落后于 resetRotation 的 setData（跨页面/组件 setData 顺序不保证原子）。
- 视觉上最多 1 帧"旧角度 + 新内容"的跳变，随后 snap 正确。低危但属于"看起来不干净"。
- **修复建议**：observer 内改为 `if (spinning||!ctx) return;` 已够；更稳的做法是切分类时**只在 resetRotation 回调里重绘一次**，不再依赖 items observer 兜底（或在 observer 中强制用 `-π/2` 当切换场景）。

### [M4] 旋转中切后台 → 回前台"瞬跳"到终点
**位置**：`components/wheel/wheel.js:157-173`（`Date.now()` + `canvas.requestAnimationFrame`）

- 计时基于 `Date.now()`，而 canvas 的 `requestAnimationFrame` 在页面隐藏时**停止**。用户若在 3.5s 旋转途中切到别的 App 再回来，`Date.now()-startTs` 已超过 duration → `t=1` → 直接落定，动画被"吃掉"。
- 结果本身正确（索引预先定好），只是体验断裂。
- **修复建议**：若在意，可记录"已用时间"而非绝对时间戳，回前台时对齐；或接受此行为（多数抽奖类都这样）。属体验打磨。

---

## 🟡 低优 / 规范与打磨

- **[L1] 废弃 API 告警**：`wheel.js:32` 兜底用了 `wx.getSystemInfoSync`（2.21.4+ 标记废弃，新基础库控制台告警）。建议优先 `wx.getWindowInfo()`，其次 `wx.getDeviceInfo()`，彻底去掉 `getSystemInfoSync`。
- **[L2] `urlCheck:false`**：`project.config.json:8` 关掉了开发者工具的域名校验。本版无网络无所谓，但这是个"开关陷阱"——将来一旦加 `wx.request` 却忘了开校验/配白名单，真机直接静默失败。建议改为 `true`。
- **[L3] AppID 明文入库**：`project.config.json:36` 写死 `wx1310aa70dcd3e3fe`，且 README 把它指向公开仓库。泄露小程序 ID 本身危害有限，但**最佳实践是 `.gitignore` 掉 `project.config.json`/`project.private.config.json`，用占位/游客模式**。另外 `project.private.config.json` 也应忽略（虽当前内容无密钥）。
- **[L4] 管理页无 `onShareAppMessage`**：`manage.js` 没实现，用户在管理页点右上角"…→转发"会退回默认分享（可能分享成管理页路径）。如需一致体验，补一个即可。
- **[L5] 同名新增仅精确匹配**：`manage.js:80` `items.find(x => x.text === name)` 对 `"火锅"` 与 `"火锅 "`（含空格）判为两项；且"已存在则改权重"无任何 toast 反馈，用户可能困惑。建议 `trim()` 后匹配并给个轻提示。
- **[L6] 死代码**：`wheel.js:154` `if (desired <= startRot) desired += 2*Math.PI;` 经推导恒为假（数学上 `desired` 必大于 `startRot`），属冗余，可删。
- **[L7] 分享朋友圈无图**：`index.js:88-93` `onShareTimeline` 没给 `imageUrl`，会用默认快照。PLAN §4.3 计划"配图用转盘截图"，未落地。低优。

---

## 🟢 合规 / 过审专项

- **过审基本面：✅ 低风险**。个人主体 + 工具类目，纯本地、零 `wx.request`、不调 `getUserProfile`/`getLocation` 等隐私接口 → 无需隐私声明、无需 ICP 备案、无认证费、无支付。与 README/PLAN 判断一致。
- **⚠️ 措辞风险（值钱的一条）**：README:17 用了「**中奖结果**」、PLAN §4.2 用「中奖」。微信审核对"抽奖/转盘 + 中奖/奖品"类表述较敏感，可能关联到"诱导/赌博"类目判定。**建议全站把"中奖"改为"抽中/结果"**，转盘本质是"决策工具"而非"抽奖发奖"，文案务必守住这个定位。
- **基础库下限**：`type="2d"` canvas 需 ≥ 2.9.0；`wx.getWindowInfo` 需 ≥ 2.20.1（老设备已用 `getSystemInfoSync` 兜底，OK）。README 写"建议 ≥ 2.9.0"成立，但想走 `getWindowInfo` 分支需 ≥ 2.20.1——属正常兼容范围。
- **功能"过简"风险**：个别审核员可能对"仅两个页面、纯本地"的工具以"功能过于简单/与类目不符"打回。建议在后台简介里把定位写清为"帮选择困难症做随机决策的工具"，降低误判。

---

## ✅ 做得好的地方（对抗审查也要认账）
- 落点数学正确：指针 `-π/2`、目标角归一化、结果索引预先按权重定好，视觉与结果严格一致（无"看着指 A 实际 B"）。
- 动画用 `canvas.requestAnimationFrame` 且仅 canvas 内重绘，**没有每帧 setData**，性能约束达标。
- `storage.load()` 以 `DEFAULTS` 为基准做版本补齐，旧数据缺分类不崩——健壮性意识在线。
- `app.json` 开了 `lazyCodeLoading: requiredComponents`，符合小程序性能最佳实践。
- 旋转中锁定「开始」与「管理选项」入口，避免状态错乱——边界想得周全。

---

## 建议修复优先级
1. [H1] `weightedPick`/`inc`/`dec` 统一 `Number()`+clamp（一行级，防静默错抽）
2. [M2] 修 README/overview 三处与实现矛盾（含路径、onUnload、固定预设）
3. [M1] `add()` 加 16 项上限 + toast（PLAN 已承诺）
4. [L3/L2] `urlCheck:true` + gitignore 配置类文件、去掉明文 AppID
5. [L1] 去 `getSystemInfoSync` 废弃告警
6. [M4/L4/L5/L6/L7] 体验打磨
7. [⚠️措辞] 全站"中奖"→"抽中/结果"
