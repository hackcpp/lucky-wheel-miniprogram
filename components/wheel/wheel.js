Component({
  properties: {
    items: {
      type: Array,
      value: [],
      observer() {
        // 旋转中或画布未就绪时不重绘（旋转中不会触发切分类）
        if (this.data.spinning || !this.ctx) return;
        this.drawWheel(this.data.rotation);
      }
    }
  },
  data: {
    rotation: -Math.PI / 2,
    spinning: false
  },
  lifetimes: {
    ready() {
      this.initCanvas();
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
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const dpr = info.pixelRatio || 2;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        this.canvas = canvas;
        this.ctx = ctx;
        this.dpr = dpr;
        this.cssSize = res[0].width;
        this.drawWheel(this.data.rotation);
      });
    },

    // 单一绿 family 的明度梯度：相邻差恒定、首尾差最大 → 奇数扇区也不撞色
    wheelSectorColors(n) {
      const H = 150, S = 46, Lmax = 92, Lmin = 60;
      if (n <= 1) return [`hsl(${H}, ${S}%, ${Lmax}%)`];
      const out = [];
      for (let i = 0; i < n; i++) {
        const L = Lmax - (Lmax - Lmin) * i / (n - 1);
        out.push(`hsl(${H}, ${S}%, ${L.toFixed(1)}%)`);
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
    },

    // 按权重随机选中：权重高者更易中，但扇区大小不变
    weightedPick(items) {
      let total = 0;
      for (const it of items) total += (it.weight || 1);
      let r = Math.random() * total;
      for (let i = 0; i < items.length; i++) {
        r -= (items[i].weight || 1);
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
      let desired = startRot - (startRot % (2 * Math.PI)) + rel + 5 * 2 * Math.PI;
      if (desired <= startRot) desired += 2 * Math.PI;
      const delta = desired - startRot;
      const duration = 3500;
      const canvas = this.canvas;
      const startTs = Date.now();

      const step = () => {
        const t = Math.min((Date.now() - startTs) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        const rot = startRot + delta * eased;
        this.drawWheel(rot);
        if (t < 1) {
          canvas.requestAnimationFrame(step);
        } else {
          this.setData({ spinning: false, rotation: rot });
          this.triggerEvent('spinstat', { spinning: false });
          this.triggerEvent('result', { index: target, value: items[target] });
        }
      };
      canvas.requestAnimationFrame(step);
    },

    // 切分类时由父页面调用：重置旋转角并重绘
    resetRotation() {
      this.setData({ rotation: -Math.PI / 2 }, () => {
        this.drawWheel(-Math.PI / 2);
      });
    }
  }
});
