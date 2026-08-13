// Chart.js 动态加载器（满足严格 CSP：type="module" + src 外部文件）
import Chart from 'chart.js/auto';
window.Chart = Chart;
