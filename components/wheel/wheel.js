Component({
  properties: {
    items: {
      type: Array,
      value: [],
      observer() {
        // 旋转中或画布未就绪时不重绘（旋转中不会触发切分类）
        if (this.data.spinning || !this.ctx) return;
        // 切选项（分类切换 / 管理页改完返回）时转盘回到 12 点初始角，
        // 统一用 -π/2 重绘，避免沿用上次旋转遗留角度造成一帧错位（M3）。
        if (this.data.rotation !== -Math.PI / 2) {
          this.setData({ rotation: -Math.PI / 2 });
        }
        this.drawWheel(-Math.PI / 2);
      }
    }
  },
  data: {
    rotation: -Math.PI / 2,
    spinning: false
  },
  lifetimes: {
    ready() {
      this._shareImage = '';
      this._pauseStart = 0;
      this._pausedAccum = 0;
      this.initCanvas();
    }
  },
  // 组件随页面前后台的生命周期：处理旋转中切后台再返回的续播（M4）
  pageLifetimes: {
    show() {
      if (this.data.spinning && this._pauseStart) {
        this._pausedAccum += Date.now() - this._pauseStart;
        this._pauseStart = 0;
        if (this.canvas) this.canvas.requestAnimationFrame(() => this._step());
      }
    },
    hide() {
      if (this.data.spinning && !this._pauseStart) {
        this._pauseStart = Date.now();
      }
    }
  },
  methods: {
    initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#wheel').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          setTimeout(() => this.initCanvas(), 100); // 节点未就绪，稍后重试
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        // L1：优先 getWindowInfo（基础库 ≥2.20.1），仅极旧基础库回退已废弃的 getSystemInfoSync；
        // 建议提审基础库 ≥2.20.1 以彻底避免废弃 API 告警。
        let dpr = 2;
        try {
          const info = (typeof wx.getWindowInfo === 'function')
            ? wx.getWindowInfo()
            : wx.getSystemInfoSync();
          dpr = info.pixelRatio || 2;
        } catch (e) {
          dpr = 2;
        }
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        this.canvas = canvas;
        this.ctx = ctx;
        this.dpr = dpr;
        this.cssSize = res[0].width;
        this.drawWheel(this.data.rotation);
      });
    },

    // HSL → HEX：微信小程序真机 canvas 2d 对 hsl() 支持不全，会回退默认色，
    // 因此扇区配色一律用 hex，保证真机/模拟器/浏览器三端视觉一致。
    hslToHex(h, s, l) {
      s = Number(s) / 100;
      l = Number(l) / 100;
      const a = s * Math.min(l, 1 - l);
      const k = (n) => (n + h / 30) % 12;
      const f = (n) => {
        const c = l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
        return Math.round(255 * c).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    },

    // 单一绿 family 的明度梯度：相邻差恒定、首尾差最大 → 奇数扇区也不撞色
    wheelSectorColors(n) {
      const H = 150, S = 46, Lmax = 92, Lmin = 60;
      if (n <= 1) return [this.hslToHex(H, S, Lmax)];
      const out = [];
      for (let i = 0; i < n; i++) {
        const L = Lmax - (Lmax - Lmin) * i / (n - 1);
        out.push(this.hslToHex(H, S, L.toFixed(1)));
      }
      return out;
    },

    drawWheel(rot) {
      const ctx = this.ctx, canvas = this.canvas;
      if (!ctx || !canvas) return;
      const items = this.data.items;
      const SIZE = this.cssSize;
      const dpr = this.dpr;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(dpr, dpr);
      const n = items.length;
      const r = SIZE / 2 - 6;
      if (n === 0) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, 2 * Math.PI);
        ctx.fillStyle = '#eef1ee';
        ctx.fill();
        ctx.restore();
        return;
      }
      const seg = 2 * Math.PI / n;
      const colors = this.wheelSectorColors(n);
      for (let i = 0; i < n; i++) {
        const start = rot + i * seg;
        const end = start + seg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, start, end);
        ctx.closePath();
        ctx.fillStyle = colors[i];
        ctx.fill();
        ctx.save();
        ctx.rotate(start + seg / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#333333';
        ctx.font = '14px sans-serif';
        let label = items[i].text || '';
        if (label.length > 5) label = label.slice(0, 5) + '…';
        ctx.fillText(label, r - 14, 0);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, 2 * Math.PI);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();

      // L7：静止状态重绘后导出当前转盘图，供朋友圈分享卡片使用；
      // 旋转中每帧重绘时 this.data.spinning 为真，跳过以避免无谓开销。
      if (!this.data.spinning) this.exportImage();
    },

    // 按权重随机选中：权重高者更易中，但扇区大小不变
    // 防御性规范化：即使 items 里权重为脏数据（非数字/越界），也保证抽样不崩、概率合理
    weightedPick(items) {
      const w = items.map((it) => {
        const n = Number(it.weight);
        if (!isFinite(n) || n <= 0) return 1;
        return Math.min(5, Math.max(1, Math.round(n)));
      });
      let total = 0;
      for (const x of w) total += x;
      let r = Math.random() * total;
      for (let i = 0; i < items.length; i++) {
        r -= w[i];
        if (r < 0) return i;
      }
      return items.length - 1;
    },

    onSpinTap() {
      this.spin();
    },

    spin() {
      if (this.data.spinning || !this.canvas) return;
      const items = this.data.items;
      if (items.length === 0) {
        wx.showToast({ title: '请先去管理页添加选项', icon: 'none' });
        return;
      }
      this.setData({ spinning: true });
      this.triggerEvent('spinstat', { spinning: true });

      const n = items.length;
      const seg = 2 * Math.PI / n;
      const target = this.weightedPick(items);
      const center = target * seg + seg / 2;
      // 目标：rotation + center ≡ -π/2 (mod 2π)，并叠加 5 圈
      const rel = (((-Math.PI / 2 - center) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const startRot = this.data.rotation;
      const desired = startRot - (startRot % (2 * Math.PI)) + rel + 5 * 2 * Math.PI;
      // 注：原 `if (desired <= startRot) desired += 2*Math.PI;` 为死代码（desired 恒大于 startRot），已删除（L6）。
      const delta = desired - startRot;
      const duration = 3500;
      this._startRot = startRot;
      this._delta = delta;
      this._duration = duration;
      this._target = target;
      this._targetItems = items;
      this._startTs = Date.now();
      this._pausedAccum = 0;
      this._pauseStart = 0;
      this.canvas.requestAnimationFrame(() => this._step());
    },

    // 旋转帧：基于"累计可见时间"推进，切后台暂停期间不计入时长（M4 配套）
    _step() {
      if (!this.canvas) return;
      const elapsed = Date.now() - this._startTs - this._pausedAccum;
      const t = Math.min(elapsed / this._duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const rot = this._startRot + this._delta * eased;
      this.drawWheel(rot);
      if (t < 1) {
        if (this._pauseStart) return; // 暂停中：停止自调度，待 pageLifetimes.show 续播
        this.canvas.requestAnimationFrame(() => this._step());
      } else {
        this.setData({ spinning: false, rotation: rot });
        this.triggerEvent('spinstat', { spinning: false });
        this.triggerEvent('result', { index: this._target, value: this._targetItems[this._target] });
      }
    },

    // 导出当前转盘为临时图片，供朋友圈分享卡片使用（L7）
    exportImage() {
      if (!this.canvas) return;
      wx.canvasToTempFilePath({
        canvas: this.canvas,
        x: 0,
        y: 0,
        width: this.canvas.width,
        height: this.canvas.height,
        destWidth: this.canvas.width,
        destHeight: this.canvas.height,
        success: (res) => { this._shareImage = res.tempFilePath; },
        fail: () => {}
      }, this);
    },

    // 供父页面分享时读取已导出的转盘图（L7）
    getShareImage() {
      return this._shareImage || '';
    },

    // 切分类时由父页面调用：重置旋转角并重绘
    resetRotation() {
      this.setData({ rotation: -Math.PI / 2 }, () => {
        this.drawWheel(-Math.PI / 2);
      });
    }
  }
});
