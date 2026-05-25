/**
 * Canvas-based radar chart for 3-dimension score visualization.
 * Pure Canvas 2D API, zero dependencies.
 */
export class RadarChart {
  constructor(canvasElementOrId, options = {}) {
    this.canvas = typeof canvasElementOrId === 'string'
      ? document.getElementById(canvasElementOrId)
      : canvasElementOrId;

    if (!this.canvas) throw new Error('RadarChart: canvas element not found');

    this.ctx = this.canvas.getContext('2d');
    this.options = {
      maxScore: 3,
      levels: 3,
      colors: {
        pronunciation: '#818cf8', // indigo-400
        fluency: '#34d399',       // emerald-400
        accuracy: '#fbbf24',      // amber-400
        fill: 'rgba(129, 140, 248, 0.2)',
        stroke: 'rgba(129, 140, 248, 0.5)',
        grid: 'rgba(148, 163, 184, 0.25)',
        text: '#94a3b8'
      },
      labels: {
        pronunciation: '发音',
        fluency: '流畅性',
        accuracy: '准确性'
      },
      ...options
    };

    this._resizeHandler = this._handleResize.bind(this);
    window.addEventListener('resize', this._resizeHandler);
  }

  render(scores) {
    this.scores = scores;
    this._setupCanvas();
    this._draw();
  }

  destroy() {
    window.removeEventListener('resize', this._resizeHandler);
  }

  _setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.min(rect.width, 300);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    this.ctx.scale(dpr, dpr);
    this.size = size;
    this.centerX = size / 2;
    this.centerY = size / 2;
    this.radius = size * 0.35;
    this.padding = size * 0.12;
  }

  _draw() {
    const { ctx, centerX, centerY, radius, options } = this;
    ctx.clearRect(0, 0, this.size, this.size);

    // 3 axes at 0°, 120°, 240° (top = pronunciation, bottom-right = fluency, bottom-left = accuracy)
    const angles = [
      { key: 'pronunciation', angle: -Math.PI / 2 },          // top (270° → -90°)
      { key: 'fluency', angle: Math.PI / 6 },                  // bottom-right (30°)
      { key: 'accuracy', angle: (5 * Math.PI) / 6 }            // bottom-left (150°)
    ];
    const points = angles.map(a => ({
      x: centerX + radius * Math.cos(a.angle),
      y: centerY + radius * Math.sin(a.angle)
    }));
    const labelPoints = angles.map(a => ({
      x: centerX + (radius + this.padding) * Math.cos(a.angle),
      y: centerY + (radius + this.padding) * Math.sin(a.angle)
    }));

    // Draw concentric grid circles
    for (let level = 1; level <= options.levels; level++) {
      const r = (radius / options.levels) * level;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
      ctx.strokeStyle = options.colors.grid;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw axis lines
    angles.forEach((a, i) => {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.strokeStyle = options.colors.grid;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw score level labels on each axis
    for (let level = 1; level <= options.levels; level++) {
      const r = (radius / options.levels) * level;
      // Label at each axis point
      ctx.fillStyle = options.colors.text;
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Small score labels near the top axis
      const labelX = centerX;
      const labelY = centerY - r + 4;
      ctx.fillText(String(level), labelX, labelY);
    }

    // Draw data polygon
    const dataPoints = angles.map((a, i) => {
      const score = this.scores[a.key] || 0;
      const ratio = Math.min(score / options.maxScore, 1);
      return {
        x: centerX + radius * ratio * Math.cos(a.angle),
        y: centerY + radius * ratio * Math.sin(a.angle)
      };
    });

    // Fill polygon
    ctx.beginPath();
    ctx.moveTo(dataPoints[0].x, dataPoints[0].y);
    for (let i = 1; i < dataPoints.length; i++) {
      ctx.lineTo(dataPoints[i].x, dataPoints[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = options.colors.fill;
    ctx.fill();
    ctx.strokeStyle = options.colors.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw data points
    angles.forEach((a, i) => {
      const dp = dataPoints[i];
      const color = options.colors[a.key] || '#6366f1';

      // Point circle
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Score label near point
      const score = this.scores[a.key] || 0;
      const labelOffset = 16;
      const labelX = dp.x + (dp.x > centerX ? labelOffset : dp.x < centerX ? -labelOffset : 0);
      const labelY = dp.y + (dp.y > centerY ? labelOffset : dp.y < centerY ? -labelOffset : 0);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(score.toFixed(1), labelX, labelY);
    });

    // Draw axis labels
    angles.forEach((a, i) => {
      const lp = labelPoints[i];
      const label = options.labels[a.key];

      ctx.fillStyle = options.colors.text;
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Adjust position for each label
      let lx = lp.x;
      let ly = lp.y;
      if (i === 0) { ly += 8; }         // pronunciation at top
      else if (i === 1) { lx += 12; }   // fluency bottom-right
      else { lx -= 12; }                  // accuracy bottom-left

      ctx.fillText(label, lx, ly);
    });
  }

  _handleResize() {
    if (this.scores) {
      this.render(this.scores);
    }
  }
}
