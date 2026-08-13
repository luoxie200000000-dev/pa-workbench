// 自包含样式（仅注入一次）
if (!document.getElementById('xiuxian-style')) {
  const _xs = document.createElement('style');
  _xs.id = 'xiuxian-style';
  _xs.textContent =
    '/* ===== 04生物仙途秘境 · 国风修仙视觉系统 v2 ===== */\n/* 色板：朱砂#C3272B 金#D4AF37 宣纸#F5F0E6 墨#2C3E3F 檀#C19A6B 秋香#D4B683 玉#7FB5A6 */\n.x-wrap{\n  --x-zhu:#C3272B; --x-zhu-d:#9E1B14; --x-zhu-l:#E85D5D;\n  --x-jin:#D4AF37; --x-jin-l:#E8C766; --x-jin-d:#A8862A;\n  --x-paper:#F5F0E6; --x-paper-d:#E8DFCA;\n  --x-ink:#2C3E3F; --x-ink-l:#5a6c6d; --x-ink-x:#8a9a9b;\n  --x-tan:#C19A6B; --x-qiu:#D4B683; --x-yu:#7FB5A6; --x-yu-d:#5E9486;\n  max-width:1180px;margin:0 auto;padding:20px 18px 36px;\n  color:let(--x-ink);\n  font-family:\'SimSun\',\'NSimSun\',\'Songti SC\',serif;\n  background:\n    radial-gradient(ellipse farthest-corner at 30% 10%, rgba(193,154,107,.12) 0%, transparent 55%),\n    radial-gradient(ellipse farthest-corner at 75% 88%, rgba(44,62,63,.07) 0%, transparent 60%),\n    radial-gradient(circle at 10% 75%, rgba(212,175,55,.06) 0%, transparent 42%),\n    radial-gradient(circle at 88% 25%, rgba(127,181,166,.05) 0%, transparent 45%),\n    linear-gradient(160deg,#F7F2E8 0%,#F5F0E6 45%,#EFE6D2 100%);\n  background-attachment:local;border-radius:18px;position:relative;\n  box-shadow:inset 0 0 80px rgba(193,154,107,.09),inset 0 0 0 1px rgba(193,154,107,.18);\n}\n.x-wrap::before{content:\'\';position:absolute;inset:0;pointer-events:none;border-radius:18px;opacity:.7;\n  background:\n    radial-gradient(ellipse 140px 44px at 92% 6%, rgba(255,255,255,.55), transparent 72%),\n    radial-gradient(ellipse 100px 34px at 4% 38%, rgba(255,255,255,.4), transparent 72%),\n    radial-gradient(ellipse 150px 52px at 68% 96%, rgba(255,255,255,.32), transparent 72%)}\n.x-wrap::after{content:\'\';position:absolute;inset:0;pointer-events:none;border-radius:18px;opacity:.12;\n  background-image:linear-gradient(90deg,rgba(120,90,40,.5) 1px,transparent 1px),\n    linear-gradient(rgba(120,90,40,.5) 1px,transparent 1px);\n  background-size:26px 26px;mix-blend-mode:multiply}\n.x-wrap>*{position:relative;z-index:1}\n\n/* —— 顶部卷轴横幅 —— */\n.x-banner{\n  font-family:\'KaiTi\',\'STKaiti\',\'Ma Shan Zheng\',serif;font-weight:700;\n  font-size:25px;letter-spacing:3px;\n  padding:24px 30px;border-radius:5px;margin-bottom:20px;\n  position:relative;overflow:visible;\n  background:linear-gradient(135deg,rgba(193,39,43,.94) 0%,rgba(158,29,20,.96) 100%);\n  color:#F5E6C8;border:1px solid let(--x-jin);\n  box-shadow:0 0 0 3px rgba(212,175,55,.2),0 8px 24px rgba(158,29,20,.28),inset 0 0 40px rgba(212,175,55,.12);\n  text-shadow:0 1px 0 rgba(0,0,0,.35),0 0 14px rgba(212,175,55,.55)}\n.x-banner::before,.x-banner::after{content:\'\';position:absolute;top:50%;transform:translateY(-50%);\n  width:20px;height:58px;border-radius:6px;z-index:2;\n  background:linear-gradient(to bottom,#8B6914,#5C3D0A 48%,#8B6914);\n  box-shadow:0 0 10px rgba(0,0,0,.35),inset 0 0 5px rgba(212,175,55,.5),0 0 0 1px #3a2503}\n.x-banner::before{left:-10px}.x-banner::after{right:-10px}\n.x-banner-sub{font-size:13px;font-weight:400;color:#E8C766;margin-left:12px;letter-spacing:0;font-family:\'SimSun\',serif}\n\n/* —— 班级卡片网格 —— */\n.x-class-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px;margin-bottom:18px}\n.x-card{\n  background:linear-gradient(165deg,#FCFAF1 0%,#F5F0E6 100%);\n  border:1px solid let(--x-tan);border-radius:8px;padding:18px 16px;cursor:pointer;\n  transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;position:relative;\n  box-shadow:0 2px 6px rgba(120,90,40,.12),0 1px 0 rgba(255,255,255,.6) inset,0 0 0 1px rgba(212,175,55,.08)}\n.x-card::before{content:\'\';position:absolute;inset:4px;border:1px solid rgba(193,154,107,.35);border-radius:5px;pointer-events:none}\n.x-card:hover{transform:translateY(-4px);border-color:let(--x-jin);\n  box-shadow:0 10px 24px rgba(120,90,40,.2),0 0 0 1px let(--x-jin),0 0 22px rgba(212,175,55,.35),0 1px 0 rgba(255,255,255,.6) inset}\n.x-class-name{font-family:\'KaiTi\',\'STKaiti\',serif;font-size:20px;font-weight:700;color:let(--x-zhu-d);letter-spacing:1px}\n.x-class-sub{color:let(--x-ink-l);font-size:13px;margin-top:6px;font-family:\'SimSun\',serif}\n\n/* —— 学生卡片 —— */\n.x-stu-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:14px}\n.x-stu-card{padding:14px 10px 12px}\n.x-cell-avatar{width:60px;height:60px;margin:0 auto;filter:drop-shadow(0 2px 4px rgba(0,0,0,.15))}\n.x-stu-name{font-family:\'KaiTi\',\'STKaiti\',serif;text-align:center;font-weight:700;margin-top:8px;color:let(--x-ink);font-size:16px}\n.x-tag{display:block;width:fit-content;margin:5px auto 0;color:#fff;font-size:11px;padding:2px 9px;border-radius:3px;\n  font-family:\'SimSun\',serif;letter-spacing:1px;box-shadow:0 1px 2px rgba(0,0,0,.2)}\n.x-stu-realm{text-align:center;color:let(--x-ink-x);font-size:12px;margin-top:4px;font-family:\'SimSun\',serif}\n\n/* —— 操作/资源条 —— */\n.x-bar{display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap;\n  padding:10px 14px;border-radius:8px;\n  background:linear-gradient(180deg,rgba(232,223,202,.7),rgba(245,240,230,.5));\n  border:1px solid let(--x-tan);box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 6px rgba(120,90,40,.1)}\n.x-bar-title{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;margin-right:auto;font-size:18px;color:let(--x-zhu-d);letter-spacing:1px}\n\n/* —— 古风按钮（覆盖 .btn） —— */\n.x-wrap .btn,.x-wrap .btn-sm{font-family:\'SimSun\',\'NSimSun\',serif;border-radius:6px;\n  background:linear-gradient(180deg,#FCFAF1,#E8DFCA);border:1px solid let(--x-tan);\n  color:let(--x-ink);box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 4px rgba(120,90,40,.15);\n  transition:all .15s ease;padding:6px 12px;font-size:13px}\n.x-wrap .btn:hover,.x-wrap .btn-sm:hover{background:linear-gradient(180deg,#F5E6C8,#D4B683);\n  border-color:let(--x-jin);color:let(--x-zhu-d);box-shadow:0 0 0 1px let(--x-jin),0 3px 8px rgba(212,175,55,.3),0 1px 0 rgba(255,255,255,.5) inset}\n.x-wrap .btn-primary{background:linear-gradient(180deg,let(--x-zhu-l),let(--x-zhu));border-color:let(--x-zhu-d);color:#fff;\n  text-shadow:0 1px 0 rgba(0,0,0,.2);box-shadow:0 0 0 1px rgba(212,175,55,.3),0 3px 8px rgba(158,29,20,.3),0 1px 0 rgba(255,255,255,.2) inset}\n.x-wrap .btn-primary:hover{background:linear-gradient(180deg,let(--x-zhu),let(--x-zhu-d));box-shadow:0 0 0 1px let(--x-jin),0 4px 12px rgba(158,29,20,.4),0 0 16px rgba(212,175,55,.4)}\n\n/* —— 英雄修炼面板（卷轴框） —— */\n.x-hero{display:flex;gap:20px;align-items:center;padding:22px;border:1px solid let(--x-jin);\n  border-radius:8px;margin-bottom:16px;position:relative;\n  background:linear-gradient(165deg,rgba(252,250,241,.95),rgba(245,240,230,.85));\n  box-shadow:0 0 0 3px rgba(193,154,107,.2),0 8px 24px rgba(120,90,40,.16),inset 0 0 50px rgba(212,175,55,.06)}\n.x-hero::before{content:\'\';position:absolute;inset:5px;border:1px solid rgba(212,175,55,.4);border-radius:5px;pointer-events:none}\n.x-hero::after{content:\'\';position:absolute;inset:0;border-radius:8px;pointer-events:none;opacity:.5;\n  background:radial-gradient(ellipse 200px 120px at 18% 50%, rgba(212,175,55,.1), transparent 70%)}\n.x-hero-info{flex:1;min-width:0;position:relative;z-index:1}\n.x-hero-name{font-family:\'KaiTi\',\'STKaiti\',serif;font-size:24px;font-weight:700;color:let(--x-zhu-d);letter-spacing:1px;text-shadow:0 1px 0 rgba(255,255,255,.5)}\n.x-hero-realm{font-family:\'SimSun\',serif;color:let(--x-ink);margin:6px 0;font-size:14px}\n.x-hero-kind{color:let(--x-ink-x);font-size:13px;font-family:\'SimSun\',serif}\n.x-avatar{width:104px;height:104px;flex:0 0 104px;display:flex;align-items:center;justify-content:center;position:relative;z-index:1}\n.x-avatar svg,.x-avatar-svg{width:100%;height:100%}\n\n/* —— 属性四格 —— */\n.x-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}\n.x-stat{background:linear-gradient(165deg,#FCFAF1,#F0E8D4);border:1px solid let(--x-tan);\n  border-radius:6px;padding:11px 8px;text-align:center;position:relative;\n  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 5px rgba(120,90,40,.1)}\n.x-stat::before{content:\'\';position:absolute;inset:3px;border:1px solid rgba(193,154,107,.25);border-radius:4px;pointer-events:none}\n.x-stat span{display:block;color:let(--x-ink-x);font-size:12px;font-family:\'SimSun\',serif}\n.x-stat b{font-size:18px;color:let(--x-zhu-d);font-family:\'KaiTi\',\'STKaiti\',serif}\n\n/* —— 灵气进度条（玉色/金色） —— */\n.x-progress{height:14px;background:linear-gradient(90deg,#E8DFCA,#D4C9A8);border-radius:8px;overflow:hidden;\n  margin-bottom:16px;border:1px solid let(--x-tan);box-shadow:0 1px 0 rgba(255,255,255,.4) inset}\n.x-progress-fill{height:100%;transition:width .6s cubic-bezier(.25,.46,.45,.94);\n  background:linear-gradient(90deg,let(--x-yu-d),let(--x-yu) 40%,let(--x-jin) 90%,let(--x-jin-l));\n  box-shadow:0 0 8px rgba(212,175,55,.5) inset,0 0 6px rgba(127,181,166,.4)}\n\n/* —— 动作按钮区 —— */\n.x-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}\n\n/* —— 限定抽取区 —— */\n.x-limited{border:1px dashed let(--x-jin);border-radius:8px;padding:14px;margin-bottom:16px;\n  background:linear-gradient(165deg,rgba(252,253,245,.9),rgba(245,240,220,.7));position:relative;\n  box-shadow:0 0 0 2px rgba(193,154,107,.12),inset 0 0 30px rgba(212,175,55,.05)}\n.x-limited-title{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;margin-bottom:10px;color:let(--x-zhu-d);letter-spacing:1px;font-size:16px}\n.x-limited-row{display:flex;gap:8px;flex-wrap:wrap}\n.x-limited-btn{border:1px solid let(--x-tan);background:linear-gradient(180deg,#FCFAF1,#E8DFCA);\n  border-radius:6px;padding:8px 11px;cursor:pointer;font-size:13px;text-align:center;min-width:115px;\n  font-family:\'SimSun\',serif;transition:all .15s ease;\n  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 4px rgba(120,90,40,.12)}\n.x-limited-btn:hover{border-color:let(--x-jin);background:linear-gradient(180deg,#F5E6C8,#D4B683);\n  transform:translateY(-2px);box-shadow:0 0 0 1px let(--x-jin),0 4px 10px rgba(212,175,55,.3)}\n.x-limited-btn small{color:let(--x-zhu);font-weight:700}\n\n/* —— 提示条（卷轴卷起感） —— */\n.x-tip{background:linear-gradient(90deg,rgba(232,223,202,.8),rgba(245,240,230,.6),rgba(232,223,202,.8));\n  border-left:4px solid let(--x-yu-d);padding:11px 14px;border-radius:4px;color:let(--x-ink);font-size:13px;\n  margin-top:14px;font-family:\'SimSun\',serif;box-shadow:0 1px 0 rgba(255,255,255,.4) inset,0 2px 5px rgba(120,90,40,.08)}\n.x-emoji{font-size:46px;text-align:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.15))}\n\n/* —— 动画 —— */\n@keyframes xBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}\n@keyframes xSway{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}\n@keyframes xSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}\n@keyframes xFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}\n@keyframes xGoldPulse{0%,100%{box-shadow:0 0 8px rgba(212,175,55,.3) inset,0 2px 6px rgba(120,90,40,.1)}50%{box-shadow:0 0 18px rgba(212,175,55,.55) inset,0 0 12px rgba(212,175,55,.4),0 2px 6px rgba(120,90,40,.1)}}\n@keyframes xCloudDrift{0%{transform:translateX(0)}100%{transform:translateX(-40px)}}\n.x-act-bounce,.x-act-punch,.x-act-slash,.x-act-dash,.x-act-float,.x-act-swim,.x-act-cast,.x-act-beep,.x-act-ult,.x-act-sway,.x-act-spin,.x-act-blink{animation:xBounce 1.6s ease-in-out infinite}\n.x-act-sway{animation:xSway 1.8s ease-in-out infinite;transform-origin:bottom center}\n.x-act-spin{animation:xSpin 4s linear infinite}\n.x-act-float{animation:xFloat 2s ease-in-out infinite}\n.x-act-blink{animation:xBounce 1.2s ease-in-out infinite}\n.x-act-ult{animation:xBounce 1.6s ease-in-out infinite,xGoldPulse 2.4s ease-in-out infinite}\n\n/* —— 模态框（卷轴宣纸） —— */\n.x-modal-overlay{position:fixed;inset:0;background:radial-gradient(circle at center,rgba(30,20,8,.55),rgba(15,10,4,.7));display:flex;align-items:center;justify-content:center;z-index:9999;padding:18px;backdrop-filter:blur(3px)}\n.x-modal{background:linear-gradient(165deg,#FCFAF1 0%,#F5F0E6 100%);border:1px solid let(--x-jin);\n  border-radius:10px;max-width:880px;width:100%;max-height:88vh;overflow:auto;position:relative;\n  box-shadow:0 0 0 3px rgba(193,154,107,.25),0 24px 70px rgba(0,0,0,.4),inset 0 0 60px rgba(212,175,55,.06)}\n.x-modal::before{content:\'\';position:absolute;inset:6px;border:1px solid rgba(212,175,55,.35);border-radius:7px;pointer-events:none}\n.x-modal-head{display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid let(--x-tan);position:sticky;top:0;\n  background:linear-gradient(180deg,#FCFAF1,#E8DFCA);z-index:2}\n.x-modal-title{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;font-size:19px;margin-right:auto;color:let(--x-zhu-d);letter-spacing:1px}\n.x-modal-body{padding:18px 20px;position:relative;z-index:1}\n.x-modal-foot{padding:13px 20px;border-top:1px solid let(--x-tan);display:flex;gap:8px;justify-content:flex-end;\n  background:linear-gradient(0deg,#E8DFCA,#F5F0E6)}\n\n/* —— 商城 —— */\n.x-mall-cats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}\n.x-mall-cat{padding:6px 15px;border-radius:4px;border:1px solid let(--x-tan);cursor:pointer;\n  background:linear-gradient(180deg,#FCFAF1,#E8DFCA);font-size:14px;font-family:\'SimSun\',serif;\n  box-shadow:0 1px 0 rgba(255,255,255,.5) inset;transition:all .15s ease}\n.x-mall-cat.on{background:linear-gradient(180deg,let(--x-zhu-l),let(--x-zhu));border-color:let(--x-zhu-d);color:#fff;\n  font-weight:700;text-shadow:0 1px 0 rgba(0,0,0,.2);box-shadow:0 0 0 1px let(--x-jin),0 2px 6px rgba(158,29,20,.3)}\n.x-mall-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}\n.x-mall-item{border:1px solid let(--x-tan);border-radius:7px;padding:13px;\n  background:linear-gradient(165deg,#FCFAF1,#F0E8D4);position:relative;\n  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 5px rgba(120,90,40,.1);transition:all .15s ease}\n.x-mall-item:hover{border-color:let(--x-jin);transform:translateY(-2px);box-shadow:0 0 0 1px let(--x-jin),0 6px 14px rgba(212,175,55,.25)}\n.x-mall-name{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;color:let(--x-zhu-d);font-size:16px}\n.x-mall-desc{color:let(--x-ink-l);font-size:12px;margin:6px 0 9px;min-height:32px;font-family:\'SimSun\',serif}\n.x-mall-cost{font-size:13px;color:let(--x-zhu);font-weight:700;margin-bottom:9px;font-family:\'SimSun\',serif}\n\n/* —— 排行榜 —— */\n.x-rank-tabs{display:flex;gap:8px;margin-bottom:14px}\n.x-rank-row{display:grid;grid-template-columns:48px 1fr 120px 120px;gap:8px;align-items:center;\n  padding:9px 12px;border-bottom:1px solid rgba(193,154,107,.25);\n  background:linear-gradient(90deg,rgba(252,250,241,.6),transparent);font-family:\'SimSun\',serif}\n.x-rank-row.head{font-weight:700;color:let(--x-ink);background:linear-gradient(90deg,#E8DFCA,#F5F0E6);border-radius:6px;\n  font-family:\'KaiTi\',\'STKaiti\',serif;letter-spacing:1px}\n.x-rank-row:nth-child(2){background:linear-gradient(90deg,rgba(212,175,55,.15),transparent)}\n.x-rank-medal{font-size:20px;text-align:center}\n.x-rank-name{font-weight:600;color:let(--x-zhu-d);font-family:\'KaiTi\',\'STKaiti\',serif}\n.x-rank-val{text-align:right;font-variant-numeric:tabular-nums;color:let(--x-ink)}\n\n/* —— 小队 —— */\n.x-squad-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}\n.x-squad{border:1px solid let(--x-tan);border-radius:7px;padding:13px;\n  background:linear-gradient(165deg,#FCFAF1,#F0E8D4);position:relative;\n  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 5px rgba(120,90,40,.1)}\n.x-squad-title{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;display:flex;align-items:center;gap:6px;margin-bottom:9px;color:let(--x-zhu-d);font-size:16px;letter-spacing:1px}\n.x-squad-member{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:5px;font-size:13px;font-family:\'SimSun\',serif}\n.x-squad-member.leader{background:linear-gradient(90deg,rgba(212,175,55,.2),rgba(212,175,55,.05));\n  border:1px solid rgba(212,175,55,.4);font-weight:700}\n\n/* —— 突破 —— */\n.x-bt-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}\n.x-bt-card{border:1px solid let(--x-tan);border-radius:7px;padding:15px;text-align:center;cursor:pointer;\n  background:linear-gradient(165deg,#FCFAF1,#F0E8D4);transition:all .15s ease;position:relative;\n  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 5px rgba(120,90,40,.1)}\n.x-bt-card:hover{border-color:let(--x-jin);background:linear-gradient(165deg,#F5E6C8,#D4B683);\n  transform:translateY(-3px);box-shadow:0 0 0 1px let(--x-jin),0 6px 16px rgba(212,175,55,.35)}\n.x-bt-tier{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;font-size:17px;color:let(--x-zhu-d);letter-spacing:1px}\n.x-bt-cost{color:let(--x-zhu);font-weight:700;margin:6px 0;font-family:\'SimSun\',serif}\n.x-bt-rate{color:let(--x-yu-d);font-weight:600;font-family:\'SimSun\',serif}\n.x-sec-title{font-family:\'KaiTi\',\'STKaiti\',serif;font-weight:700;font-size:16px;margin:16px 0 9px;color:let(--x-zhu-d);letter-spacing:1px}\n\n/* —— 云雾装饰层 —— */\n.x-mist{position:absolute;left:0;right:0;height:40px;pointer-events:none;z-index:0;opacity:.5;\n  background:radial-gradient(ellipse 100px 20px at 20% 50%,rgba(255,255,255,.6),transparent 70%),\n    radial-gradient(ellipse 80px 16px at 60% 60%,rgba(255,255,255,.5),transparent 70%),\n    radial-gradient(ellipse 90px 18px at 88% 45%,rgba(255,255,255,.55),transparent 70%)}\n.x-mist.top{top:0}.x-mist.bot{bottom:0}\n.x-seal{position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:4px;\n  background:linear-gradient(135deg,let(--x-zhu),let(--x-zhu-d));color:#F5E6C8;\n  display:flex;align-items:center;justify-content:center;font-family:\'KaiTi\',\'STKaiti\',serif;\n  font-weight:700;font-size:13px;transform:rotate(-8deg);z-index:3;letter-spacing:0;\n  box-shadow:0 0 0 1px rgba(212,175,55,.4),0 2px 6px rgba(158,29,20,.35);opacity:.85}\n.x-res-bar{display:flex;gap:0;align-items:stretch;border-radius:7px;overflow:hidden;margin-bottom:16px;\n  border:1px solid let(--x-tan);box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 2px 6px rgba(120,90,40,.12)}\n.x-res-cell{flex:1;padding:8px 10px;text-align:center;font-family:\'SimSun\',serif;\n  background:linear-gradient(180deg,#FCFAF1,#E8DFCA);border-right:1px solid rgba(193,154,107,.3)}\n.x-res-cell:last-child{border-right:0}\n.x-res-cell span{display:block;color:let(--x-ink-x);font-size:11px}\n.x-res-cell b{font-size:15px;color:let(--x-zhu-d);font-family:\'KaiTi\',\'STKaiti\',serif}';
  document.head.appendChild(_xs);
}

// —— 颜色工具 ——
function xiuxianHslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = s / 100; l = l / 100;
  let c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  const to = function (v) { return ('0' + Math.round((v + m) * 255).toString(16)).slice(-2); };
  return '#' + to(r) + to(g) + to(b);
}
function xiuxianShade(hex, amt) {
  let h = hex.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  let r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  let f = function (v) { return ('0' + Math.max(0, Math.min(255, v + amt)).toString(16)).slice(-2); };
  return '#' + f(r) + f(g) + f(b);
}

// —— 形象池构建（Stage 9：完整 240 = 动物60 + 植物60 + 人物60 + 限定60） ——
const X_ANIMAL = [
  ['小蓝企鹅','🐧','企鹅','penguin'],['喵小咪','🐱','猫','cat'],['旺财','🐶','狗','dog'],['雪团','🐰','兔','bunny'],
  ['阿狸','🦊','狐','fox'],['棕熊大叔','🐻','熊','bear'],['团子','🐼','熊猫','panda'],['虎妞','🐯','虎','tiger'],
  ['狮王','🦁','狮','lion'],['呱呱','🐸','蛙','frog'],['龟丞相','🐢','龟','turtle'],['独角兽','🦄','幻想兽','unicorn'],
  ['小仓鼠','🐹','仓鼠','round'],['刺刺','🦔','刺猬','round'],['豚豚','🐷','猪','round'],['咩咩','🐑','羊','round'],
  ['牛牛','🐮','牛','round'],['小马','🐴','马','round'],['山羊哥','🐐','山羊','round'],['小鹿','🦌','鹿','round'],
  ['喵喵','🐈','猫','cat'],['汪汪','🐕','狗','dog'],['小狼','🐺','狼','fox'],['浣熊弟','🦝','浣熊','fox'],
  ['企鹅宝','🐧','企鹅','penguin'],['小鸡','🐤','鸡','bird'],['小鸟','🐦','鸟','bird'],['老鹰','🦅','鹰','bird'],
  ['鸭鸭','🦆','鸭','bird'],['天鹅','🦢','天鹅','bird'],['小鱼','🐟','鱼','fish'],['热带鱼','🐠','鱼','fish'],
  ['鲸鱼','🐳','鲸','fish'],['章鱼','🐙','章鱼','fish'],['螃蟹','🦀','蟹','fish'],['虾虾','🦐','虾','fish'],
  ['海星','⭐','海星','fish'],['蝴蝶','🦋','蝶','bug'],['蜜蜂','🐝','蜂','bug'],['瓢虫','🐞','瓢虫','bug'],
  ['蜗牛','🐌','蜗','bug'],['蚂蚁','🐜','蚁','bug'],['熊猫宝','🐼','熊猫','panda'],['考拉','🐨','考拉','bear'],
  ['袋鼠','🦘','袋鼠','round'],['猴子','🐵','猴','round'],['猩猩','🦍','猩猩','round'],['长颈鹿','🦒','鹿','round'],
  ['大象','🐘','象','round'],['犀牛','🦏','犀牛','round'],['河马','🦛','河马','round'],['骆驼','🐫','驼','round'],
  ['猫头鹰','🦉','鸮','bird'],['企鹅妹','🐧','企鹅','penguin'],['松鼠','🐿','松鼠','round'],['刺猬宝','🦔','刺猬','round'],
  ['臭鼬','🦨','鼬','fox'],['野猪','🐗','猪','round'],['斑马','🦓','马','round'],['蛇蛇','🐍','蛇','fish']
];
const X_PLANT = [
  ['豆芽菜','🌱','芽','sprout'],['向日葵','🌻','花','flower'],['红玫瑰','🌹','花','flower'],['苹果君','🍎','果','fruit'],
  ['草莓妹','🍓','果','fruit'],['大树伯','🌳','树','tree'],['樱樱','🌸','花','flower'],['蘑菇精','🍄','菌','mushroom'],
  ['仙人球','🌵','多肉','cactus'],['幸运草','🍀','草','grass'],['麦麦','🌾','禾','grass'],['橘小子','🍊','果','fruit'],
  ['桃桃','🍑','果','fruit'],['葡萄','🍇','果','fruit'],['西瓜','🍉','果','fruit'],['香蕉','🍌','果','fruit'],
  ['菠萝','🍍','果','fruit'],['柠檬','🍋','果','fruit'],['蓝莓','🫐','果','fruit'],['樱桃','🍒','果','fruit'],
  ['梨子','🍐','果','fruit'],['椰子','🥥','果','fruit'],['芒果','🥭','果','fruit'],['番茄','🍅','果','fruit'],
  ['玉米','🌽','禾','grass'],['胡萝卜','🥕','根','sprout'],['土豆','🥔','根','sprout'],['红薯','🍠','根','sprout'],
  ['茄子','🍆','果','fruit'],['辣椒','🌶','椒','sprout'],['南瓜','🎃','果','fruit'],['西兰花','🥦','花','flower'],
  ['芦笋','🌿','草','grass'],['树叶','🍃','叶','grass'],['四叶草','☘','草','grass'],['松树','🌲','树','tree'],
  ['棕榈','🌴','树','tree'],['竹竹','🎍','竹','tree'],['荷荷','🪷','荷','flower'],['郁金香','🌷','花','flower'],
  ['雏菊','🌼','花','flower'],['薰衣草','💐','花','flower'],['松果','🌰','果','fruit'],['芝麻','🌱','芽','sprout'],
  ['香菇','🍄','菌','mushroom'],['水草','🌿','草','grass'],['苔藓妹','🌿','草','grass'],['藤藤','🌿','草','grass'],
  ['兰兰','🌸','花','flower'],['梅梅','🌸','花','flower'],['菊菊','🌼','花','flower'],['荷包','🪷','花','flower'],
  ['枫枫','🍁','叶','grass'],['芭蕉','🌿','草','grass'],['芦苇','🌾','草','grass'],['青草','🌱','芽','sprout'],
  ['蘑菇王','🍄','菌','mushroom'],['神木','🌳','树','tree']
];
const X_CHAR = [
  ['热血少年','🧑','少年','boy'],['魔法少女','🧚','少女','girl'],['骑士','🤴','骑士','knight'],['公主','👸','公主','princess'],
  ['忍者','🥷','忍者','ninja'],['法师','🧙','法师','mage'],['机器人','🤖','机械','robot'],['美人鱼','🧜','人鱼','mermaid'],
  ['精灵','🧝','精灵','girl'],['吸血鬼','🧛','暗夜','boy'],['宇航员','👨\u200d🚀','太空','boy'],['侦探','🕵','侦探','boy'],
  ['小悟空','🐵','猴王','boy'],['路飞','🏴\u200d☠','海贼','boy'],['鸣人','🍜','忍者','ninja'],['柯南','🔍','侦探','boy'],
  ['小樱','🌸','少女','girl'],['御剑少年','⚔','剑客','boy'],['弓箭手','🏹','游侠','boy'],['魔法师','🧙','法师','mage'],
  ['圣骑士','🛡','圣骑','knight'],['小魔女','🧹','魔女','girl'],['机甲兵','🤖','机甲','robot'],['天使','👼','天使','girl'],
  ['恶魔','👿','恶魔','boy'],['武士','🗡','武士','boy'],['医生','🩺','医师','boy'],['厨师','👨\u200d🍳','厨师','boy'],
  ['警察','👮','警官','boy'],['消防员','👨\u200d🚒','消防员','boy'],['科学家','🧑\u200d🔬','科学家','boy'],['老师','👨\u200d🏫','教师','boy'],
  ['歌手','🎤','歌手','girl'],['舞者','💃','舞者','girl'],['画家','🎨','画家','boy'],['运动员','🏃','运动员','boy'],
  ['篮球少年','🏀','球员','boy'],['足球少年','⚽','球员','boy'],['剑姬','⚔','剑姬','girl'],['弓姬','🏹','游侠','girl'],
  ['龙骑士','🐉','龙骑','boy'],['驯兽师','🦁','驯兽','boy'],['占星师','🔮','占星','mage'],['炼金术师','⚗','炼金','mage'],
  ['吟游诗人','🎵','诗人','boy'],['圣女','✨','圣女','girl'],['小王子','👑','王子','boy'],['白雪','👸','公主','princess'],
  ['人鱼公主','🧜','人鱼','mermaid'],['狼少年','🐺','狼人','boy'],['猫娘','🐱','猫娘','girl'],['兔娘','🐰','兔娘','girl'],
  ['狐娘','🦊','狐娘','girl'],['机械姬','🤖','机械','girl'],['幽灵','👻','幽灵','boy'],['僵尸','🧟','僵尸','boy'],
  ['雪女','❄','雪女','girl'],['雷神','⚡','雷神','boy'],['火神','🔥','火神','boy'],['水神','💧','水神','girl']
];
const X_RARE = [
  ['迪迦奥特曼','⚡','光之巨人','hero',5,10,5],['皮卡丘','⚡','电鼠','hero',20,30,3],['孙悟空(龙珠)','🐵','猴王','hero',10,20,4],
  ['葫芦娃','🍐','精灵','legend',7,15,4],['钢铁侠','🤖','装甲','mech',15,25,4],['哆啦A梦','🐱','猫型机器人','mech',30,40,3],
  ['初音未来','🎤','歌姬','legend',12,20,4],['路飞(海贼王)','🏴\u200d☠','海贼','hero',10,20,4],['鸣人(火影)','🍜','忍者','hero',10,20,4],
  ['柯南','🔍','侦探','legend',8,15,3],['喜羊羊','🐑','羊','hero',25,35,3],['熊大','🐻','熊','hero',20,30,3],
  ['黑猫警长','🐱','警长','hero',15,25,3],['赛罗奥特曼','⚡','光之巨人','hero',5,10,5],['圣斗士星矢','♈','圣斗士','hero',10,20,4],
  ['美少女战士','🌙','水手战士','legend',12,20,4],['龙猫','🐾','森林精灵','legend',18,30,3],['千与千寻','🌸','少女','legend',15,25,3],
  ['蜡笔小新','🖍','小孩','hero',20,30,3],['樱桃小丸子','🍒','小孩','legend',20,30,3],['哆啦美','🐱','猫型机器人','mech',20,30,3],
  ['孙悟空(西游记)','🐵','猴王','hero',10,20,4],['猪八戒','🐷','天蓬','hero',15,25,3],['泰罗奥特曼','⚡','光之巨人','hero',5,10,5],
  ['盖亚奥特曼','⚡','光之巨人','hero',5,10,5],['葫芦兄弟','🍐','精灵','legend',7,15,4],['阿童木','🤖','机甲','mech',15,25,3],
  ['一休哥','🧘','小和尚','hero',15,25,3],['花仙子','🌸','花仙','legend',12,20,4],['紫龙(圣斗士)','♓','圣斗士','hero',10,20,4],
  ['玄武神兽','🐢','神兽','legend',6,12,4],['朱雀神鸟','🐦','神鸟','legend',6,12,4],['青龙神龙','🐉','神龙','legend',6,12,5],
  ['白虎神兽','🐯','神兽','legend',6,12,4],['麒麟瑞兽','🦄','瑞兽','legend',8,15,4],['凤凰涅槃','🔥','神鸟','legend',6,12,5],
  ['九尾狐','🦊','妖狐','legend',8,15,4],['二郎神','🐕','神将','hero',8,15,4],['哪吒','🔥','三坛海会大神','hero',8,15,4],
  ['雷震子','⚡','雷将','hero',8,15,4],['托塔天王','👑','神将','hero',8,15,4],['嫦娥','🌙','仙子','legend',10,18,4],
  ['后羿','🏹','神射手','hero',8,15,4],['女娲','🐍','创世神','legend',6,12,5],['盘古','🪓','创世神','legend',6,12,5],
  ['精卫','🐦','神鸟','legend',10,18,4],['夸父','🏃','神人','legend',10,18,4],['共工','💧','水神','legend',10,18,4],
  ['祝融','🔥','火神','legend',10,18,4],['玄女','✨','战神','legend',8,15,4],['太上老君','☯','道祖','legend',6,12,5],
  ['太白金星','⭐','星君','legend',8,15,4],['斗战胜佛','🐵','佛','hero',6,12,5],['金角大王','👑','妖王','hero',10,18,4],
  ['银角大王','👑','妖王','hero',10,18,4],['红孩儿','🔥','圣婴','hero',8,15,4],['白骨精','💀','妖仙','legend',8,15,4],
  ['牛魔王','🐂','妖王','hero',8,15,4],['铁扇公主','🪭','罗刹','legend',8,15,4],['二郎显圣','⚡','真君','hero',6,12,5],
  ['镇元大仙','🌳','地仙','legend',6,12,5]
];
function xiuxianBuildPool() {
  let pool = [], i;
  for (i = 0; i < X_ANIMAL.length; i++) {
    const a = X_ANIMAL[i];
    const hue = Math.round(i * (360 / X_ANIMAL.length));
    pool.push({ id: 'a' + i, pool: 'animal', name: a[0], emoji: a[1], kind: a[2], body: a[3], action: 'bounce', color: xiuxianHslToHex(hue, 65, 68), rarity: 'common' });
  }
  for (i = 0; i < X_PLANT.length; i++) {
    let p = X_PLANT[i];
    const ph = 80 + Math.round((i % 12) * 7);
    pool.push({ id: 'p' + i, pool: 'plant', name: p[0], emoji: p[1], kind: p[2], body: p[3], action: 'sway', color: xiuxianHslToHex(ph, 60, 62), rarity: 'common' });
  }
  for (i = 0; i < X_CHAR.length; i++) {
    const c = X_CHAR[i];
    let ch = 200 + Math.round((i % 16) * 9);
    pool.push({ id: 'c' + i, pool: 'character', name: c[0], emoji: c[1], kind: c[2], body: c[3], action: (c[3] === 'girl' || c[3] === 'princess' || c[3] === 'mermaid') ? 'spin' : 'punch', color: xiuxianHslToHex(ch, 62, 70), rarity: 'common' });
  }
  for (i = 0; i < X_RARE.length; i++) {
    let r = X_RARE[i];
    const rh = (i % 2 === 0) ? 45 : 285;
    pool.push({ id: 'r' + i, pool: 'rare', name: r[0], emoji: r[1], kind: r[2], body: r[3], action: 'ult', rarity: 'limited', quota: r[4], rank_req: r[5], jipin_price: r[6], color: xiuxianHslToHex(rh, 75, 60), source: '班级排名前' + r[5] + ' + ' + r[6] + '极品灵石抽取' });
  }
  return pool;
}
const XIUXIAN_POOL = xiuxianBuildPool();

// —— 经济内核常量（沿用 v2.0 原值，增补商城/排行榜配置） ——
const XIUXIAN_RULES = {
  STONE_TO_SPIRIT_RATE: 3,
  PREMIUM_TO_STONE: 25,
  REALMS: [
    { index: 0, name: '凡人',       baseCombat: 0,    spiritCap: 0,     color: '#9E9E9E' },
    { index: 1, name: '胚芽炼气境', baseCombat: 80,   spiritCap: 80,    color: '#8BC34A' },
    { index: 2, name: '根茎筑基境', baseCombat: 200,  spiritCap: 180,   color: '#4CAF50' },
    { index: 3, name: '花叶金丹境', baseCombat: 500,  spiritCap: 400,   color: '#66BB6A' },
    { index: 4, name: '灵果元婴境', baseCombat: 1200, spiritCap: 800,   color: '#FFA726' },
    { index: 5, name: '生态化神境', baseCombat: 3000, spiritCap: 1600,  color: '#AB47BC' },
    { index: 6, name: '万物道祖境', baseCombat: 8000, spiritCap: 99999, color: '#FFD700' }
  ],
  LINGGEN_LEVELS: [
    { name: '凡品', linggenName: '尘芜根', displayLabel: '凡品(尘芜根)', minScore: 0,  maxScore: 44,  dailySpirit: 8,  color: '#9E9E9E', glowColor: 'rgba(158,158,158,0.3)' },
    { name: '地品', linggenName: '青畴根', displayLabel: '地品(青畴根)', minScore: 45, maxScore: 59,  dailySpirit: 12, color: '#8D6E63', glowColor: 'rgba(141,110,99,0.4)' },
    { name: '天品', linggenName: '丰穗根', displayLabel: '天品(丰穗根)', minScore: 60, maxScore: 74,  dailySpirit: 16, color: '#42A5F5', glowColor: 'rgba(66,165,245,0.5)' },
    { name: '仙品', linggenName: '琼华根', displayLabel: '仙品(琼华根)', minScore: 75, maxScore: 84,  dailySpirit: 20, color: '#AB47BC', glowColor: 'rgba(171,71,188,0.6)' },
    { name: '神品', linggenName: '造化根', displayLabel: '神品(造化根)', minScore: 85, maxScore: 94,  dailySpirit: 25, color: '#FF7043', glowColor: 'rgba(255,112,67,0.7)' },
    { name: '混沌', linggenName: '鸿蒙道根', displayLabel: '混沌(鸿蒙道根)', minScore: 95, maxScore: 100, dailySpirit: 30, color: '#FFD700', glowColor: 'rgba(255,215,0,0.8)' }
  ],
  BREAKTHROUGH_COSTS: { 1: [5, 8, 12, 20], 2: [15, 22, 32, 50], 3: [35, 50, 72, 110], 4: [70, 100, 145, 220], 5: [140, 200, 290, 440], 6: [280, 400, 580, 880] },
  BREAKTHROUGH_BASE_RATES: [0.10, 0.30, 0.60, 0.80],
  BREAKTHROUGH_FAIL_BONUSES: [0.10, 0.15, 0.20, 0.25],
  BREAKTHROUGH_GUARANTEE_TIER: 4,
  PREMIUM_STONE: { dropBaseRate: 0.10, dropRateIncrement: 0.05, pityWindowDays: 3, pityThreshold: 5, exchangeToNormal: 25, initialBalance: 0 },
  SQUAD_RULES: { squadsPerClass: 7, leaderWeeklyStone: 10, appointmentMode: 'manual', autoReplaceMonthly: false },
  SWITCH_COST_STONE: 30,
  AUTO_SPIRIT_TO_STONE_RATIO: 3,
  WEAPONS: [
    { id: 'w1', name: '木剑', tier: 0, tierName: '凡器', kind: 'weapon', bonusPct: 0.03, costType: 'stone', cost: 20, desc: '入门木剑，基础战力+3%' },
    { id: 'w2', name: '青锋剑', tier: 1, tierName: '灵器', kind: 'weapon', bonusPct: 0.06, costType: 'stone', cost: 50, desc: '灵气淬炼之剑，基础战力+6%' },
    { id: 'w3', name: '紫电', tier: 2, tierName: '宝器', kind: 'weapon', bonusPct: 0.10, costType: 'stone', cost: 120, desc: '雷霆之力，基础战力+10%' },
    { id: 'w4', name: '天罡剑', tier: 3, tierName: '仙器', kind: 'weapon', bonusPct: 0.15, costType: 'stone', cost: 300, desc: '仙家法宝，基础战力+15%' },
    { id: 'w5', name: '诛仙剑', tier: 4, tierName: '神器', kind: 'weapon', bonusPct: 0.22, costType: 'premium', cost: 3, desc: '上古神器，基础战力+22%' },
    { id: 'w6', name: '混沌道剑', tier: 5, tierName: '道器', kind: 'weapon', bonusPct: 0.30, costType: 'premium', cost: 8, desc: '道祖遗兵，基础战力+30%' }
  ],
  OUTFITS: [
    { id: 'o1', name: '麻布衫', tier: 0, tierName: '凡衣', kind: 'outfit', bonusPct: 0.01, costType: 'stone', cost: 15, desc: '粗布衣裳，基础战力+1%' },
    { id: 'o2', name: '青竹袍', tier: 1, tierName: '灵衣', kind: 'outfit', bonusPct: 0.02, costType: 'stone', cost: 40, desc: '竹叶纹长袍，基础战力+2%' },
    { id: 'o3', name: '云纹锦', tier: 2, tierName: '宝衣', kind: 'outfit', bonusPct: 0.04, costType: 'stone', cost: 100, desc: '云纹织锦，基础战力+4%' },
    { id: 'o4', name: '霓裳羽衣', tier: 3, tierName: '仙衣', kind: 'outfit', bonusPct: 0.06, costType: 'premium', cost: 2, desc: '流光羽衣，基础战力+6%' },
    { id: 'o5', name: '龙鳞甲', tier: 4, tierName: '神衣', kind: 'outfit', bonusPct: 0.10, costType: 'premium', cost: 4, desc: '龙鳞护甲，基础战力+10%' },
    { id: 'o6', name: '混沌道袍', tier: 5, tierName: '道衣', kind: 'outfit', bonusPct: 0.15, costType: 'premium', cost: 7, desc: '道祖法衣，基础战力+15%' }
  ],
  MALL_CATALOG: [
    // 功法：提升每日灵气
    { id: 'g1', cat: 'gongfa', name: '基础吐纳法', desc: '每日修炼灵气 +2', costType: 'stone', cost: 30, effect: { type: 'gongfa', val: 2 } },
    { id: 'g2', cat: 'gongfa', name: '周天功法', desc: '每日修炼灵气 +5', costType: 'stone', cost: 80, effect: { type: 'gongfa', val: 5 } },
    { id: 'g3', cat: 'gongfa', name: '太上感应篇', desc: '每日修炼灵气 +10', costType: 'stone', cost: 200, effect: { type: 'gongfa', val: 10 } },
    // 丹药：即时/一次性
    { id: 'd1', cat: 'dan', name: '聚气丹', desc: '立即获得 30 灵气', costType: 'stone', cost: 20, effect: { type: 'spirit', val: 30 } },
    { id: 'd2', cat: 'dan', name: '大还丹', desc: '立即获得 100 灵气', costType: 'stone', cost: 60, effect: { type: 'spirit', val: 100 } },
    { id: 'd3', cat: 'dan', name: '洗髓丹', desc: '立即获得 200 灵气', costType: 'premium', cost: 2, effect: { type: 'spirit', val: 200 } },
    { id: 'd4', cat: 'dan', name: '破境丹', desc: '下次突破消耗 -20%', costType: 'premium', cost: 3, effect: { type: 'btDiscount', val: 0.2 } },
    // 修炼道具
    { id: 'pet1', cat: 'xiulian', name: '换形符', desc: '免费切换形象 1 次', costType: 'stone', cost: 15, effect: { type: 'freeSwitch' } },
    { id: 'pet2', cat: 'xiulian', name: '形象锁', desc: '锁定形象，避免误切', costType: 'premium', cost: 1, effect: { type: 'lock' } },
    { id: 'pet3', cat: 'xiulian', name: '双倍修炼卡', desc: '下次修炼灵气翻倍', costType: 'stone', cost: 25, effect: { type: 'doubleCultivate' } },
    { id: 'pet4', cat: 'xiulian', name: '灵兽口粮', desc: '立即获得 50 灵气', costType: 'stone', cost: 35, effect: { type: 'spirit', val: 50 } }
  ]
};

// —— 身体造型标志（决定 SVG 立绘细节） ——
function xiuxianBodyFlags(body) {
  switch (body) {
    case 'cat': return { ears: 'cat', tail: true };
    case 'dog': return { ears: 'round', tongue: true };
    case 'bunny': return { ears: 'long' };
    case 'fox': return { ears: 'point', tail: true };
    case 'bear': return { ears: 'round' };
    case 'panda': return { ears: 'round', eyePatch: true };
    case 'tiger': return { ears: 'round', stripe: true };
    case 'lion': return { mane: true };
    case 'frog': return { eyesTop: true };
    case 'turtle': return { shell: true };
    case 'unicorn': return { horn: true };
    case 'penguin': return { beak: true, belly: true };
    case 'round': return {};
    case 'bird': return { beak: true, wings: true };
    case 'fish': return { fin: true, nolegs: true };
    case 'bug': return { wings: true, tiny: true };
    case 'sprout': return { sprout: true };
    case 'flower': return { flower: true };
    case 'tree': return { tree: true };
    case 'fruit': return { fruit: true };
    case 'mushroom': return { mushroom: true };
    case 'cactus': return { cactus: true };
    case 'grass': return { grass: true };
    case 'boy': return { hair: 'short' };
    case 'girl': return { hair: 'long', bow: true };
    case 'knight': return { hat: 'helmet' };
    case 'mage': return { hat: 'wizard' };
    case 'princess': return { hat: 'crown', hair: 'long' };
    case 'ninja': return { mask: true };
    case 'robot': return { antenna: true, mech: true };
    case 'mermaid': return { tail: true, nolegs: true };
    case 'hero': return { hero: true, aura: true };
    case 'monster': return { horn: true, aura: true };
    case 'mech': return { antenna: true, mech: true, aura: true };
    case 'legend': return { legend: true, aura: true, crown: true };
    default: return {};
  }
}

// —— SVG Q 版立绘生成（Stage 2） ——
function xiuxianAvatarSVG(char, p) {
  let lg = xiuxianLinggenObj(p.linggen);
  let realm = xiuxianRealmObj(p.realm);
  let stage = xiuxianEvoStage(p);
  let body = char.body || 'round';
  const f = xiuxianBodyFlags(body);
  const col = char.color || '#7EC8E3';
  const dark = xiuxianShade(col, -45);
  let tierColors = ['#9E9E9E','#4CAF50','#2196F3','#AB47BC','#FF7043','#FFD700'];
  const humanBodies = ['boy','girl','knight','mage','princess','ninja','hero','legend'];
  const animalBodies = ['cat','dog','bunny','fox','bear','panda','tiger','lion','frog','turtle','penguin','bird','fish','bug','unicorn'];
  const plantBodies = ['sprout','flower','tree','fruit','mushroom','cactus','grass'];
  let s = '<svg class="x-avatar-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">';
  // 境界光环（突破大境界明显变化）
  if (p.realm >= 1) {
    const rr = 74 + p.realm * 3;
    s += '<circle cx="100" cy="104" r="' + rr + '" fill="none" stroke="' + realm.color + '" stroke-width="3" opacity="0.4"/>';
  }
  // 进化光环（中期/后期）
  if (stage === '中期') s += '<circle cx="100" cy="104" r="84" fill="none" stroke="' + lg.color + '" stroke-width="7" opacity="0.18"/>';
  if (stage === '后期') {
    s += '<circle cx="100" cy="104" r="84" fill="none" stroke="' + lg.color + '" stroke-width="7" opacity="0.24"/>';
    s += '<circle cx="100" cy="104" r="92" fill="none" stroke="' + lg.color + '" stroke-width="3" opacity="0.32"/>';
    s += '<text x="34" y="46" font-size="18" fill="' + lg.color + '">✦</text><text x="162" y="58" font-size="14" fill="' + lg.color + '">✦</text><text x="150" y="156" font-size="18" fill="' + lg.color + '">✦</text>';
  }
  // 羽翼（限定/高境/拥有外观）
  if (f.wings || f.aura || (p.cosmetics && p.cosmetics.wings)) {
    s += '<path d="M38 108 q-24 -12 -32 8 q16 8 32 2z" fill="' + col + '" opacity="0.6"/><path d="M162 108 q24 -12 32 8 q-16 8 -32 2z" fill="' + col + '" opacity="0.6"/>';
  }
  // 祥云底座
  if (p.cosmetics && p.cosmetics.cloud) s += '<ellipse cx="100" cy="170" rx="46" ry="10" fill="#cfe8ff" opacity="0.7"/>';
  // 身体
  if (f.nolegs) {
    s += '<ellipse cx="100" cy="128" rx="40" ry="44" fill="' + col + '" stroke="' + dark + '" stroke-width="3"/>';
  } else {
    s += '<ellipse cx="100" cy="120" rx="44" ry="48" fill="' + col + '" stroke="' + dark + '" stroke-width="3"/>';
  }
  if (f.belly) s += '<ellipse cx="100" cy="128" rx="26" ry="30" fill="#fff" opacity="0.85"/>';
  if (f.shell) s += '<path d="M60 118 a40 40 0 0 0 80 0z" fill="' + dark + '" opacity="0.5"/>';
  // 顶部装饰
  if (f.horn) s += '<path d="M86 74 l-8 -22 14 14z" fill="#FFD700"/><path d="M114 74 l8 -22 -14 14z" fill="#FFD700"/>';
  if (f.ears === 'cat') s += '<path d="M64 78 l-6 -30 26 16z" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/><path d="M136 78 l6 -30 -26 16z" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/>';
  if (f.ears === 'round') s += '<circle cx="70" cy="72" r="13" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/><circle cx="130" cy="72" r="13" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/>';
  if (f.ears === 'long') s += '<ellipse cx="72" cy="54" rx="9" ry="26" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/><ellipse cx="128" cy="54" rx="9" ry="26" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/>';
  if (f.ears === 'point') s += '<path d="M66 80 l-2 -28 22 18z" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/><path d="M134 80 l2 -28 -22 18z" fill="' + col + '" stroke="' + dark + '" stroke-width="2"/>';
  if (f.mane) s += '<circle cx="100" cy="92" r="58" fill="' + dark + '" opacity="0.35"/>';
  if (f.sprout) s += '<path d="M100 78 q-2 -22 0 -30" stroke="#4CAF50" stroke-width="4" fill="none"/><path d="M100 60 q-14 -6 -16 -18 q14 -2 16 12z" fill="#66BB6A"/><path d="M100 60 q14 -6 16 -18 q-14 -2 -16 12z" fill="#66BB6A"/>';
  if (f.flower) s += '<g fill="#FF80AB"><circle cx="100" cy="56" r="6"/><circle cx="86" cy="62" r="6"/><circle cx="114" cy="62" r="6"/><circle cx="92" cy="48" r="6"/><circle cx="108" cy="48" r="6"/></g><circle cx="100" cy="56" r="5" fill="#FFD54F"/>';
  if (f.tree) s += '<rect x="94" y="50" width="12" height="30" fill="#8D6E63"/><circle cx="100" cy="48" r="20" fill="#66BB6A"/>';
  if (f.mushroom) s += '<path d="M76 66 q24 -34 48 0z" fill="#E53935"/><circle cx="90" cy="54" r="4" fill="#fff"/><circle cx="110" cy="58" r="4" fill="#fff"/>';
  if (f.cactus) s += '<rect x="92" y="50" width="16" height="30" rx="8" fill="#66BB6A"/>';
  if (f.hat === 'helmet') s += '<path d="M72 76 a28 28 0 0 1 56 0z" fill="#90A4AE" stroke="#607D8B" stroke-width="2"/>';
  if (f.hat === 'wizard') s += '<path d="M70 78 L100 36 L130 78z" fill="#5E35B1"/><circle cx="100" cy="40" r="4" fill="#FFD54F"/>';
  if (f.crown || f.hat === 'crown' || (p.realm >= 5) || f.crown) s += '<path d="M78 60 l8 -16 14 12 14 -12 8 16z" fill="#FFD700" stroke="#caa" stroke-width="1"/>';
  if (f.antenna) s += '<line x1="100" y1="74" x2="100" y2="52" stroke="' + dark + '" stroke-width="3"/><circle cx="100" cy="48" r="5" fill="#FF5252"/>';
  if (f.hair === 'long') s += '<path d="M64 86 q-6 30 8 44 l8 -10 q-8 -20 -2 -34z" fill="' + dark + '"/><path d="M136 86 q6 30 -8 44 l-8 -10 q8 -20 2 -34z" fill="' + dark + '"/>';
  if (f.bow) s += '<path d="M132 70 l16 -8 -4 14z" fill="#FF80AB"/><path d="M132 70 l-16 -8 4 14z" fill="#FF80AB"/>';
  if (f.mask) s += '<rect x="76" y="96" width="48" height="12" rx="6" fill="#37474F" opacity="0.7"/>';
  if (p.cosmetics && p.cosmetics.robe) s += '<path d="M60 168 q40 -20 80 0z" fill="' + lg.color + '" opacity="0.5"/>';
  if (p.cosmetics && p.cosmetics.halo) s += '<circle cx="100" cy="104" r="80" fill="none" stroke="' + lg.color + '" stroke-width="4" opacity="0.5"/>';
  // 眼睛
  if (f.eyesTop) {
    s += '<circle cx="84" cy="92" r="11" fill="#fff"/><circle cx="116" cy="92" r="11" fill="#fff"/>';
    s += '<circle cx="86" cy="94" r="5" fill="#222"/><circle cx="114" cy="94" r="5" fill="#222"/>';
  } else {
    s += '<circle cx="84" cy="110" r="11" fill="#fff"/><circle cx="116" cy="110" r="11" fill="#fff"/>';
    s += '<circle cx="86" cy="112" r="5" fill="#222"/><circle cx="114" cy="112" r="5" fill="#222"/>';
    s += '<circle cx="84" cy="107" r="2" fill="#fff"/><circle cx="112" cy="107" r="2" fill="#fff"/>';
  }
  // 腮红 + 嘴
  s += '<ellipse cx="70" cy="124" rx="7" ry="4" fill="#ff9aa2" opacity="0.7"/><ellipse cx="130" cy="124" rx="7" ry="4" fill="#ff9aa2" opacity="0.7"/>';
  if (f.beak) s += '<path d="M94 126 l12 0 -6 8z" fill="#FF9800"/>';
  else s += '<path d="M92 128 q8 8 16 0" stroke="#a0525a" stroke-width="2" fill="none"/>';
  // 服装层（覆盖身体，后渲染在上）
  if (p.equipOutfit) {
    const out = xiuxianOutfitObj(p.equipOutfit);
    const oCol = out ? tierColors[out.tier] : '#999';
    if (humanBodies.indexOf(body) >= 0) {
      s += '<path d="M62 128 q38 30 76 0 l12 54 h-100 z" fill="' + oCol + '" opacity="0.55"/>';
    } else if (animalBodies.indexOf(body) >= 0) {
      s += '<path d="M56 118 q44 18 88 0 l-8 26 q-36 12 -72 0 z" fill="' + oCol + '" opacity="0.5"/>';
    } else {
      s += '<path d="M60 135 q40 22 80 0 l-6 32 q-34 14 -68 0 z" fill="' + oCol + '" opacity="0.5"/>';
    }
  }
  // 兵器层（最上层）
  if (p.equipWeapon) {
    const weap = xiuxianWeaponObj(p.equipWeapon);
    const wCol = weap ? tierColors[weap.tier] : '#999';
    if (humanBodies.indexOf(body) >= 0) {
      s += '<g transform="translate(134,84) scale(0.6)"><rect x="9" y="0" width="6" height="50" fill="' + wCol + '"/><polygon points="12,0 3,-12 21,-12" fill="' + wCol + '"/><circle cx="12" cy="52" r="6" fill="#D4AF37"/></g>';
    } else if (animalBodies.indexOf(body) >= 0) {
      s += '<g transform="translate(138,64) scale(0.5) rotate(30)"><rect x="9" y="0" width="6" height="46" fill="' + wCol + '"/><polygon points="12,0 3,-12 21,-12" fill="' + wCol + '"/><circle cx="12" cy="48" r="6" fill="#D4AF37"/></g>';
    } else {
      s += '<g transform="translate(140,96) scale(0.55) rotate(-20)"><rect x="9" y="0" width="6" height="48" fill="' + wCol + '"/><polygon points="12,0 3,-12 21,-12" fill="' + wCol + '"/><circle cx="12" cy="50" r="6" fill="#D4AF37"/></g>';
    }
  }
  // 限定星标
  if (char.rarity === 'limited') s += '<text x="100" y="26" font-size="20" fill="#FFD700" text-anchor="middle">★</text>';
  s += '</svg>';
  return s;
}

// —— 辅助函数 ——
function xiuxianGetChar(id) { return XIUXIAN_POOL.find(function (c) { return c.id === id; }) || XIUXIAN_POOL[0]; }
function xiuxianRandomCommonChar() {
  const commons = XIUXIAN_POOL.filter(function (c) { return c.rarity !== 'limited'; });
  return commons[Math.floor(Math.random() * commons.length)];
}
function xiuxianCalcLinggen(studentId) {
  let latest = null, latestDate = '';
  (state.scores || []).forEach(function (s) {
    let sid = s.studentId || s.student_id;
    if (sid !== studentId) return;
    let d = s.date || s.exam_date || '';
    if (!latest || d >= latestDate) { latest = s; latestDate = d; }
  });
  const sc = latest ? (latest.score || 0) : 0;
  let lvs = XIUXIAN_RULES.LINGGEN_LEVELS;
  for (let i = 0; i < lvs.length; i++) { if (sc >= lvs[i].minScore && sc <= lvs[i].maxScore) return lvs[i].name; }
  return lvs[lvs.length - 1].name;
}
function xiuxianLinggenObj(name) {
  let lvs = XIUXIAN_RULES.LINGGEN_LEVELS;
  for (let i = 0; i < lvs.length; i++) { if (lvs[i].name === name) return lvs[i]; }
  return lvs[0];
}
function xiuxianRealmObj(idx) { return XIUXIAN_RULES.REALMS[idx] || XIUXIAN_RULES.REALMS[0]; }
function xiuxianEvoStage(p) {
  return ['初期', '中期', '后期'][p.stage || 0];
}
function xiuxianLinggenIdx(name) {
  const lvs = XIUXIAN_RULES.LINGGEN_LEVELS;
  for (let i = 0; i < lvs.length; i++) { if (lvs[i].name === name) return i; }
  return 0;
}
function xiuxianLinggenFrameClass(linggenName) {
  return 'x-lg-frame-' + xiuxianLinggenIdx(linggenName);
}
function xiuxianWeaponObj(weaponId) {
  return XIUXIAN_RULES.WEAPONS.find(function(w){return w.id===weaponId;}) || null;
}
function xiuxianOutfitObj(outfitId) {
  return XIUXIAN_RULES.OUTFITS.find(function(o){return o.id===outfitId;}) || null;
}
function xiuxianWeaponBonusPct(p) {
  if (!p.equipWeapon) return 0;
  let w = xiuxianWeaponObj(p.equipWeapon);
  return w ? w.bonusPct : 0;
}
function xiuxianOutfitBonusPct(p) {
  if (!p.equipOutfit) return 0;
  let o = xiuxianOutfitObj(p.equipOutfit);
  return o ? o.bonusPct : 0;
}
function xiuxianBaseCombat(p) {
  let base = xiuxianRealmObj(p.realm).baseCombat;
  let spirit = Math.round(p.spirit);
  let gong = (p.gongfaBonus || 0) * 5;
  return base + spirit + gong;
}
function xiuxianCombat(p) {
  let base = xiuxianBaseCombat(p);
  let wPct = xiuxianWeaponBonusPct(p);
  let oPct = xiuxianOutfitBonusPct(p);
  return Math.round(base * (1 + wPct + oPct));
}
function xiuxianCombatBreakdown(p) {
  const base = xiuxianBaseCombat(p);
  const realmBase = xiuxianRealmObj(p.realm).baseCombat;
  let spirit = Math.round(p.spirit);
  const gong = (p.gongfaBonus || 0) * 5;
  const wPct = xiuxianWeaponBonusPct(p);
  const oPct = xiuxianOutfitBonusPct(p);
  const wBonus = Math.round(base * wPct);
  const oBonus = Math.round(base * oPct);
  let total = Math.round(base * (1 + wPct + oPct));
  let w = p.equipWeapon ? xiuxianWeaponObj(p.equipWeapon) : null;
  let o = p.equipOutfit ? xiuxianOutfitObj(p.equipOutfit) : null;
  return {
    base: realmBase, baseLabel: xiuxianRealmObj(p.realm).name + '基础',
    spirit: spirit, spiritLabel: '灵气',
    gong: gong, gongLabel: '功法加成',
    weapon: wBonus, weaponLabel: w ? (w.name + ' +' + Math.round(w.bonusPct*100) + '%') : '未装备兵器',
    outfit: oBonus, outfitLabel: o ? (o.name + ' +' + Math.round(o.bonusPct*100) + '%') : '未装备服装',
    total: total
  };
}
function xiuxianShowCombat(id) {
  let p = xiuxianProfile(id); if (!p) return;
  const bd = xiuxianCombatBreakdown(p);
  let rows = '<div class="x-combat-row"><span>境界基础</span><b>' + bd.base + '</b><small>' + bd.baseLabel + '</small></div>' +
    '<div class="x-combat-row"><span>灵气</span><b>' + bd.spirit + '</b><small>' + bd.spiritLabel + '</small></div>' +
    '<div class="x-combat-row"><span>功法加成</span><b>' + bd.gong + '</b><small>' + bd.gongLabel + '</small></div>' +
    '<div class="x-combat-row"><span>兵器加成</span><b>' + bd.weapon + '</b><small>' + bd.weaponLabel + '</small></div>' +
    '<div class="x-combat-row"><span>服装加成</span><b>' + bd.outfit + '</b><small>' + bd.outfitLabel + '</small></div>' +
    '<div class="x-combat-row total"><span>总战力</span><b>' + bd.total + '</b></div>';
  let html = '<div class="x-modal-head"><span class="x-modal-title">⚔ 战力构成 · ' + escapeHtml((state.students.find(function(s){return s.id===id;})||{}).name||'同学') + '</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body"><div class="x-combat-table">' + rows + '</div>' +
    '<div class="x-tip">兵器/服装按「境界基础+灵气+功法」的百分比加成战力，灵石不再影响战力。</div>' +
    '</div>';
  xiuxianModal(html);
}
function xiuxianMyRank(id, scope, mode) {
  let s = (state.students || []).find(function(x){return x.id===id;});
  if (!s) return { rank: 0, total: 0 };
  let list = (state.students || []).filter(function(x){ return scope === 'grade' || x.classId === s.classId; }).map(function(x){
    let p = state.xiuxian.students[x.id]; if (!p) return null;
    return { id: x.id, p: p };
  }).filter(Boolean);
  list.sort(function(a,b){
    if (mode === 'combat') return xiuxianCombat(b.p) - xiuxianCombat(a.p);
    if (mode === 'realm') return (b.p.realm - a.p.realm) || (b.p.spirit - a.p.spirit);
    return (b.p.premium || 0) - (a.p.premium || 0);
  });
  let rank = 0;
  for (let i = 0; i < list.length; i++) { if (list[i].id === id) { rank = i + 1; break; } }
  return { rank: rank, total: list.length };
}
function xiuxianTodayStr() { let d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function xiuxianWeekKey() { const d = new Date(); const one = (d.getDay() + 6) % 7; d.setDate(d.getDate() - one); return d.getFullYear() + 'W' + d.getMonth() + d.getDate(); }

// —— 状态管理 ——
function ensureXiuxian() {
  if (!state.xiuxian) state.xiuxian = { view: 'archive', activeClass: null, activeStudent: null, students: {}, meta: {}, hwClaimed: {}, customTasks: [] };
  if (!state.xiuxian.students) state.xiuxian.students = {};
  if (!state.xiuxian.meta) state.xiuxian.meta = {};
  if (!state.xiuxian.hwClaimed) state.xiuxian.hwClaimed = {};
  if (!state.xiuxian.customTasks) state.xiuxian.customTasks = [];
  const cur = state.xiuxian.students;
  (state.students || []).forEach(function (s, i) {
    if (!cur[s.id]) {
      let ch = xiuxianRandomCommonChar();
      const squad = (i % XIUXIAN_RULES.SQUAD_RULES.squadsPerClass) + 1;
      cur[s.id] = xiuxianNewProfile(ch.id, squad);
    } else {
      // 补齐新字段（向后兼容）
      const def = xiuxianNewProfile(cur[s.id].characterId, cur[s.id].squad);
      for (const k in def) { if (def.hasOwnProperty(k) && cur[s.id][k] === undefined) cur[s.id][k] = def[k]; }
      // 旧版 weapon 字段迁移到新版 equipWeapon
      if (cur[s.id].weapon && !cur[s.id].equipWeapon) cur[s.id].equipWeapon = cur[s.id].weapon;
    }
    // 灵根始终按最新成绩自动刷新（设计：灵根=最新测试成绩）
    cur[s.id].linggen = xiuxianCalcLinggen(s.id);
  });
}
function xiuxianNewProfile(charId, squad) {
  return {
    characterId: charId, realm: 0, spirit: 0, stone: 15, premium: 0,
    linggen: '凡品', switchUsed: false, squad: String(squad || 1), isLeader: false,
    pityCount: 0, lastPremiumTs: 0, lastCultivateDay: '', btFails: 0,
    gongfaBonus: 0, doubleCultivate: false, switchLocked: false, cosmetics: {},
    lastBreakthroughTier: 1, stage: 0, spiritOverflow: 0,
    autoCultivate: true, autoStoneConvert: true,
    weapon: null, weaponInventory: [],
    equipWeapon: null, equipOutfit: null, outfitInventory: []
  };
}
function xiuxianProfile(id) { ensureXiuxian(); return state.xiuxian.students[id]; }

// —— 导航 ——
function xiuxianSelectClass(cls) { ensureXiuxian(); state.xiuxian.view = 'class-home'; state.xiuxian.activeClass = cls; state.xiuxian.activeStudent = null; xiuxianAutoRoutine(); saveState(); renderPage(); }
function xiuxianSelectStudent(id) { console.log('[xiuxianSelectStudent] id=', id, 'currentPage=', state.currentPage); ensureXiuxian(); state.xiuxian.view = 'student-home'; state.xiuxian.activeStudent = id; saveState(); renderPage(); }
function xiuxianBackToClass() { navigateTo('xiuxian-archive'); }
function xiuxianBackToSelect() { navigateTo('xiuxian-archive'); }

function xiuxianRecalcLinggenSilent() {
  ensureXiuxian();
  for (const k in state.xiuxian.students) {
    if (state.xiuxian.students.hasOwnProperty(k)) {
      state.xiuxian.students[k].linggen = xiuxianCalcLinggen(k);
    }
  }
}
function xiuxianRefreshLinggen() {
  xiuxianRecalcLinggenSilent();
  saveState({pushUndo:true}); renderPage();
  showToast('已按最新成绩刷新 ' + Object.keys(state.xiuxian.students).length + ' 名学生灵根', 'success');
}

// —— 例行（Stage 3）：每日修炼发放 + 每周一队长俸禄 ——
function xiuxianAutoRoutine() {
  let meta = state.xiuxian.meta;
  xiuxianAutoCultivate();
  xiuxianDailyStoneToSpirit();
  const wk = xiuxianWeekKey();
  if (meta.lastWeeklyWeek !== wk) { xiuxianWeeklyRoutineAll(); meta.lastWeeklyWeek = wk; saveState(); }
  // 作业灵石12小时自动同步
  xiuxianAutoSyncHw();
}
function xiuxianAutoSyncHw() {
  ensureXiuxian();
  let meta = state.xiuxian.meta;
  let now = Date.now();
  const lastTs = meta.lastHwSyncTs || 0;
  // 检查是否有未领取的作业灵石
  let claimed = state.xiuxian.hwClaimed || {};
  const hasUnclaimed = (state.homeworkRecords || []).some(function(r){
    if (r.status === 'pending') return false;
    let key = r.studentId + '_' + r.taskId;
    return !claimed[key];
  });
  if (!hasUnclaimed) { meta.lastHwSyncTs = now; return; }
  // 12小时无操作自动同步
  const AUTO_SYNC_MS = 12 * 3600000;
  if (now - lastTs < AUTO_SYNC_MS) return;
  // 执行静默自动同步（不弹toast、不renderPage）
  let fc = '';
  let hw = (state.homeworkRecords || []).filter(function(r){
    if (r.status === 'pending') return false;
    return true;
  });
  let total = 0, cnt = 0, premiumGot = 0;
  let cfg = XIUXIAN_RULES.PREMIUM_STONE;
  hw.forEach(function(r){
    let key = r.studentId + '_' + r.taskId;
    if (claimed[key]) return;
    let stones = HW_STONE_RULES[r.status] || 0;
    if (stones > 0 && state.xiuxian.students[r.studentId]) {
      state.xiuxian.students[r.studentId].stone += stones;
      total += stones; cnt++;
      let p = state.xiuxian.students[r.studentId];
      let inWindow = (now - (p.lastPremiumTs || 0)) < cfg.pityWindowDays * 86400000;
      let pity = inWindow ? (p.pityCount || 0) : 0;
      let guaranteed = pity >= cfg.pityThreshold;
      let rate = guaranteed ? 1 : Math.min(1, cfg.dropBaseRate + pity * cfg.dropRateIncrement);
      if (Math.random() < rate || guaranteed) {
        p.premium += 1; p.pityCount = 0; p.lastPremiumTs = now; premiumGot++;
      } else {
        p.pityCount = pity + 1; p.lastPremiumTs = now;
      }
    }
    claimed[key] = true;
  });
  state.xiuxian.hwClaimed = claimed;
  meta.lastHwSyncTs = now;
  saveState({pushUndo:true});
}
function xiuxianWeeklyRoutineAll() {
  const perClass = XIUXIAN_RULES.SQUAD_RULES.leaderWeeklyStone;
  let cnt = 0;
  for (const k in state.xiuxian.students) {
    if (!state.xiuxian.students.hasOwnProperty(k)) continue;
    if (state.xiuxian.students[k].isLeader) { state.xiuxian.students[k].stone += perClass; cnt++; }
  }
  return cnt;
}
function xiuxianWeeklyRoutine(cls) {
  ensureXiuxian();
  let cnt = 0;
  (state.students || []).forEach(function (s) {
    if (s.classId !== cls) return;
    let p = state.xiuxian.students[s.id];
    if (p && p.isLeader) { p.stone += XIUXIAN_RULES.SQUAD_RULES.leaderWeeklyStone; cnt++; }
  });
  saveState({pushUndo:true}); renderPage();
  showToast('已发放队长周俸（' + cnt + ' 名队长，各 +' + XIUXIAN_RULES.SQUAD_RULES.leaderWeeklyStone + ' 灵石）', 'success');
}
function xiuxianAutoCultivate() {
  ensureXiuxian();
  let t = xiuxianTodayStr();
  let meta = state.xiuxian.meta;
  if (meta.lastCultivateDay === t) return;
  let ratio = XIUXIAN_RULES.AUTO_SPIRIT_TO_STONE_RATIO || 5;
  let advanced = 0, converted = 0;
  for (const k in state.xiuxian.students) {
    if (!state.xiuxian.students.hasOwnProperty(k)) continue;
    let p = state.xiuxian.students[k];
    if (p.realm >= 6) continue;
    let lg = xiuxianLinggenObj(p.linggen);
    let cap = Math.max(xiuxianRealmObj(p.realm).spiritCap, 10);
    let gain = lg.dailySpirit + (p.gongfaBonus || 0);
    if (p.doubleCultivate) { gain *= 2; p.doubleCultivate = false; }
    // 自动修炼开关：关闭后每日灵气直接转灵石
    if (p.autoCultivate === false) {
      const totalOff = (p.spiritOverflow || 0) + gain;
      const stonesOff = Math.floor(totalOff / ratio);
      if (stonesOff > 0) { p.stone += stonesOff; converted += stonesOff; }
      p.spiritOverflow = totalOff % ratio;
      continue;
    }
    p.spirit += gain; advanced++;
    converted += xiuxianTrySmallBreakthrough(p);
  }
  meta.lastCultivateDay = t;
  saveState({pushUndo:true});
}
function xiuxianTrySmallBreakthrough(p) {
  if (p.realm >= 6) return 0;
  let cap = Math.max(xiuxianRealmObj(p.realm).spiritCap, 10);
  while (p.spirit >= cap && (p.stage || 0) < 2) {
    p.spirit -= cap; p.stage = (p.stage || 0) + 1;
  }
  let converted = 0;
  if (p.spirit > cap) {
    let total = (p.spiritOverflow || 0) + (p.spirit - cap);
    const ratio = XIUXIAN_RULES.AUTO_SPIRIT_TO_STONE_RATIO || 3;
    let stones = Math.floor(total / ratio);
    if (stones > 0) { p.stone += stones; converted = stones; }
    p.spiritOverflow = total % ratio; p.spirit = cap;
  }
  return converted;
}
function xiuxianDailyStoneToSpirit() {
  ensureXiuxian();
  let t = xiuxianTodayStr();
  const meta = state.xiuxian.meta;
  if (meta.lastStoneConvertDay === t) return;
  let rate = XIUXIAN_RULES.STONE_TO_SPIRIT_RATE || 3;
  for (const k in state.xiuxian.students) {
    if (!state.xiuxian.students.hasOwnProperty(k)) continue;
    let p = state.xiuxian.students[k];
    if (p.autoStoneConvert === false || !p.stone) continue;
    let cap = Math.max(xiuxianRealmObj(p.realm).spiritCap, 10);
    if (p.spirit >= cap) continue;
    let need = Math.max(0, Math.floor((cap - p.spirit) / rate));
    const use = Math.min(need, p.stone);
    if (use > 0) { p.stone -= use; p.spirit += use * rate; xiuxianTrySmallBreakthrough(p); }
  }
  meta.lastStoneConvertDay = t;
  saveState({pushUndo:true});
}
function xiuxianToggleAutoCultivate(id) {
  let p = xiuxianProfile(id); if (!p) return;
  p.autoCultivate = p.autoCultivate === false;
  saveState({pushUndo:true}); renderPage();
  showToast(p.autoCultivate ? '已开启自动修炼' : '已关闭自动修炼，灵气将自动转灵石', 'info');
}
function xiuxianToggleAutoStoneConvert(id) {
  let p = xiuxianProfile(id); if (!p) return;
  p.autoStoneConvert = p.autoStoneConvert === false;
  saveState({pushUndo:true}); renderPage();
  showToast(p.autoStoneConvert ? '已开启每日灵石自动兑灵气' : '已关闭每日灵石自动兑灵气', 'info');
}

// —— 核心动作 ——
function xiuxianCultivateInfo(id) {
  let p = xiuxianProfile(id); if (!p) return;
  let lg = xiuxianLinggenObj(p.linggen);
  let cap = Math.max(xiuxianRealmObj(p.realm).spiritCap, 10);
  let gain = lg.dailySpirit + (p.gongfaBonus || 0);
  let stage = xiuxianEvoStage(p);
  const atMax = (p.stage || 0) >= 2 && p.spirit >= cap;
  let msg = '自动修炼：每日灵气 +' + gain + '（' + lg.displayLabel + '）';
  if (atMax && p.realm < 6) msg += '，灵气已满，可突破大境界！';
  else if ((p.stage || 0) >= 2) msg += '，溢出灵气自动转灵石(3:1)';
  showToast(msg, atMax && p.realm < 6 ? 'warn' : 'info');
}
function xiuxianExchange(id) {
  let p = xiuxianProfile(id); if (!p) return;
  let rate = XIUXIAN_RULES.STONE_TO_SPIRIT_RATE;
  let cap = Math.max(xiuxianRealmObj(p.realm).spiritCap, 10);
  const maxCan = Math.floor((cap - p.spirit) / rate);
  const maxStones = Math.min(p.stone, Math.max(maxCan, 0));
  let html = '<div class="x-modal-head"><span class="x-modal-title">💱 灵石兑灵气 · ' + escapeHtml((state.students.find(function(s){return s.id===id;})||{}).name||'同学') + '</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body">' +
    '<div class="x-exchange-info"><div>💰 灵石：<b>' + p.stone + '</b></div><div>🌀 灵气：<b>' + p.spirit + ' / ' + cap + '</b></div><div>📊 兑换比：1灵石 → ' + rate + '灵气</div></div>' +
    '<div class="x-exchange-input"><label>兑换数量</label><input type="number" id="xExAmount" value="1" min="1" max="' + p.stone + '" /><span>灵石</span></div>' +
    '<div class="x-exchange-quick"><button class="btn btn-sm" data-click="__dcSetXEx" data-click-args="[1]">1颗</button>' +
    '<button class="btn btn-sm" data-click="__dcSetXEx" data-click-args="[5]">5颗</button>' +
    '<button class="btn btn-sm" data-click="__dcSetXEx" data-click-args="[10]">10颗</button>' +
    '<button class="btn btn-sm" data-click="__dcSetXEx" data-click-args="' + escapeAttr(JSON.stringify([maxStones])) + '">最大</button></div>' +
    '<div class="x-exchange-preview" id="xExPreview">可获得 <b>' + rate + '</b> 灵气</div>' +
    '<button class="btn btn-primary" style="width:100%;margin-top:8px" data-click="xiuxianExchangeConfirm" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">确认兑换</button>' +
    '</div>';
  xiuxianModal(html);
  setTimeout(function(){
    let inp = document.getElementById('xExAmount');
    if (inp) inp.addEventListener('input', function(){
      let v = parseInt(inp.value) || 0;
      document.getElementById('xExPreview').innerHTML = '可获得 <b>' + (v * rate) + '</b> 灵气';
    });
  }, 50);
}
function xiuxianExchangeConfirm(id) {
  let p = xiuxianProfile(id); if (!p) return;
  const inp = document.getElementById('xExAmount');
  let v = parseInt(inp ? inp.value : '1') || 0;
  if (v <= 0) { showToast('数量必须大于0', 'warn'); return; }
  if (v > p.stone) { showToast('灵石不足（当前' + p.stone + '）', 'warn'); return; }
  p.stone -= v;
  const gain = v * XIUXIAN_RULES.STONE_TO_SPIRIT_RATE;
  p.spirit += gain;
  xiuxianTrySmallBreakthrough(p);
  saveState({pushUndo:true}); renderPage();
  xiuxianCloseModal();
  showToast('兑换：' + v + '灵石 → ' + gain + '灵气', 'success');
}
let xiuxianGearTab = 'weapon';
function xiuxianOpenWeapon(id) {
  xiuxianGearTab = 'weapon';
  xiuxianRenderGear(id);
}
function xiuxianGearSetTab(id, tab) {
  xiuxianGearTab = tab;
  xiuxianRenderGear(id);
}
function xiuxianRenderGear(id) {
  let p = xiuxianProfile(id); if (!p) return;
  let s = (state.students || []).find(function(x){return x.id===id;})||{};
  const tierColors = ['#9E9E9E','#4CAF50','#2196F3','#AB47BC','#FF7043','#FFD700'];
  const tabBar = '<div class="x-wp-tabs"><span class="x-wp-tab ' + (xiuxianGearTab==='weapon'?'on':'') + '" data-click="xiuxianGearSetTab" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','weapon'])) + '">⚔ 兵器</span>' +
    '<span class="x-wp-tab ' + (xiuxianGearTab==='outfit'?'on':'') + '" data-click="xiuxianGearSetTab" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','outfit'])) + '">👘 服装</span></div>';
  let body = '';
  if (xiuxianGearTab === 'weapon') {
    let owned = p.weaponInventory || [];
    const curWeapon = p.equipWeapon ? xiuxianWeaponObj(p.equipWeapon) : null;
    const ownedList = owned.map(function(wid){
      let w = xiuxianWeaponObj(wid); if(!w) return '';
      let equipped = p.equipWeapon === wid;
      return '<div class="x-wp-card' + (equipped ? ' equipped' : '') + '" style="border-color:' + tierColors[w.tier] + '">' +
        '<div class="x-wp-name" style="color:' + tierColors[w.tier] + '">' + escapeHtml(w.name) + '</div>' +
        '<div class="x-wp-tier">' + w.tierName + '</div>' +
        '<div class="x-wp-bonus">⚔ +' + Math.round(w.bonusPct*100) + '%</div>' +
        '<div class="x-wp-desc">' + escapeHtml(w.desc) + '</div>' +
        (equipped ? '<span class="x-wp-equipped">已装备</span>' :
          '<button class="btn btn-sm btn-primary" data-click="xiuxianEquipWeapon" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','' + wid + ''])) + '">装备</button>') +
        '</div>';
    }).join('');
    const shopList = XIUXIAN_RULES.WEAPONS.filter(function(w){ return owned.indexOf(w.id) < 0; }).map(function(w){
      let costStr = w.costType === 'premium' ? ('💎 ' + w.cost) : ('💰 ' + w.cost);
      let canAfford = w.costType === 'premium' ? p.premium >= w.cost : p.stone >= w.cost;
      return '<div class="x-wp-card" style="border-color:' + tierColors[w.tier] + '">' +
        '<div class="x-wp-name" style="color:' + tierColors[w.tier] + '">' + escapeHtml(w.name) + '</div>' +
        '<div class="x-wp-tier">' + w.tierName + '</div>' +
        '<div class="x-wp-bonus">⚔ +' + Math.round(w.bonusPct*100) + '%</div>' +
        '<div class="x-wp-desc">' + escapeHtml(w.desc) + '</div>' +
        '<div class="x-wp-cost">' + costStr + '</div>' +
        '<button class="btn btn-sm ' + (canAfford ? 'btn-primary' : '') + '" ' + (canAfford ? 'data-click="xiuxianBuyWeapon" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','' + w.id + ''])) + '"' : 'disabled') + '>购买</button>' +
        '</div>';
    }).join('');
    body = '<div class="x-wp-current">' + (curWeapon ?
      '当前兵器：<b style="color:' + tierColors[curWeapon.tier] + '">' + escapeHtml(curWeapon.name) + '</b>（' + curWeapon.tierName + '）战力+' + Math.round(curWeapon.bonusPct*100) + '%' :
      '未装备兵器') +
      '<button class="btn btn-sm" ' + (p.equipWeapon ? 'data-click="xiuxianUnequipWeapon" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '"' : 'disabled') + '>卸下</button></div>' +
      '<div class="x-wp-section"><div class="x-wp-section-title">📦 我的兵器</div><div class="x-wp-grid">' + (ownedList || '<div class="x-tip">暂无兵器</div>') + '</div></div>' +
      '<div class="x-wp-section"><div class="x-wp-section-title">🛒 兵器商店</div><div class="x-wp-grid">' + (shopList || '<div class="x-tip">已拥有全部兵器</div>') + '</div></div>';
  } else {
    const oOwned = p.outfitInventory || [];
    const curOutfit = p.equipOutfit ? xiuxianOutfitObj(p.equipOutfit) : null;
    const ownedOutfitList = oOwned.map(function(oid){
      let o = xiuxianOutfitObj(oid); if(!o) return '';
      const equipped = p.equipOutfit === oid;
      return '<div class="x-wp-card' + (equipped ? ' equipped' : '') + '" style="border-color:' + tierColors[o.tier] + '">' +
        '<div class="x-wp-name" style="color:' + tierColors[o.tier] + '">' + escapeHtml(o.name) + '</div>' +
        '<div class="x-wp-tier">' + o.tierName + '</div>' +
        '<div class="x-wp-bonus">👘 +' + Math.round(o.bonusPct*100) + '%</div>' +
        '<div class="x-wp-desc">' + escapeHtml(o.desc) + '</div>' +
        (equipped ? '<span class="x-wp-equipped">已装备</span>' :
          '<button class="btn btn-sm btn-primary" data-click="xiuxianEquipOutfit" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','' + oid + ''])) + '">装备</button>') +
        '</div>';
    }).join('');
    const shopOutfitList = XIUXIAN_RULES.OUTFITS.filter(function(o){ return oOwned.indexOf(o.id) < 0; }).map(function(o){
      let costStr = o.costType === 'premium' ? ('💎 ' + o.cost) : ('💰 ' + o.cost);
      const canAfford = o.costType === 'premium' ? p.premium >= o.cost : p.stone >= o.cost;
      return '<div class="x-wp-card" style="border-color:' + tierColors[o.tier] + '">' +
        '<div class="x-wp-name" style="color:' + tierColors[o.tier] + '">' + escapeHtml(o.name) + '</div>' +
        '<div class="x-wp-tier">' + o.tierName + '</div>' +
        '<div class="x-wp-bonus">👘 +' + Math.round(o.bonusPct*100) + '%</div>' +
        '<div class="x-wp-desc">' + escapeHtml(o.desc) + '</div>' +
        '<div class="x-wp-cost">' + costStr + '</div>' +
        '<button class="btn btn-sm ' + (canAfford ? 'btn-primary' : '') + '" ' + (canAfford ? 'data-click="xiuxianBuyOutfit" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','' + o.id + ''])) + '"' : 'disabled') + '>购买</button>' +
        '</div>';
    }).join('');
    body = '<div class="x-wp-current">' + (curOutfit ?
      '当前服装：<b style="color:' + tierColors[curOutfit.tier] + '">' + escapeHtml(curOutfit.name) + '</b>（' + curOutfit.tierName + '）战力+' + Math.round(curOutfit.bonusPct*100) + '%' :
      '未装备服装') +
      '<button class="btn btn-sm" ' + (p.equipOutfit ? 'data-click="xiuxianUnequipOutfit" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '"' : 'disabled') + '>卸下</button></div>' +
      '<div class="x-wp-section"><div class="x-wp-section-title">📦 我的服装</div><div class="x-wp-grid">' + (ownedOutfitList || '<div class="x-tip">暂无服装</div>') + '</div></div>' +
      '<div class="x-wp-section"><div class="x-wp-section-title">🛒 服装商店</div><div class="x-wp-grid">' + (shopOutfitList || '<div class="x-tip">已拥有全部服装</div>') + '</div></div>';
  }
  let html = '<div class="x-modal-head"><span class="x-modal-title">🎒 装备库 · ' + escapeHtml(s.name||'同学') + '</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body">' + tabBar + body +
    '<div class="x-tip">💰 灵石 ' + p.stone + ' · 💎 极品灵石 ' + p.premium + ' · ⚔ 当前战力 ' + xiuxianCombat(p) + '</div>' +
    '</div>';
  xiuxianModal(html);
}
function xiuxianEquipWeapon(id, wid) {
  let p = xiuxianProfile(id); if (!p) return;
  if ((p.weaponInventory || []).indexOf(wid) < 0) { showToast('未拥有此兵器', 'warn'); return; }
  p.equipWeapon = wid; saveState({pushUndo:true}); renderPage();
  xiuxianRenderGear(id);
  showToast('已装备兵器', 'success');
}
function xiuxianUnequipWeapon(id) {
  let p = xiuxianProfile(id); if (!p) return;
  p.equipWeapon = null; saveState({pushUndo:true}); renderPage();
  xiuxianRenderGear(id);
  showToast('已卸下兵器', 'info');
}
function xiuxianBuyWeapon(id, wid) {
  let p = xiuxianProfile(id); if (!p) return;
  const w = xiuxianWeaponObj(wid); if (!w) return;
  if ((p.weaponInventory || []).indexOf(wid) >= 0) { showToast('已拥有此兵器', 'warn'); return; }
  if (w.costType === 'premium') { if (p.premium < w.cost) { showToast('极品灵石不足', 'warn'); return; } p.premium -= w.cost; }
  else { if (p.stone < w.cost) { showToast('灵石不足', 'warn'); return; } p.stone -= w.cost; }
  if (!p.weaponInventory) p.weaponInventory = [];
  p.weaponInventory.push(wid);
  p.equipWeapon = wid;
  saveState({pushUndo:true}); renderPage();
  xiuxianRenderGear(id);
  showToast('购买并装备兵器：' + w.name + '（战力+' + Math.round(w.bonusPct*100) + '%）', 'success');
}
function xiuxianEquipOutfit(id, oid) {
  let p = xiuxianProfile(id); if (!p) return;
  if ((p.outfitInventory || []).indexOf(oid) < 0) { showToast('未拥有此服装', 'warn'); return; }
  p.equipOutfit = oid; saveState({pushUndo:true}); renderPage();
  xiuxianRenderGear(id);
  showToast('已装备服装', 'success');
}
function xiuxianUnequipOutfit(id) {
  let p = xiuxianProfile(id); if (!p) return;
  p.equipOutfit = null; saveState({pushUndo:true}); renderPage();
  xiuxianRenderGear(id);
  showToast('已卸下服装', 'info');
}
function xiuxianBuyOutfit(id, oid) {
  let p = xiuxianProfile(id); if (!p) return;
  let o = xiuxianOutfitObj(oid); if (!o) return;
  if ((p.outfitInventory || []).indexOf(oid) >= 0) { showToast('已拥有此服装', 'warn'); return; }
  if (o.costType === 'premium') { if (p.premium < o.cost) { showToast('极品灵石不足', 'warn'); return; } p.premium -= o.cost; }
  else { if (p.stone < o.cost) { showToast('灵石不足', 'warn'); return; } p.stone -= o.cost; }
  if (!p.outfitInventory) p.outfitInventory = [];
  p.outfitInventory.push(oid);
  p.equipOutfit = oid;
  saveState({pushUndo:true}); renderPage();
  xiuxianRenderGear(id);
  showToast('购买并装备服装：' + o.name + '（战力+' + Math.round(o.bonusPct*100) + '%）', 'success');
}

function xiuxianExchangePremium(id) {
  let p = xiuxianProfile(id); if (!p) return;
  const need = XIUXIAN_RULES.PREMIUM_TO_STONE;
  if (p.stone < need) { showToast('灵石不足（需' + need + '兑换 1 极品灵石）', 'warn'); return; }
  p.stone -= need; p.premium += 1;
  saveState({pushUndo:true}); renderPage();
  showToast('兑换：' + need + '灵石 → 1 极品灵石 💎', 'success');
}
function xiuxianSwitchChar(id) {
  let p = xiuxianProfile(id); if (!p) return;
  if (p.switchLocked) { showToast('形象已锁定（可在商城解除）', 'warn'); return; }
  if (!p.switchUsed) { p.switchUsed = true; p.characterId = xiuxianRandomCommonChar().id; saveState({pushUndo:true}); renderPage(); showToast('首次切换免费，新形象已就位！', 'success'); return; }
  if (p.stone < XIUXIAN_RULES.SWITCH_COST_STONE) { showToast('灵石不足（需' + XIUXIAN_RULES.SWITCH_COST_STONE + '）', 'warn'); return; }
  p.stone -= XIUXIAN_RULES.SWITCH_COST_STONE; p.characterId = xiuxianRandomCommonChar().id;
  saveState({pushUndo:true}); renderPage(); showToast('已花费' + XIUXIAN_RULES.SWITCH_COST_STONE + '灵石切换形象', 'success');
}
function xiuxianDrawLimited(id, charId) {
  let p = xiuxianProfile(id); if (!p) return;
  let ch = xiuxianGetChar(charId);
  if (ch.rarity !== 'limited') { xiuxianSwitchChar(id); return; }
  let cls = ((state.students.find(function (s) { return s.id === id; })) || {}).classId || '';
  let mates = Object.keys(state.xiuxian.students).filter(function (sid) {
    return ((state.students.find(function (s) { return s.id === sid; })) || {}).classId === cls;
  });
  mates.sort(function (a, b) { return xiuxianCombat(state.xiuxian.students[b]) - xiuxianCombat(state.xiuxian.students[a]); });
  const rank = mates.indexOf(id) + 1;
  if (ch.rank_req && rank > ch.rank_req) { showToast('需班级排名前' + ch.rank_req + '（当前第' + rank + '名）', 'warn'); return; }
  let taken = 0; for (const k in state.xiuxian.students) { if (state.xiuxian.students[k].characterId === charId) taken++; }
  if (ch.quota && taken >= ch.quota) { showToast('「' + ch.name + '」限定名额已满（' + ch.quota + '）', 'warn'); return; }
  if (p.premium < ch.jipin_price) { showToast('极品灵石不足（需' + ch.jipin_price + '）', 'warn'); return; }
  p.premium -= ch.jipin_price; p.characterId = charId;
  saveState({pushUndo:true}); renderPage(); showToast('恭喜获得限定角色：' + ch.name + '！', 'success');
}
// Stage 7：突破四档概率 + 保底
function xiuxianOpenBreakthrough(id) {
  let p = xiuxianProfile(id); if (!p) return;
  if (p.realm >= 6) { showToast('已达最高境界', 'warn'); return; }
  let cap = Math.max(xiuxianRealmObj(p.realm).spiritCap, 10);
  if ((p.stage || 0) < 2 || p.spirit < cap) { showToast('需修炼至后期且灵气满溢方可突破大境界', 'warn'); return; }
  let costs = XIUXIAN_RULES.BREAKTHROUGH_COSTS[p.realm + 1];
  const baseRates = XIUXIAN_RULES.BREAKTHROUGH_BASE_RATES;
  const bonus = XIUXIAN_RULES.BREAKTHROUGH_FAIL_BONUSES;
  const fails = p.btFails || 0;
  let rows = '';
  for (let t = 1; t <= 4; t++) {
    let rate = Math.min(1, baseRates[t - 1] + fails * bonus[t - 1]);
    const guar = (t === 4) ? '（失败必成）' : '';
    rows += '<div class="x-bt-card" data-click="xiuxianBreakthrough" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '',' + t + '])) + '">' +
      '<div class="x-bt-tier">第 ' + t + ' 档</div>' +
      '<div class="x-bt-cost">消耗 ' + costs[t - 1] + ' 灵石</div>' +
      '<div class="x-bt-rate">成功率 ' + Math.round(rate * 100) + '% ' + guar + '</div></div>';
  }
  let html = '<div class="x-modal-head"><span class="x-modal-title">⚡ 突破 · ' + xiuxianRealmObj(p.realm).name + ' → ' + xiuxianRealmObj(p.realm + 1).name + '</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body"><p class="x-tip">累计失败 ' + fails + ' 次，各档成功率已提升。第 4 档失败必定成功（保底）。</p><div class="x-bt-grid">' + rows + '</div></div>';
  xiuxianModal(html);
}
function xiuxianBreakthrough(id, tier) {
  let p = xiuxianProfile(id); if (!p) return;
  if (p.realm >= 6) { showToast('已达最高境界', 'warn'); return; }
  const costs = XIUXIAN_RULES.BREAKTHROUGH_COSTS[p.realm + 1];
  let cost = costs[tier - 1];
  let rate = Math.min(1, XIUXIAN_RULES.BREAKTHROUGH_BASE_RATES[tier - 1] + (p.btFails || 0) * XIUXIAN_RULES.BREAKTHROUGH_FAIL_BONUSES[tier - 1]);
  if (p.stone < cost) { showToast('突破需 ' + cost + ' 灵石（当前 ' + p.stone + '），努力修炼吧', 'warn'); xiuxianCloseModal(); return; }
  p.stone -= cost;
  const success = Math.random() < rate || tier === 4;
  if (success) {
    p.realm += 1; p.spirit = 0; p.btFails = 0; p.lastBreakthroughTier = tier; p.stage = 0; p.spiritOverflow = 0;
    saveState({pushUndo:true}); xiuxianCloseModal(); renderPage();
    showToast('突破成功！晋升「' + xiuxianRealmObj(p.realm).name + '」🎉', 'success');
  } else {
    p.btFails = (p.btFails || 0) + 1;
    saveState({pushUndo:true});
    showToast('突破失败…（下次成功率提升）', 'warn');
    xiuxianOpenBreakthrough(id);
  }
}
// Stage 8：完成任务奖励极品灵石（概率 + 保底）
function xiuxianTaskReward(id) {
  let p = xiuxianProfile(id); if (!p) return;
  let cfg = XIUXIAN_RULES.PREMIUM_STONE;
  let now = Date.now();
  let inWindow = (now - (p.lastPremiumTs || 0)) < cfg.pityWindowDays * 86400000;
  let pity = inWindow ? (p.pityCount || 0) : 0;
  let guaranteed = pity >= cfg.pityThreshold;
  let rate = guaranteed ? 1 : Math.min(1, cfg.dropBaseRate + pity * cfg.dropRateIncrement);
  const hit = Math.random() < rate || guaranteed;
  if (hit) {
    p.premium += 1; p.pityCount = 0; p.lastPremiumTs = now;
    showToast('任务完成！获得 1 极品灵石 💎', 'success');
  } else {
    p.pityCount = pity + 1; p.lastPremiumTs = now;
    showToast('本次未掉落极品灵石（累计未得 ' + p.pityCount + '/' + cfg.pityThreshold + '，概率+' + Math.round(cfg.dropRateIncrement * 100) + '%）', 'info');
  }
  saveState({pushUndo:true}); renderPage();
}

// —— 商城（Stage 4） ——
let xiuxianMallCat = 'gongfa';
function xiuxianOpenMall(id) {
  xiuxianMallCat = 'gongfa';
  xiuxianRenderMall(id);
}
function xiuxianMallSetCat(id, cat) { xiuxianMallCat = cat; xiuxianRenderMall(id); }
function xiuxianRenderMall(id) {
  let p = xiuxianProfile(id); if (!p) return;
  let cats = [['gongfa', '功法'], ['dan', '丹药'], ['xiulian', '修炼道具']];
  const catBar = cats.map(function (c) { return '<span class="x-wp-tab ' + (c[0] === xiuxianMallCat ? 'on' : '') + '" data-click="xiuxianMallSetCat" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','' + c[0] + ''])) + '">' + c[1] + '</span>'; }).join('');
  const items = XIUXIAN_RULES.MALL_CATALOG.filter(function (it) { return it.cat === xiuxianMallCat; });
  const grid = items.map(function (it) {
    const costStr = it.costType === 'premium' ? ('💎 ' + it.cost) : ('💰 ' + it.cost);
    let e = it.effect;
    let owned = false;
    if (e.type === 'freeSwitch') owned = !!p.switchUsed;
    else if (e.type === 'lock') owned = !!p.switchLocked;
    else if (e.type === 'doubleCultivate') owned = !!p.doubleCultivate;
    else if (e.type === 'btDiscount') owned = !!(p.btDiscount && p.btDiscount >= e.val);
    const label = owned ? '已生效' : '购买';
    return '<div class="x-wp-card"><div class="x-wp-name">' + escapeHtml(it.name) + '</div>' +
      '<div class="x-wp-desc">' + escapeHtml(it.desc) + '</div>' +
      '<div class="x-wp-cost">' + costStr + '</div>' +
      '<button class="btn btn-sm ' + (owned ? '' : 'btn-primary') + '" ' + (owned ? 'disabled' : 'data-click="xiuxianBuyMall" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + '','' + it.id + ''])) + '"') + '>' + label + '</button></div>';
  }).join('');
  let html = '<div class="x-modal-head"><span class="x-modal-title">🛒 修炼商城 · ' + escapeHtml((state.students.find(function (s) { return s.id === id; }) || {}).name || '同学') + '</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body"><div class="x-wp-tabs">' + catBar + '</div><div class="x-wp-grid">' + grid + '</div>' +
    '<div class="x-tip">💰 灵石 ' + p.stone + ' · 💎 极品灵石 ' + p.premium + '。功法永久提升每日灵气；丹药即时生效；修炼道具一次性效果。</div></div>';
  xiuxianModal(html);
}
function xiuxianBuyMall(id, itemId) {
  let p = xiuxianProfile(id); if (!p) return;
  const it = XIUXIAN_RULES.MALL_CATALOG.find(function (x) { return x.id === itemId; }); if (!it) return;
  const cost = it.cost;
  if (it.costType === 'premium') { if (p.premium < cost) { showToast('极品灵石不足', 'warn'); return; } p.premium -= cost; }
  else { if (p.stone < cost) { showToast('灵石不足', 'warn'); return; } p.stone -= cost; }
  let e = it.effect;
  if (e.type === 'gongfa') { p.gongfaBonus = (p.gongfaBonus || 0) + e.val; }
  else if (e.type === 'spirit') { p.spirit += e.val; xiuxianTrySmallBreakthrough(p); }
  else if (e.type === 'freeSwitch') { p.switchUsed = true; }
  else if (e.type === 'lock') { p.switchLocked = true; }
  else if (e.type === 'doubleCultivate') { p.doubleCultivate = true; }
  else if (e.type === 'btDiscount') { p.btDiscount = Math.max(p.btDiscount || 0, e.val); }
  saveState({pushUndo:true}); renderPage();
  showToast('已购买：' + it.name, 'success');
  xiuxianRenderMall(id);
}

// —— 排行榜（Stage 5） ——
let xiuxianRankMode = 'combat', xiuxianRankAnon = false;
function xiuxianOpenRank(cls) {
  if (cls) { state.xiuxian._rankCls = cls; }
  xiuxianRankMode = 'combat'; xiuxianRankAnon = false;
  xiuxianRenderRank();
}
function xiuxianRankSetMode(m) { xiuxianRankMode = m; xiuxianRenderRank(); }
function xiuxianRankToggleAnon() { xiuxianRankAnon = !xiuxianRankAnon; xiuxianRenderRank(); }
function xiuxianRenderRank() {
  let cls = state.xiuxian._rankCls || '';
  let list = (state.students || []).filter(function (s) { return !cls || s.classId === cls; }).map(function (s) {
    let p = state.xiuxian.students[s.id]; if (!p) return null;
    return { id: s.id, name: s.name, p: p };
  }).filter(Boolean);
  list.sort(function (a, b) {
    return xiuxianRankMode === 'combat' ? (xiuxianCombat(b.p) - xiuxianCombat(a.p)) : (b.p.stone - a.p.stone);
  });
  let rows = '<div class="x-rank-row head"><div class="x-rank-medal">#</div><div class="x-rank-avatar">头像</div><div class="x-rank-name">修士</div><div class="x-rank-val">境界</div><div class="x-rank-val">' + (xiuxianRankMode === 'combat' ? '战力' : '灵石') + '</div></div>';
  list.forEach(function (o, i) {
    let rankIdx = i + 1;
    let medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : rankIdx;
    let nm = xiuxianRankAnon ? ('匿名' + rankIdx) : escapeHtml(o.name || '同学');
    let val = xiuxianRankMode === 'combat' ? xiuxianCombat(o.p) : o.p.stone;
    let ch = xiuxianGetChar(o.p.characterId);
    let frameCls = rankIdx <= 10 ? ' x-rank-frame-' + rankIdx : '';
    let avatarHtml = '<div class="x-rank-avatar"><div class="x-rank-frame' + frameCls + '">' + xiuxianAvatarSVG(ch, o.p) + '</div></div>';
    rows += '<div class="x-rank-row"><div class="x-rank-medal">' + medal + '</div>' + avatarHtml + '<div class="x-rank-name">' + nm + '</div><div class="x-rank-val">' + xiuxianRealmObj(o.p.realm).name + '</div><div class="x-rank-val">' + val + '</div></div>';
  });
  const limitedNote = '<div class="x-tip">限定角色需榜单名次门槛 + 极品灵石抽取（如迪迦奥特曼限前10名）。匿名模式仅隐藏姓名，名次与数值不变。</div>';
  let html = '<div class="x-modal-head"><span class="x-modal-title">🏆 修仙排行榜' + (cls ? ' · ' + escapeHtml(cls) : ' · 全年级') + '</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body"><div class="x-rank-tabs">' +
    '<span class="x-mall-cat ' + (xiuxianRankMode === 'combat' ? 'on' : '') + '" data-click="xiuxianRankSetMode" data-click-args="' + escapeAttr(JSON.stringify(['combat'])) + '">战力榜</span>' +
    '<span class="x-mall-cat ' + (xiuxianRankMode === 'stone' ? 'on' : '') + '" data-click="xiuxianRankSetMode" data-click-args="' + escapeAttr(JSON.stringify(['stone'])) + '">灵石榜</span>' +
    '<span class="x-mall-cat ' + (xiuxianRankAnon ? 'on' : '') + '" data-click="xiuxianRankToggleAnon">' + (xiuxianRankAnon ? '匿名：开' : '匿名：关') + '</span></div>' +
    rows + limitedNote + '</div>';
  xiuxianModal(html);
}

// —— 小队（Stage 6） ——
function xiuxianOpenTeam(cls) {
  let n = XIUXIAN_RULES.SQUAD_RULES.squadsPerClass;
  let grids = '';
  for (let sq = 1; sq <= n; sq++) {
    const members = (state.students || []).filter(function (s) { return s.classId === cls && state.xiuxian.students[s.id] && state.xiuxian.students[s.id].squad === String(sq); });
    const mhtml = members.map(function (s) {
      let p = state.xiuxian.students[s.id];
      const isL = p && p.isLeader;
      return '<div class="x-squad-member ' + (isL ? 'leader' : '') + '">' +
        '<span>' + escapeHtml(s.name || '同学') + (isL ? ' ⭐' : '') + '</span>' +
        '<span style="margin-left:auto;display:flex;gap:4px">' +
        '<button class="btn btn-xs" data-click="xiuxianAppointLeader" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(cls) + '','' + escapeHtml(s.id) + ''])) + '">任队长</button>' +
        (isL ? '<button class="btn btn-xs" data-click="xiuxianRemoveLeader" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(cls) + '','' + escapeHtml(s.id) + ''])) + '">免</button>' : '') +
        '</span></div>';
    }).join('') || '<div style="color:#aaa;font-size:12px;padding:6px">暂无成员</div>';
    grids += '<div class="x-squad"><div class="x-squad-title">第 ' + sq + ' 小队</div>' + mhtml + '</div>';
  }
  const html = '<div class="x-modal-head"><span class="x-modal-title">👥 ' + escapeHtml(cls) + ' 小队管理（' + n + ' 队）</span><button class="btn btn-sm" data-click="xiuxianCloseModal">✕</button></div>' +
    '<div class="x-modal-body"><div class="x-tip">每班 ' + n + ' 队，队长每周一自动获得 ' + XIUXIAN_RULES.SQUAD_RULES.leaderWeeklyStone + ' 灵石俸禄。任命由教师手动操作。</div><div class="x-squad-grid">' + grids + '</div></div>';
  xiuxianModal(html);
}
function xiuxianAppointLeader(cls, sid) {
  ensureXiuxian();
  // 同班其它队长卸任
  (state.students || []).forEach(function (s) {
    if (s.classId === cls && state.xiuxian.students[s.id]) state.xiuxian.students[s.id].isLeader = false;
  });
  if (state.xiuxian.students[sid]) state.xiuxian.students[sid].isLeader = true;
  saveState({pushUndo:true}); xiuxianOpenTeam(cls);
  showToast('已任命队长', 'success');
}
function xiuxianRemoveLeader(cls, sid) {
  ensureXiuxian();
  if (state.xiuxian.students[sid]) state.xiuxian.students[sid].isLeader = false;
  saveState({pushUndo:true}); xiuxianOpenTeam(cls);
  showToast('已罢免队长', 'info');
}

// —— 通用弹窗 ——
function xiuxianModal(html) {
  xiuxianCloseModal();
  const ov = document.createElement('div');
  ov.className = 'x-modal-overlay'; ov.id = 'x-modal-overlay';
  ov.innerHTML = '<div class="x-modal">' + html + '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function (e) { if (e.target === ov) xiuxianCloseModal(); });
}
function xiuxianCloseModal() { let o = document.getElementById('x-modal-overlay'); if (o) o.remove(); }

// —— 渲染 ——
function renderXiuxian(area) {
  ensureXiuxian(); xiuxianAutoRoutine();
  let v = state.xiuxian.view || 'archive';
  console.log('[renderXiuxian] view=', v, 'activeStudent=', state.xiuxian.activeStudent, 'activeClass=', state.xiuxian.activeClass);
  if (v === 'student-home') return renderXiuxianStudentHome(area, state.xiuxian.activeStudent);
  if (v === 'class-home') return renderXiuxianClassHome(area, state.xiuxian.activeClass);
  if (v === 'tasks') return renderXiuxianTasks(area);
  if (v === 'pool') return renderXiuxianPool(area);
  if (v === 'rank') return renderXiuxianRankPage(area);
  return renderXiuxianArchive(area);
}
function xiuxianSetTab(tab) {
  console.log('[xiuxianSetTab] tab=', tab, '→ will navigateTo xiuxian-' + tab);
  navigateTo('xiuxian-' + tab);
}
function xiuxianTabBar(active) {
  const tabs = [{id:'archive',icon:'📖',label:'01修仙档案总库'},{id:'tasks',icon:'📜',label:'02修仙任务系统'},{id:'rank',icon:'🏆',label:'03修仙排行榜单'},{id:'pool',icon:'🎴',label:'04修仙角色体质'}];
  return '<div class="x-tabbar">' + tabs.map(function(t){
    return '<div class="x-tab'+(active===t.id?' active':'')+'" data-click="xiuxianSetTab" data-click-args="' + escapeAttr(JSON.stringify([''+t.id+''])) + '">'+t.icon+' '+t.label+'</div>';
  }).join('') + '</div>';
}
function xiuxianArchiveFilter(type, val) {
  if (type==='class') state.xiuxian._filterClass = val;
  else if (type==='linggen') state.xiuxian._filterLinggen = val;
  else if (type==='search') state.xiuxian._searchKey = val;
  saveState({pushUndo:true}); renderPage();
}
function renderXiuxianArchive(area) {
  const all = state.students || [];
  let cset = {}; all.forEach(function(s){ if(s.classId) cset[s.classId]=1; });
  let classes = Object.keys(cset).sort();
  let fc = state.xiuxian._filterClass || '', fl = state.xiuxian._filterLinggen || '', sk = state.xiuxian._searchKey || '';
  const filtered = all.filter(function(s){
    if (fc && s.classId !== fc) return false;
    if (fl) { let p = xiuxianProfile(s.id); if (p.linggen !== fl) return false; }
    if (sk) { const n = (s.name||'').toLowerCase(), no = (s.studentNo||'').toLowerCase(); if (n.indexOf(sk.toLowerCase())<0 && no.indexOf(sk.toLowerCase())<0) return false; }
    return true;
  });
  let classOpts = '<option value="">全部班级</option>' + classes.map(function(c){return '<option value="'+escapeHtml(c)+'"'+(fc===c?' selected':'')+'>'+escapeHtml(c)+'</option>';}).join('');
  let lgOpts = '<option value="">全部灵根</option>' + XIUXIAN_RULES.LINGGEN_LEVELS.map(function(l){return '<option value="'+l.name+'"'+(fl===l.name?' selected':'')+'>'+l.displayLabel+'</option>';}).join('');
  let cards = filtered.map(function(s){
    let p = xiuxianProfile(s.id); let ch = xiuxianGetChar(p.characterId); let lg = xiuxianLinggenObj(p.linggen); let realm = xiuxianRealmObj(p.realm);
    let cp = xiuxianCombat(p);
    return '<div class="x-card x-stu-card '+xiuxianLinggenFrameClass(p.linggen)+'" data-click="xiuxianSelectStudent" data-click-args="' + escapeAttr(JSON.stringify([''+escapeHtml(s.id)+''])) + '">' +
      '<div class="x-cell-avatar x-act-'+ch.action+'" style="filter:drop-shadow(0 0 6px '+lg.glowColor+')">'+xiuxianAvatarSVG(ch,p)+'</div>' +
      '<div class="x-stu-name">'+escapeHtml(s.name||'同学')+'</div>' +
      '<div class="x-stu-class">'+escapeHtml(s.classId||'')+'</div>' +
      '<div class="x-tag" style="background:'+lg.color+'">'+lg.displayLabel+'</div>' +
      '<div class="x-stu-realm">'+realm.name+' · '+xiuxianEvoStage(p)+(p.isLeader?' ⭐':'')+'</div>' +
      '<div class="x-stu-stats"><span>灵气 '+p.spirit+'</span><span>战力 '+cp+'</span></div></div>';
  }).join('');
  area.innerHTML = '<div class="x-wrap">' +
    '<div class="x-mist top"></div>' +
    '<div class="x-banner">🧬 04生物仙途秘境 <span class="x-banner-sub">修仙档案总库 · 修炼你的灵宠</span></div>' +
    xiuxianTabBar('archive') +
    '<div class="x-filter-bar">' +
      '<select class="x-filter-sel" data-ev="change" data-ev-key="ev57">'+classOpts+'</select>' +
      '<select class="x-filter-sel" data-ev="change" data-ev-key="ev58">'+lgOpts+'</select>' +
      '<input class="x-filter-input" type="text" placeholder="搜索姓名/学号..." value="'+escapeHtml(sk)+'" data-ev="input" data-ev-key="ev59"/>' +
      '<span class="x-filter-count">共 '+filtered.length+' 名修仙学子</span>' +
    '</div>' +
    '<div class="x-stu-grid">'+(cards||'<div class="x-tip">无匹配学生</div>')+'</div>' +
    '<div class="x-tip">灵根按最新成绩自动划分，无需手动刷新。</div>' +
    '<div class="x-mist bot"></div>' +
    '</div>';
}
function renderXiuxianClassHome(area, cls) {
  if (!cls) return xiuxianBackToSelect();
  const mates = (state.students || []).filter(function (s) { return s.classId === cls; });
  let cards = mates.map(function (s) {
    let p = xiuxianProfile(s.id); let ch = xiuxianGetChar(p.characterId); let lg = xiuxianLinggenObj(p.linggen);
    let cp = xiuxianCombat(p);
    return '<div class="x-card x-stu-card '+xiuxianLinggenFrameClass(p.linggen)+'" data-click="xiuxianSelectStudent" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(s.id) + ''])) + '">' +
      '<div class="x-cell-avatar x-act-' + ch.action + '" style="filter:drop-shadow(0 0 6px ' + lg.glowColor + ')">' + xiuxianAvatarSVG(ch, p) + '</div>' +
      '<div class="x-stu-name">' + escapeHtml(s.name || '同学') + '</div>' +
      '<div class="x-tag" style="background:' + lg.color + '">' + lg.displayLabel + '</div>' +
      '<div class="x-stu-realm">' + xiuxianRealmObj(p.realm).name + ' · ' + xiuxianEvoStage(p) + (p.isLeader ? ' ⭐' : '') + '</div>' +
      '<div class="x-stu-stats"><span>灵气 ' + p.spirit + '</span><span>战力 ' + cp + '</span></div></div>';
  }).join('');
  const tSpirit = mates.reduce(function(a,s){let p=xiuxianProfile(s.id);return a+(p.spirit||0);},0);
  const tStone = mates.reduce(function(a,s){let p=xiuxianProfile(s.id);return a+(p.stone||0);},0);
  const tCombat = mates.reduce(function(a,s){let p=xiuxianProfile(s.id);return a+xiuxianCombat(p);},0);
  const tLeader = mates.filter(function(s){return xiuxianProfile(s.id).isLeader;}).length;
  const tRealm = mates.reduce(function(a,s){return a+(xiuxianProfile(s.id).realm||0);},0);
  area.innerHTML = '<div class="x-wrap">' +
    '<div class="x-mist top"></div>' +
    '<div class="x-bar"><button class="btn btn-sm" data-click="xiuxianBackToSelect">← 档案总库</button>' +
    '<span class="x-bar-title">' + escapeHtml(cls) + ' · ' + mates.length + '人</span>' +
    '<button class="btn btn-sm" data-click="xiuxianWeeklyRoutine" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(cls) + ''])) + '">👑 发周俸</button>' +
    '<button class="btn btn-sm" data-click="xiuxianOpenRank" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(cls) + ''])) + '">🏆 排行榜</button>' +
    '<button class="btn btn-sm" data-click="xiuxianOpenTeam" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(cls) + ''])) + '">👥 小队</button></div>' +
    '<div class="x-res-bar">' +
      '<div class="x-res-cell"><span>修仙学子</span><b>' + mates.length + '</b></div>' +
      '<div class="x-res-cell"><span>总灵气</span><b>' + tSpirit + '</b></div>' +
      '<div class="x-res-cell"><span>总灵石</span><b>💰 ' + tStone + '</b></div>' +
      '<div class="x-res-cell"><span>总战力</span><b>⚔ ' + tCombat + '</b></div>' +
      '<div class="x-res-cell"><span>境界总和</span><b>' + tRealm + '</b></div>' +
      '<div class="x-res-cell"><span>小队队长</span><b>' + tLeader + '</b></div>' +
    '</div>' +
    '<div class="x-stu-grid">' + cards + '</div>' +
    '<div class="x-mist bot"></div>' +
    '</div>';
}
function renderXiuxianStudentHome(area, id) {
  let s = (state.students || []).find(function (x) { return x.id === id; });
  if (!s) return xiuxianBackToSelect();
  let p = xiuxianProfile(id);
  let ch = xiuxianGetChar(p.characterId);
  let lg = xiuxianLinggenObj(p.linggen);
  let realm = xiuxianRealmObj(p.realm);
  const cap = Math.max(realm.spiritCap, 10);
  const pct = cap > 0 ? Math.min(100, Math.round(p.spirit / cap * 100)) : 100;
  const stage = xiuxianEvoStage(p);
  const switchLabel = p.switchUsed ? ('更换角色(灵石' + XIUXIAN_RULES.SWITCH_COST_STONE + ')') : '更换角色(免费)';
  const wName = p.equipWeapon ? (xiuxianWeaponObj(p.equipWeapon) || {}).name : '无';
  const oName = p.equipOutfit ? (xiuxianOutfitObj(p.equipOutfit) || {}).name : '无';
  const cp = xiuxianCombat(p);
  const atMaxStage = (p.stage || 0) >= 2 && p.spirit >= cap;
  const btReady = atMaxStage && p.realm < 6;
  let stageDots = '';
  for (let si = 0; si < 3; si++) { stageDots += '<span class="x-stage-dot' + (si <= (p.stage || 0) ? ' on' : '') + '"></span>'; }
  const autoCultOn = p.autoCultivate !== false;
  const autoConvertOn = p.autoStoneConvert !== false;
  const rCombatC = xiuxianMyRank(id, 'class', 'combat');
  const rCombatG = xiuxianMyRank(id, 'grade', 'combat');
  const rRealmC = xiuxianMyRank(id, 'class', 'realm');
  const rRealmG = xiuxianMyRank(id, 'grade', 'realm');
  const rPremiumC = xiuxianMyRank(id, 'class', 'premium');
  const rPremiumG = xiuxianMyRank(id, 'grade', 'premium');
  const rankMeHtml = '<div class="x-rank-me">' +
    '<div class="x-rank-me-title">🏆 我的排名</div>' +
    '<div class="x-rank-me-grid">' +
      '<div><span>战力榜</span><b>班 ' + (rCombatC.rank||'-') + '/' + rCombatC.total + '</b><b>年 ' + (rCombatG.rank||'-') + '/' + rCombatG.total + '</b></div>' +
      '<div><span>境界榜</span><b>班 ' + (rRealmC.rank||'-') + '/' + rRealmC.total + '</b><b>年 ' + (rRealmG.rank||'-') + '/' + rRealmG.total + '</b></div>' +
      '<div><span>极品灵石榜</span><b>班 ' + (rPremiumC.rank||'-') + '/' + rPremiumC.total + '</b><b>年 ' + (rPremiumG.rank||'-') + '/' + rPremiumG.total + '</b></div>' +
    '</div></div>';
  area.innerHTML = '<div class="x-wrap">' +
    '<div class="x-mist top"></div>' +
    '<div class="x-bar"><button class="btn btn-sm" data-click="xiuxianBackToSelect">← 档案总库</button>' +
    '<span class="x-bar-title">' + escapeHtml(s.name || '同学') + ' 的修炼主页</span></div>' +
    '<div class="x-hero ' + xiuxianLinggenFrameClass(p.linggen) + '" style="border-color:' + lg.color + '">' +
    '<div class="x-seal">仙</div>' +
    '<div class="x-avatar x-act-' + ch.action + '" style="filter:drop-shadow(0 0 14px ' + lg.glowColor + ')">' + xiuxianAvatarSVG(ch, p) + '</div>' +
    '<div class="x-hero-info"><div class="x-hero-name">' + ch.name + ' <span class="x-tag" style="background:' + lg.color + '">' + lg.displayLabel + '</span></div>' +
    '<div class="x-hero-realm">' + realm.name + ' · ' + stage + ' ' + stageDots + (p.realm >= 5 ? ' 👑' : '') + '</div>' +
    '<div class="x-hero-kind">' + ch.kind + ' · 动作:' + ch.action + '</div>' +
    '<div class="x-hero-combat" style="cursor:pointer" data-click="xiuxianShowCombat" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">⚔ 战力 ' + cp + '</div></div></div>' +
    '<div class="x-stats">' +
    '<div class="x-stat"><span>灵气</span><b>' + p.spirit + ' / ' + cap + '</b></div>' +
    '<div class="x-stat"><span>灵石</span><b>💰 ' + p.stone + '</b></div>' +
    '<div class="x-stat"><span>极品灵石</span><b>💎 ' + p.premium + '</b></div>' +
    '<div class="x-stat"><span>战力</span><b style="cursor:pointer" data-click="xiuxianShowCombat" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">⚔ ' + cp + '</b></div>' +
    '<div class="x-stat"><span>兵器</span><b>' + escapeHtml(wName) + '</b></div>' +
    '<div class="x-stat"><span>服装</span><b>' + escapeHtml(oName) + '</b></div></div>' +
    '<div class="x-progress"><div class="x-progress-fill" style="width:' + pct + '%;background:linear-gradient(90deg,' + lg.color + ',#D4AF37)"></div></div>' +
    (btReady ? '<div class="x-bt-ready">⚠ 灵气已满，可突破大境界！</div>' : '') +
    '<div class="x-auto-cult" style="cursor:pointer" data-click="xiuxianToggleAutoCultivate" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">' +
    (autoCultOn ? '🧘 自动修炼中（点击关闭）' : '🪙 自动修炼已关闭，灵气自动转灵石（点击开启）') + '</div>' +
    '<div class="x-auto-cult" style="cursor:pointer" data-click="xiuxianToggleAutoStoneConvert" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">' +
    (autoConvertOn ? '🔄 每日灵石自动兑灵气中（点击关闭）' : '⏸ 每日灵石自动兑灵气已关闭（点击开启）') + '</div>' +
    rankMeHtml +
    '<div class="x-actions">' +
    '<button class="btn btn-sm" data-click="xiuxianCultivateInfo" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">📊 修炼详情</button>' +
    '<button class="btn btn-sm" data-click="xiuxianExchange" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">💱 灵石兑灵气</button>' +
    '<button class="btn btn-sm" data-click="xiuxianExchangePremium" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">💎 极品兑换</button>' +
    '<button class="btn btn-sm" data-click="xiuxianSwitchChar" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">🔁 ' + switchLabel + '</button>' +
    '<button class="btn btn-sm" data-click="xiuxianOpenWeapon" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">🎒 装备库</button>' +
    '<button class="btn ' + (btReady ? 'btn-primary' : '') + '" ' + (btReady ? 'data-click="xiuxianOpenBreakthrough" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '"' : 'disabled') + '>⚡ 突破大境界</button>' +
    '<button class="btn btn-sm" data-click="xiuxianOpenMall" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(id) + ''])) + '">🛒 商城</button>' +
    '<button class="btn btn-sm" data-click="xiuxianOpenRank" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(s.classId) + ''])) + '">🏆 班级榜</button></div>' +
    '<div class="x-tip">📌 初期/中期/后期自动突破（角色渐变）；大境界需手动突破（渡劫明显变化）。灵根按最新成绩自动划分。溢出灵气自动转灵石(3:1)。</div>' +
    '<div class="x-mist bot"></div>' +
    '</div>';
}


// ===== ② 修仙任务系统 =====
const HW_STONE_RULES = { excellent: 5, normal: 3, resubmitted: 2, perfunctory: 1, incomplete: 0, pending: 0 };
const HW_STATUS_LABELS = { excellent: '优秀', normal: '正常', resubmitted: '补交', perfunctory: '敷衍', incomplete: '未交', pending: '待标记' };

function xiuxianTaskFilterClass(cls) { state.xiuxian._taskClass = cls; saveState(); renderPage(); }

function xiuxianSyncHwStones() {
  ensureXiuxian();
  let fc = state.xiuxian._taskClass || '';
  let hw = (state.homeworkRecords || []).filter(function(r){
    if (fc && r.classId !== fc) return false;
    if (r.status === 'pending') return false;
    return true;
  });
  let claimed = state.xiuxian.hwClaimed || {};
  let total = 0, cnt = 0, premiumGot = 0;
  const cfg = XIUXIAN_RULES.PREMIUM_STONE;
  const now = Date.now();
  hw.forEach(function(r){
    let key = r.studentId + '_' + r.taskId;
    if (claimed[key]) return;
    const stones = HW_STONE_RULES[r.status] || 0;
    if (stones > 0 && state.xiuxian.students[r.studentId]) {
      state.xiuxian.students[r.studentId].stone += stones;
      total += stones; cnt++;
      let p = state.xiuxian.students[r.studentId];
      const inWindow = (now - (p.lastPremiumTs || 0)) < cfg.pityWindowDays * 86400000;
      const pity = inWindow ? (p.pityCount || 0) : 0;
      const guaranteed = pity >= cfg.pityThreshold;
      const rate = guaranteed ? 1 : Math.min(1, cfg.dropBaseRate + pity * cfg.dropRateIncrement);
      if (Math.random() < rate || guaranteed) {
        p.premium += 1; p.pityCount = 0; p.lastPremiumTs = now; premiumGot++;
      } else {
        p.pityCount = pity + 1; p.lastPremiumTs = now;
      }
    }
    claimed[key] = true;
  });
  state.xiuxian.hwClaimed = claimed;
  state.xiuxian.meta.lastHwSyncTs = Date.now();
  saveState({pushUndo:true}); renderPage();
  if (cnt > 0) {
    let msg = '作业灵石同步：' + cnt + ' 人共 +' + total + ' 灵石';
    if (premiumGot > 0) msg += '，自动掉落 ' + premiumGot + ' 极品灵石 💎';
    showToast(msg, 'success');
  } else showToast('没有未领取的作业灵石', 'info');
}

let _xMultiSelect = {};
function xiuxianToggleMulti(sid) {
  if (_xMultiSelect[sid]) delete _xMultiSelect[sid];
  else _xMultiSelect[sid] = true;
  const cnt = Object.keys(_xMultiSelect).length;
  const bar = document.getElementById('xMultiBar');
  if (bar) bar.textContent = '已选 ' + cnt + ' 人';
}
function xiuxianSelectAllMulti() {
  let fc = state.xiuxian._taskClass || '';
  (state.students || []).forEach(function(s){ if (!fc || s.classId === fc) _xMultiSelect[s.id] = true; });
  renderPage();
}
function xiuxianClearMulti() { _xMultiSelect = {}; renderPage(); }

function xiuxianMultiAward(type) {
  ensureXiuxian();
  let typeEl = document.getElementById('xMultiType');
  let stoneEl = document.getElementById('xMultiStone');
  let descEl = document.getElementById('xMultiDesc');
  let stoneAmt = parseInt(stoneEl ? stoneEl.value : '3') || 0;
  if (stoneAmt <= 0) { showToast('灵石数量必须大于0', 'warn'); return; }
  let desc = descEl ? (descEl.value || '') : '';
  let taskType = type === 'other' ? '其它' : (typeEl ? typeEl.value : '背诵');
  const ids = Object.keys(_xMultiSelect);
  if (ids.length === 0) { showToast('请先勾选学生', 'warn'); return; }
  ids.forEach(function(sid){
    if (state.xiuxian.students[sid]) state.xiuxian.students[sid].stone += stoneAmt;
  });
  let fc = state.xiuxian._taskClass || '';
  let rec = { id: 'ct' + Date.now(), type: taskType, desc: desc || taskType, stone: stoneAmt, classId: fc, date: xiuxianTodayStr(), studentIds: ids, studentCount: ids.length };
  if (!state.xiuxian.customTasks) state.xiuxian.customTasks = [];
  state.xiuxian.customTasks.unshift(rec);
  if (state.xiuxian.customTasks.length > 100) state.xiuxian.customTasks = state.xiuxian.customTasks.slice(0, 100);
  _xMultiSelect = {};
  saveState({pushUndo:true}); renderPage();
  showToast(taskType + '灵石发放完成：' + ids.length + ' 人各 +' + stoneAmt + ' 灵石', 'success');
}

function xiuxianAwardOne() {
  ensureXiuxian();
  const sidEl = document.getElementById('xIndStudent');
  const stoneEl = document.getElementById('xIndStone');
  const descEl = document.getElementById('xIndDesc');
  const typeEl = document.getElementById('xIndType');
  const sid = sidEl ? sidEl.value : '';
  const stoneAmt = parseInt(stoneEl ? stoneEl.value : '3') || 0;
  if (!sid) { showToast('请选择学生', 'warn'); return; }
  if (stoneAmt <= 0) { showToast('灵石数量必须大于0', 'warn'); return; }
  const desc = descEl ? (descEl.value || '') : '';
  const taskType = typeEl ? typeEl.value : '背诵';
  let s = (state.students || []).find(function(x){ return x.id === sid; });
  if (!s) { showToast('未找到学生', 'warn'); return; }
  if (state.xiuxian.students[sid]) { state.xiuxian.students[sid].stone += stoneAmt; }
  const rec = { id: 'ct' + Date.now(), type: taskType, desc: desc || taskType, stone: stoneAmt, classId: s.classId || '', date: xiuxianTodayStr(), studentIds: [sid], studentCount: 1 };
  if (!state.xiuxian.customTasks) state.xiuxian.customTasks = [];
  state.xiuxian.customTasks.unshift(rec);
  if (state.xiuxian.customTasks.length > 100) state.xiuxian.customTasks = state.xiuxian.customTasks.slice(0, 100);
  saveState({pushUndo:true}); renderPage();
  showToast(escapeHtml(s.name) + ' 获得 ' + stoneAmt + ' 灵石（' + taskType + '）', 'success');
}

function renderXiuxianTasks(area) {
  ensureXiuxian();
  let cset = {}; (state.students || []).forEach(function(s){ if(s.classId) cset[s.classId]=1; });
  let classes = Object.keys(cset).sort();
  const fc = state.xiuxian._taskClass || '';
  let classOpts = '<option value="">全部班级</option>' + classes.map(function(c){return '<option value="'+escapeHtml(c)+'"'+(fc===c?' selected':'')+'>'+escapeHtml(c)+'</option>';}).join('');

  const hw = (state.homeworkRecords || []).filter(function(r){
    if (fc && r.classId !== fc) return false;
    return r.status !== 'pending';
  });
  const stats = { excellent:0, normal:0, resubmitted:0, perfunctory:0, incomplete:0 };
  let unclaimed = 0, totalStones = 0;
  const claimed = state.xiuxian.hwClaimed || {};
  hw.forEach(function(r){
    if (stats[r.status] !== undefined) stats[r.status]++;
    let key = r.studentId + '_' + r.taskId;
    if (!claimed[key]) { unclaimed++; totalStones += HW_STONE_RULES[r.status] || 0; }
  });

  const customs = state.xiuxian.customTasks || [];
  // 按学生汇总：每个学生不同任务类型所获灵石总数
  const byStudent = {};
  customs.forEach(function(t){
    (t.studentIds || []).forEach(function(sid){
      if (!byStudent[sid]) byStudent[sid] = { name:'', classId:'', types:{} };
      if (!byStudent[sid].types[t.type]) byStudent[sid].types[t.type] = 0;
      byStudent[sid].types[t.type] += t.stone;
    });
  });
  // 补充作业同步的灵石（从 hwClaimed 反推不可行，改为从 customTasks 中 type='作业同步' 汇总）
  const fc2 = fc;
  const students = (state.students || []).filter(function(s){ return !fc2 || s.classId === fc2; });
  const studentGrid = students.map(function(s){
    let p = xiuxianProfile(s.id); let lg = xiuxianLinggenObj(p.linggen); const realm = xiuxianRealmObj(p.realm);
    const checked = _xMultiSelect[s.id] ? ' checked' : '';
    let totalStones = 0;
    const types = byStudent[s.id] ? byStudent[s.id].types : {};
    for (const k in types) totalStones += types[k];
    return '<label class="x-multi-card' + (checked?' selected':'') + '">' +
      '<input type="checkbox" class="x-multi-chk" data-ev="change" data-ev-key="ev60" data-ev-args=' + escapeAttr(JSON.stringify([escapeHtml(s.id)])) + '"' + checked + '/>' +
      '<div class="x-multi-avatar">' + xiuxianAvatarSVG(xiuxianGetChar(p.characterId), p) + '</div>' +
      '<div class="x-multi-name">' + escapeHtml(s.name||'同学') + '</div>' +
      '<div class="x-multi-info">' + escapeHtml(s.classId||'') + ' · ' + lg.displayLabel + '</div>' +
      '<div class="x-multi-info">' + realm.name + ' · 战力' + xiuxianCombat(p) + '</div>' +
      '<div class="x-multi-stone">💰 ' + (p.stone||0) + ' · 累计+' + totalStones + '</div>' +
      '</label>';
  }).join('');

  // 汇总记录：按学生表格
  let summaryRows = '';
  const allTypes = {};
  customs.forEach(function(t){ allTypes[t.type] = 1; });
  const typeList = Object.keys(allTypes).sort();
  // 合并作业同步类型
  Object.keys(byStudent).forEach(function(sid){
    const s = (state.students||[]).find(function(x){ return x.id === sid; });
    if (s) { byStudent[sid].name = s.name||'同学'; byStudent[sid].classId = s.classId||''; }
  });
  const summaryList = Object.keys(byStudent).map(function(sid){ return { sid:sid, ...byStudent[sid] }; });
  summaryList.sort(function(a,b){
    let ta = 0, tb = 0;
    for (const k in a.types) ta += a.types[k];
    for (const k in b.types) tb += b.types[k];
    return tb - ta;
  });
  if (summaryList.length > 0) {
    const header = '<tr class="x-sum-head"><td>学生</td><td>班级</td>' + typeList.map(function(t){ return '<td>' + escapeHtml(t) + '</td>'; }).join('') + '<td>合计</td></tr>';
    let rows = summaryList.map(function(o){
      let total = 0;
      const cells = typeList.map(function(t){ const v = o.types[t]||0; total += v; return '<td>' + (v||'-') + '</td>'; }).join('');
      return '<tr class="x-sum-row"><td>' + escapeHtml(o.name||o.sid) + '</td><td>' + escapeHtml(o.classId||'') + '</td>' + cells + '<td class="x-sum-total">' + total + '</td></tr>';
    }).join('');
    summaryRows = '<table class="x-sum-table">' + header + rows + '</table>';
  }
  area.innerHTML = '<div class="x-wrap">' +
    '<div class="x-mist top"></div>' +
    '<div class="x-banner">🧬 04生物仙途秘境 <span class="x-banner-sub">修仙任务系统 · 作业/背诵/默写 → 灵石</span></div>' +
    xiuxianTabBar('tasks') +
    '<div class="x-filter-bar">' +
      '<select class="x-filter-sel" data-ev="change" data-ev-key="ev61">'+classOpts+'</select>' +
    '</div>' +

    '<div class="x-section">' +
    '<div class="x-section-title">📚 作业灵石同步（12小时未操作自动领取）</div>' +
    '<div class="x-hw-stats">' +
      '<div class="x-hw-stat excellent">优秀 ✨<b>'+stats.excellent+'</b><small>5灵石/人</small></div>' +
      '<div class="x-hw-stat normal">正常 ✓<b>'+stats.normal+'</b><small>3灵石/人</small></div>' +
      '<div class="x-hw-stat resubmitted">补交 📝<b>'+stats.resubmitted+'</b><small>2灵石/人</small></div>' +
      '<div class="x-hw-stat perfunctory">敷衍 ⚠<b>'+stats.perfunctory+'</b><small>1灵石/人</small></div>' +
      '<div class="x-hw-stat incomplete">未交 ✗<b>'+stats.incomplete+'</b><small>0灵石</small></div>' +
    '</div>' +
    '<div class="x-hw-action">' +
      '<span class="x-hw-unclaimed">未领取：'+unclaimed+' 条 · 可领取 '+totalStones+' 灵石（同步时自动判定极品灵石掉落 · 12小时无操作自动同步）</span>' +
      '<button class="btn btn-primary" data-click="xiuxianSyncHwStones">💰 手动同步</button>' +
    '</div></div>' +

    '<div class="x-section">' +
    '<div class="x-section-title">📖 多选发放灵石（勾选学生→选择类型→发放）</div>' +
    '<div class="x-multi-toolbar">' +
      '<span id="xMultiBar" class="x-multi-count">已选 0 人</span>' +
      '<button class="btn btn-sm" data-click="xiuxianSelectAllMulti">全选</button>' +
      '<button class="btn btn-sm" data-click="xiuxianClearMulti">清空</button>' +
    '</div>' +
    '<div class="x-multi-grid">' + (studentGrid || '<div class="x-tip">无学生</div>') + '</div>' +
    '<div class="x-quick-award" style="margin-top:8px">' +
      '<select class="x-filter-sel" id="xMultiType"><option value="背诵">背诵</option><option value="默写">默写</option><option value="抄写">抄写</option></select>' +
      '<input type="number" class="x-stone-input" id="xMultiStone" value="3" min="1" max="20" placeholder="灵石"/>' +
      '<input type="text" class="x-desc-input" id="xMultiDesc" placeholder="说明（可选）"/>' +
      '<button class="btn btn-primary" data-click="xiuxianMultiAward">💰 发放选中</button>' +
    '</div>' +
    '<div class="x-tip">勾选学生后选择类型和数量即可批量发放。作业灵石12小时无操作自动同步。</div>' +
    '</div>' +

    '<div class="x-section">' +
    '<div class="x-section-title">✦ 其它任务（勾选学生后发放）</div>' +
    '<div class="x-quick-award">' +
      '<input type="text" class="x-desc-input" id="xOtherDesc" placeholder="任务说明..." style="flex:1"/>' +
      '<input type="number" class="x-stone-input" id="xOtherStone" value="5" min="1" max="100" placeholder="灵石"/>' +
      '<button class="btn btn-primary" data-click="xiuxianMultiAward" data-click-args="' + escapeAttr(JSON.stringify(['other'])) + '">💰 发放选中</button>' +
    '</div></div>' +

    '<div class="x-section">' +
    '<div class="x-section-title">📜 灵石发放记录（按角色汇总）</div>' +
    '<div class="x-task-list">'+(summaryRows||'<div class="x-tip">暂无发放记录</div>')+'</div>' +
    '</div>' +

    '<div class="x-mist bot"></div>' +
    '</div>';
}

// ===== ③ 角色池 =====
let _xPoolCat = 'all', _xPoolDrawStudent = '';
function xiuxianPoolSetCat(cat) { _xPoolCat = cat; renderPage(); }
function xiuxianPoolSetDrawStudent(sid) { _xPoolDrawStudent = sid; renderPage(); }
function renderXiuxianPool(area) {
  ensureXiuxian();
  const cats = [{id:'all',label:'全部'},{id:'animal',label:'动物池'},{id:'plant',label:'植物池'},{id:'character',label:'动漫角色'},{id:'rare',label:'稀有角色'}];
  const pool = XIUXIAN_POOL.filter(function(c){ return _xPoolCat==='all' || c.pool===_xPoolCat; });
  const cards = pool.map(function(c){
    let p = xiuxianNewProfile(c.id, 1);
    const lg = xiuxianLinggenObj(p.linggen);
    const isRare = c.rarity === 'limited';
    return '<div class="x-pool-card'+(isRare?' rare':'')+'" title="'+escapeHtml(c.kind||'')+'">' +
      '<div class="x-pool-avatar">'+xiuxianAvatarSVG(c,p)+'</div>' +
      '<div class="x-pool-name">'+escapeHtml(c.name)+'</div>' +
      '<div class="x-pool-kind">'+escapeHtml(c.kind||c.pool)+'</div>' +
      (isRare ? '<div class="x-pool-quota">限'+c.quota+'·前'+c.rank_req+'名·💎'+c.jipin_price+'</div>' : '') +
      '</div>';
  }).join('');
  const drawStudentOpts = '<option value="">选择学生</option>' + (state.students||[]).map(function(s){return '<option value="'+escapeHtml(s.id)+'"'+(_xPoolDrawStudent===s.id?' selected':'')+'>'+escapeHtml(s.name||'同学')+' · '+escapeHtml(s.classId||'')+'</option>';}).join('');
  let limitedBtns = '';
  if (_xPoolDrawStudent) {
    const dp = xiuxianProfile(_xPoolDrawStudent);
    if (dp) {
      const dch = xiuxianGetChar(dp.characterId);
      limitedBtns = '<div class="x-draw-info">当前角色：'+escapeHtml(dch.name)+' · 💎 '+dp.premium+' 极品灵石</div>';
      limitedBtns += XIUXIAN_POOL.filter(function(c){ return c.rarity === 'limited'; }).map(function(c){
        return '<button class="x-limited-btn" data-click="xiuxianDrawLimited" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(_xPoolDrawStudent) + '','' + c.id + ''])) + '" title="' + escapeHtml(c.source || '') + '">' + c.emoji + ' ' + escapeHtml(c.name) + '<br><small>前' + c.rank_req + '名·💎' + c.jipin_price + '·限' + c.quota + '</small></button>';
      }).join('');
    }
  }
  area.innerHTML = '<div class="x-wrap">' +
    '<div class="x-mist top"></div>' +
    '<div class="x-banner">🧬 04生物仙途秘境 <span class="x-banner-sub">角色池 · 240 种灵宠立绘</span></div>' +
    xiuxianTabBar('pool') +
    '<div class="x-section">' +
    '<div class="x-section-title">✦ 限定角色抽取</div>' +
    '<div class="x-quick-award">' +
      '<select class="x-filter-sel" data-ev="change" data-ev-key="ev62" style="min-width:140px">'+drawStudentOpts+'</select>' +
    '</div>' +
    (_xPoolDrawStudent ? '<div class="x-limited-row">' + limitedBtns + '</div>' : '<div class="x-tip">选择学生后可抽取限定角色（需榜单门槛+极品灵石）</div>') +
    '</div>' +
    '<div class="x-pool-cats">' + cats.map(function(ct){
      return '<div class="x-pool-cat'+(_xPoolCat===ct.id?' active':'')+'" data-click="xiuxianPoolSetCat" data-click-args="' + escapeAttr(JSON.stringify([''+ct.id+''])) + '">'+ct.label+'</div>';
    }).join('') + '</div>' +
    '<div class="x-pool-grid">'+cards+'</div>' +
    '<div class="x-tip">共 '+pool.length+' 种角色。普通池(动物60+植物60+动漫60)初始随机分配；稀有池60种需榜单门槛+极品灵石抽取。</div>' +
    '<div class="x-mist bot"></div>' +
    '</div>';
}

// ===== ⑤ 排行榜标签页 =====
let _xRankPageMode = 'combat', _xRankPageAnon = false, _xRankPageCls = '', _xRankPageLinggen = '', _xRankPageSelf = '', _xRankPageScope = 'grade';
function xiuxianRankPageSetMode(m) { _xRankPageMode = m; renderPage(); }
function xiuxianRankPageToggleAnon() { _xRankPageAnon = !_xRankPageAnon; renderPage(); }
function xiuxianRankPageSetClass(cls) { _xRankPageCls = cls; renderPage(); }
function xiuxianRankPageSetLinggen(lg) { _xRankPageLinggen = lg; renderPage(); }
function xiuxianRankPageSetSelf(sid) { _xRankPageSelf = sid; renderPage(); }
function xiuxianRankPageSetScope(scope) { _xRankPageScope = scope; if (scope === 'grade') _xRankPageCls = ''; renderPage(); }
function renderXiuxianRankPage(area) {
  ensureXiuxian();
  const cset = {}; (state.students || []).forEach(function(s){ if(s.classId) cset[s.classId]=1; });
  const classes = Object.keys(cset).sort();
  const scope = _xRankPageScope || 'grade';
  const cls = scope === 'class' ? (_xRankPageCls || classes[0] || '') : '';
  const lgf = _xRankPageLinggen || '';
  const selfId = _xRankPageSelf || '';
  const list = (state.students || []).filter(function(s){ return !cls || s.classId === cls; }).map(function(s){
    const p = state.xiuxian.students[s.id]; if (!p) return null;
    if (lgf && p.linggen !== lgf) return null;
    return { id:s.id, name:s.name, classId:s.classId, p:p };
  }).filter(Boolean);
  list.sort(function(a,b){
    if (_xRankPageMode === 'combat') return xiuxianCombat(b.p) - xiuxianCombat(a.p);
    if (_xRankPageMode === 'realm') return (b.p.realm||0) - (a.p.realm||0) || (b.p.spirit - a.p.spirit);
    return (b.p.premium||0) - (a.p.premium||0);
  });
  let selfRank = -1, selfName = '';
  list.forEach(function(o, i) { if (o.id === selfId) { selfRank = i + 1; selfName = o.name; } });
  const modeLabel = _xRankPageMode === 'combat' ? '战力' : _xRankPageMode === 'realm' ? '境界' : '极品灵石';
  const scopeLabel = scope === 'class' ? (cls + '班级榜') : '年级总榜';
  const valOf = function(p) {
    if (_xRankPageMode === 'combat') return xiuxianCombat(p);
    if (_xRankPageMode === 'realm') return xiuxianRealmObj(p.realm).name + ' · ' + (p.spirit||0) + '气';
    return p.premium || 0;
  };
  let rows = '<div class="x-rank-row head"><div class="x-rank-medal">#</div><div class="x-rank-avatar">头像</div><div class="x-rank-name">修士</div>' + (scope === 'grade' ? '<div class="x-rank-class">班级</div>' : '') + '<div class="x-rank-val">境界</div><div class="x-rank-val">'+modeLabel+'</div></div>';
  list.forEach(function(o, i) {
    const isSelf = o.id === selfId;
    const rankIdx = i + 1;
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : rankIdx;
    const nm = _xRankPageAnon ? ('匿名' + rankIdx) : escapeHtml(o.name || '同学');
    const val = valOf(o.p);
    const ch = xiuxianGetChar(o.p.characterId);
    const frameCls = rankIdx <= 10 ? ' x-rank-frame-' + rankIdx : '';
    const avatarHtml = '<div class="x-rank-avatar"><div class="x-rank-frame' + frameCls + '">' + xiuxianAvatarSVG(ch, o.p) + '</div></div>';
    rows += '<div class="x-rank-row' + (isSelf ? ' self' : '') + '" data-click="xiuxianSelectStudent" data-click-args="' + escapeAttr(JSON.stringify(['' + escapeHtml(o.id) + ''])) + '" style="cursor:pointer">' +
      '<div class="x-rank-medal">' + medal + '</div>' + avatarHtml + '<div class="x-rank-name">' + nm + (isSelf ? ' (你)' : '') + '</div>' + (scope === 'grade' ? '<div class="x-rank-class">' + escapeHtml(o.classId || '') + '</div>' : '') + '<div class="x-rank-val">' + xiuxianRealmObj(o.p.realm).name + '</div><div class="x-rank-val">' + val + '</div></div>';
  });
  const classOpts = classes.map(function(c){return '<option value="'+escapeHtml(c)+'"'+(cls===c?' selected':'')+'>'+escapeHtml(c)+'</option>';}).join('');
  const lgOpts = '<option value="">全部灵根</option>' + XIUXIAN_RULES.LINGGEN_LEVELS.map(function(l){return '<option value="'+l.name+'"'+(lgf===l.name?' selected':'')+'>'+l.displayLabel+'</option>';}).join('');
  const selfOpts = '<option value="">选择查看自己排名</option>' + (state.students||[]).filter(function(s){return !cls||s.classId===cls;}).map(function(s){return '<option value="'+escapeHtml(s.id)+'"'+(selfId===s.id?' selected':'')+'>'+escapeHtml(s.name||'同学')+'</option>';}).join('');
  const selfBanner = selfRank > 0 ? '<div class="x-self-rank">🏆 ' + escapeHtml(selfName) + ' 在' + scopeLabel + modeLabel + '榜排名第 ' + selfRank + ' 名（共' + list.length + '人）</div>' : '';
  area.innerHTML = '<div class="x-wrap">' +
    '<div class="x-mist top"></div>' +
    '<div class="x-banner">🧬 04生物仙途秘境 <span class="x-banner-sub">修仙排行榜 · ' + scopeLabel + '</span></div>' +
    xiuxianTabBar('rank') +
    selfBanner +
    '<div class="x-filter-bar">' +
      '<span class="x-mall-cat ' + (scope === 'grade' ? 'on' : '') + '" data-click="xiuxianRankPageSetScope" data-click-args="' + escapeAttr(JSON.stringify(['grade'])) + '" style="cursor:pointer">年级总榜</span>' +
      '<span class="x-mall-cat ' + (scope === 'class' ? 'on' : '') + '" data-click="xiuxianRankPageSetScope" data-click-args="' + escapeAttr(JSON.stringify(['class'])) + '" style="cursor:pointer">班级榜单</span>' +
      (scope === 'class' ? '<select class="x-filter-sel" data-ev="change" data-ev-key="ev63">' + classOpts + '</select>' : '') +
      '<select class="x-filter-sel" data-ev="change" data-ev-key="ev64">'+lgOpts+'</select>' +
      '<select class="x-filter-sel" data-ev="change" data-ev-key="ev65" style="min-width:140px">'+selfOpts+'</select>' +
      '<span class="x-mall-cat '+(_xRankPageMode==='combat'?'on':'')+'" data-click="xiuxianRankPageSetMode" data-click-args="' + escapeAttr(JSON.stringify(['combat'])) + '" style="cursor:pointer">战力榜</span>' +
      '<span class="x-mall-cat '+(_xRankPageMode==='realm'?'on':'')+'" data-click="xiuxianRankPageSetMode" data-click-args="' + escapeAttr(JSON.stringify(['realm'])) + '" style="cursor:pointer">境界榜</span>' +
      '<span class="x-mall-cat '+(_xRankPageMode==='premium'?'on':'')+'" data-click="xiuxianRankPageSetMode" data-click-args="' + escapeAttr(JSON.stringify(['premium'])) + '" style="cursor:pointer">极品灵石榜</span>' +
      '<span class="x-mall-cat '+(_xRankPageAnon?'on':'')+'" data-click="xiuxianRankPageToggleAnon" style="cursor:pointer">'+(_xRankPageAnon?'匿名：开':'匿名：关')+'</span>' +
    '</div>' +
    '<div class="x-rank-list">'+rows+'</div>' +
    '<div class="x-tip">切换年级总榜/班级榜单；三种榜单可按灵根筛选对比同级；选择学生可查看自己排名。点击修士可进入修炼主页。</div>' +
    '<div class="x-mist bot"></div>' +
    '</div>';
}

// ===== CSS 扩展（标签页 + 任务系统 + 角色池） =====
if (!document.getElementById('xiuxian-style2')) {
  const _xs2 = document.createElement('style');
  _xs2.id = 'xiuxian-style2';
  _xs2.textContent = '\
.x-tabbar{display:flex;gap:0;border-bottom:2px solid #C19A6B;margin-bottom:12px;background:rgba(245,240,230,.5);border-radius:8px 8px 0 0;overflow:hidden}\
.x-tab{flex:1;padding:10px 8px;text-align:center;cursor:pointer;font-size:13px;color:#5D4E37;border-right:1px solid rgba(193,154,107,.3);transition:all .2s;font-family:KaiTi,STKaiti,serif}\
.x-tab:last-child{border-right:none}\
.x-tab:hover{background:rgba(212,175,55,.15)}\
.x-tab.active{background:linear-gradient(180deg,rgba(212,175,55,.25),rgba(212,175,55,.08));color:#9E3D2D;font-weight:bold;border-bottom:2px solid #D4AF37;margin-bottom:-2px}\
.x-filter-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;background:rgba(245,240,230,.6);border-radius:6px;margin-bottom:12px;border:1px solid rgba(193,154,107,.3)}\
.x-filter-sel{padding:4px 8px;border:1px solid #C19A6B;border-radius:4px;background:#F5F0E6;color:#2C3E3F;font-size:13px;cursor:pointer}\
.x-filter-input{padding:4px 8px;border:1px solid #C19A6B;border-radius:4px;background:#F5F0E6;color:#2C3E3F;font-size:13px;flex:1;min-width:120px}\
.x-filter-count{color:#8D6E63;font-size:12px;margin-left:auto;white-space:nowrap}\
.x-stu-class{font-size:11px;color:#8D6E63;text-align:center;margin:-2px 0 2px}\
.x-section{background:rgba(245,240,230,.7);border:1px solid rgba(193,154,107,.35);border-radius:8px;padding:12px;margin-bottom:12px;box-shadow:0 1px 4px rgba(139,69,19,.06)}\
.x-section-title{font-size:15px;font-weight:bold;color:#9E3D2D;font-family:KaiTi,STKaiti,serif;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(193,154,107,.3)}\
.x-hw-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}\
.x-hw-stat{flex:1;min-width:80px;text-align:center;padding:8px 4px;border-radius:6px;background:rgba(255,255,255,.6);border:1px solid rgba(193,154,107,.2);font-size:12px;color:#5D4E37}\
.x-hw-stat b{display:block;font-size:20px;color:#2C3E3F;margin:2px 0}\
.x-hw-stat small{display:block;color:#8D6E63;font-size:10px}\
.x-hw-stat.excellent{border-color:rgba(255,193,7,.4)} .x-hw-stat.excellent b{color:#F57C00}\
.x-hw-stat.normal{border-color:rgba(66,165,245,.3)} .x-hw-stat.normal b{color:#1976D2}\
.x-hw-stat.resubmitted{border-color:rgba(171,71,188,.25)} .x-hw-stat.resubmitted b{color:#7B1FA2}\
.x-hw-stat.perfunctory{border-color:rgba(255,152,0,.3)} .x-hw-stat.perfunctory b{color:#E65100}\
.x-hw-stat.incomplete{border-color:rgba(229,57,53,.25)} .x-hw-stat.incomplete b{color:#C62828}\
.x-hw-action{display:flex;align-items:center;gap:12px;padding:8px 0 0;border-top:1px solid rgba(193,154,107,.2)}\
.x-hw-unclaimed{color:#5D4E37;font-size:13px;flex:1}\
.x-quick-award{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\
.x-stone-input{width:70px;padding:4px 8px;border:1px solid #C19A6B;border-radius:4px;background:#F5F0E6;font-size:13px;text-align:center}\
.x-desc-input{flex:1;min-width:150px;padding:4px 8px;border:1px solid #C19A6B;border-radius:4px;background:#F5F0E6;font-size:13px}\
.x-task-list{max-height:300px;overflow-y:auto}\
.x-task-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid rgba(193,154,107,.15);font-size:13px;color:#5D4E37}\
.x-task-item:hover{background:rgba(212,175,55,.08)}\
.x-task-type{display:inline-block;padding:2px 8px;border-radius:4px;background:#C3272B;color:#F5F0E6;font-size:11px;font-weight:bold;min-width:40px;text-align:center}\
.x-task-desc{flex:1;color:#2C3E3F}\
.x-task-stone{color:#D4AF37;font-weight:bold;white-space:nowrap}\
.x-task-meta{color:#8D6E63;font-size:11px;white-space:nowrap}\
.x-pool-cats{display:flex;gap:6px;margin-bottom:10px}\
.x-pool-cat{padding:6px 14px;border-radius:20px;cursor:pointer;font-size:13px;color:#5D4E37;background:rgba(245,240,230,.6);border:1px solid rgba(193,154,107,.3);transition:all .2s}\
.x-pool-cat:hover{background:rgba(212,175,55,.15)}\
.x-pool-cat.active{background:linear-gradient(135deg,#C3272B,#9E3D2D);color:#F5F0E6;border-color:#D4AF37;font-weight:bold}\
.x-pool-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px}\
.x-pool-card{text-align:center;padding:6px;border-radius:6px;background:rgba(255,255,255,.5);border:1px solid rgba(193,154,107,.2);cursor:default;transition:all .2s}\
.x-pool-card:hover{transform:translateY(-2px);box-shadow:0 2px 8px rgba(139,69,19,.12);border-color:#D4AF37}\
.x-pool-card.rare{border-color:rgba(212,175,55,.5);background:linear-gradient(135deg,rgba(212,175,55,.12),rgba(245,240,230,.6))}\
.x-pool-avatar{width:60px;height:60px;margin:0 auto}\
.x-pool-name{font-size:11px;color:#2C3E3F;font-weight:bold;margin-top:2px}\
.x-pool-kind{font-size:9px;color:#8D6E63}\
.x-pool-quota{font-size:9px;color:#C3272B;margin-top:2px;font-weight:bold}\
.x-rank-list{max-height:600px;overflow-y:auto}\
.x-rank-class{font-size:12px;color:#8D6E63;text-align:center;width:50px}\
.x-rank-row.head .x-rank-class{color:#5D4E37;font-weight:bold}\
.x-stu-stats{display:flex;justify-content:space-around;font-size:10px;color:#8D6E63;margin-top:2px;padding-top:2px;border-top:1px solid rgba(193,154,107,.15)}\
.x-stu-stats span{white-space:nowrap}\
.x-stage-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:rgba(193,154,107,.3);margin:0 2px}\
.x-stage-dot.on{background:#D4AF37;box-shadow:0 0 4px rgba(212,175,55,.6)}\
.x-bt-ready{background:linear-gradient(90deg,rgba(255,193,7,.2),rgba(255,87,34,.15));border:1px solid rgba(255,193,7,.4);border-radius:6px;padding:8px 12px;text-align:center;color:#E65100;font-weight:bold;font-size:13px;margin:8px 0;animation:xGoldPulse 2s ease-in-out infinite}\
.x-auto-cult{background:rgba(127,181,166,.12);border:1px solid rgba(127,181,166,.25);border-radius:6px;padding:6px 12px;text-align:center;color:#5D4E37;font-size:12px;margin:8px 0}\
.x-hero-combat{font-size:16px;color:#9E3D2D;font-weight:bold;margin-top:4px;cursor:pointer}\
.x-hero-combat:hover{color:#C3272B}\
/* 战力构成弹窗 */\
.x-combat-table{display:flex;flex-direction:column;gap:4px}\
.x-combat-row{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-radius:4px;background:rgba(245,240,230,.7);border:1px solid rgba(193,154,107,.2);font-size:13px}\
.x-combat-row b{color:#2C3E3F;font-size:16px}\
.x-combat-row small{color:#8D6E63;font-size:11px;margin-left:4px}\
.x-combat-row.total{background:linear-gradient(90deg,rgba(212,175,55,.2),rgba(193,39,43,.1));border-color:#D4AF37;font-size:15px}\
.x-combat-row.total b{color:#9E3D2D;font-size:20px}\
/* 武器库弹窗 */\
.x-wp-current{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(245,240,230,.7);border:1px solid rgba(193,154,107,.3);border-radius:6px;margin-bottom:10px;font-size:13px}\
.x-wp-section{margin-bottom:12px}\
.x-wp-section-title{font-size:14px;font-weight:bold;color:#9E3D2D;margin-bottom:6px;font-family:KaiTi,STKaiti,serif}\
.x-wp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}\
.x-wp-card{padding:8px;border-radius:6px;background:rgba(255,255,255,.7);border:2px solid;text-align:center;font-size:12px}\
.x-wp-card.equipped{background:rgba(212,175,55,.12);box-shadow:0 0 6px rgba(212,175,55,.3)}\
.x-wp-name{font-weight:bold;font-size:14px;margin-bottom:2px}\
.x-wp-tier{color:#8D6E63;margin-bottom:2px}\
.x-wp-bonus{color:#9E3D2D;font-weight:bold;margin-bottom:4px}\
.x-wp-desc{color:#5D4E37;font-size:11px;margin-bottom:4px}\
.x-wp-cost{color:#8D6E63;margin-bottom:4px}\
.x-wp-equipped{display:inline-block;padding:2px 6px;background:rgba(212,175,55,.2);border-radius:3px;color:#9E3D2D;font-size:11px}\
/* 灵石兑换弹窗 */\
.x-exchange-info{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;font-size:13px}\
.x-exchange-info div{flex:1;text-align:center;padding:6px;background:rgba(245,240,230,.7);border-radius:4px}\
.x-exchange-info b{color:#9E3D2D;font-size:16px}\
.x-exchange-input{display:flex;align-items:center;gap:8px;margin-bottom:8px}\
.x-exchange-input label{font-size:13px;color:#5D4E37}\
.x-exchange-input input{flex:1;padding:6px 8px;border:1px solid #C19A6B;border-radius:4px;font-size:14px;width:60px}\
.x-exchange-input span{font-size:12px;color:#8D6E63}\
.x-exchange-quick{display:flex;gap:4px;margin-bottom:8px}\
.x-exchange-preview{text-align:center;font-size:14px;color:#2C3E3F;padding:6px;background:rgba(212,175,55,.1);border-radius:4px}\
.x-exchange-preview b{color:#9E3D2D;font-size:18px}\
.x-award-block{margin-bottom:8px;padding:8px;border-radius:6px;background:rgba(255,255,255,.4);border:1px solid rgba(193,154,107,.2)}\
.x-award-label{font-size:12px;color:#8D6E63;font-weight:bold;margin-bottom:4px}\
.x-multi-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:8px}\
.x-multi-count{font-size:13px;color:#9E3D2D;font-weight:bold;min-width:80px}\
.x-multi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px;max-height:320px;overflow-y:auto;padding:4px}\
.x-multi-card{display:flex;flex-direction:column;align-items:center;padding:6px 4px;border-radius:6px;background:rgba(245,240,230,.6);border:1px solid rgba(193,154,107,.2);cursor:pointer;transition:all .15s;position:relative;text-align:center}\
.x-multi-card:hover{border-color:#D4AF37;background:rgba(212,175,55,.08)}\
.x-multi-card.selected{border-color:#C3272B;background:linear-gradient(135deg,rgba(195,39,43,.12),rgba(245,240,230,.6));box-shadow:0 0 6px rgba(195,39,43,.2)}\
.x-multi-card .x-multi-chk{position:absolute;top:4px;right:4px;width:14px;height:14px;cursor:pointer}\
.x-multi-avatar{width:40px;height:40px}\
.x-multi-name{font-size:11px;color:#2C3E3F;font-weight:bold;margin-top:2px}\
.x-multi-info{font-size:9px;color:#8D6E63;line-height:1.3}\
.x-multi-stone{font-size:10px;color:#D4AF37;font-weight:bold;margin-top:2px}\
.x-sum-table{width:100%;border-collapse:collapse;font-size:12px;color:#5D4E37}\
.x-sum-table td,.x-sum-table th{border:1px solid rgba(193,154,107,.2);padding:4px 6px;text-align:center}\
.x-sum-head{background:rgba(195,39,43,.08);font-weight:bold;color:#2C3E3F}\
.x-sum-row:hover{background:rgba(212,175,55,.08)}\
.x-sum-total{font-weight:bold;color:#D4AF37}\
.x-self-rank{background:linear-gradient(90deg,rgba(212,175,55,.2),rgba(195,39,43,.15));border:1px solid rgba(212,175,55,.4);border-radius:8px;padding:10px 16px;text-align:center;color:#9E3D2D;font-size:15px;font-weight:bold;margin-bottom:12px}\
.x-rank-row.self{background:linear-gradient(90deg,rgba(212,175,55,.18),rgba(255,255,255,.3));border-left:3px solid #D4AF37;font-weight:bold}\
.x-draw-info{padding:6px 12px;color:#5D4E37;font-size:13px;margin-bottom:6px;background:rgba(245,240,230,.6);border-radius:4px}\
.x-lg-frame-0{border:1px solid rgba(158,158,158,.3)!important}\
.x-lg-frame-1{border:1px solid rgba(141,110,99,.4)!important;box-shadow:0 0 4px rgba(141,110,99,.15)}\
.x-lg-frame-2{border:1px solid rgba(66,165,245,.4)!important;box-shadow:0 0 6px rgba(66,165,245,.2)}\
.x-lg-frame-3{border:1px solid rgba(171,71,188,.45)!important;box-shadow:0 0 8px rgba(171,71,188,.25)}\
.x-lg-frame-4{border:1px solid rgba(255,112,67,.5)!important;box-shadow:0 0 10px rgba(255,112,67,.3);position:relative}\
.x-lg-frame-4::before{content:"";position:absolute;inset:-1px;border-radius:inherit;background:linear-gradient(135deg,rgba(255,112,67,.15),transparent);pointer-events:none}\
.x-lg-frame-5{border:2px solid rgba(255,215,0,.55)!important;box-shadow:0 0 14px rgba(255,215,0,.35),inset 0 0 8px rgba(255,215,0,.1);position:relative}\
.x-lg-frame-5::before{content:"";position:absolute;inset:-2px;border-radius:inherit;background:conic-gradient(from 0deg,rgba(255,215,0,.2),rgba(255,112,67,.15),rgba(171,71,188,.12),rgba(255,215,0,.2));pointer-events:none;animation:xGoldPulse 3s ease-in-out infinite}\
/* 装备库标签页 */\
.x-wp-tabs{display:flex;gap:8px;margin-bottom:10px}\
.x-wp-tab{padding:6px 14px;border-radius:20px;cursor:pointer;font-size:13px;color:#5D4E37;background:rgba(245,240,230,.6);border:1px solid rgba(193,154,107,.3);transition:all .2s}\
.x-wp-tab:hover{background:rgba(212,175,55,.15)}\
.x-wp-tab.on{background:linear-gradient(135deg,#C3272B,#9E3D2D);color:#F5F0E6;border-color:#D4AF37;font-weight:bold}\
/* 我的排名 */\
.x-rank-me{background:rgba(245,240,230,.7);border:1px solid rgba(193,154,107,.35);border-radius:8px;padding:10px;margin:10px 0}\
.x-rank-me-title{font-size:14px;font-weight:bold;color:#9E3D2D;margin-bottom:6px;font-family:KaiTi,STKaiti,serif}\
.x-rank-me-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}\
.x-rank-me-grid div{display:flex;flex-direction:column;align-items:center;padding:6px;background:rgba(255,255,255,.5);border-radius:6px;font-size:12px}\
.x-rank-me-grid span{color:#8D6E63;margin-bottom:2px}\
.x-rank-me-grid b{color:#9E3D2D;font-size:13px}\
/* 排行榜形象框（前十越靠前越华丽） */\
.x-rank-avatar{width:44px;display:flex;justify-content:center;align-items:center;flex-shrink:0}\
.x-rank-frame{width:36px;height:36px;border-radius:50%;padding:3px;display:flex;align-items:center;justify-content:center;position:relative;background:#F5F0E6;box-sizing:border-box}\
.x-rank-frame svg{width:100%;height:100%;border-radius:50%;display:block}\
.x-rank-frame-1{border:3px solid #FFD700;box-shadow:0 0 16px rgba(255,215,0,.8),inset 0 0 8px rgba(255,215,0,.35)}\
.x-rank-frame-1::before{content:"";position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(from 0deg,#FFD700,#FF8C00,#C3272B,#FFD700);z-index:-1;animation:xRankSpin 2.5s linear infinite;box-shadow:0 0 12px rgba(255,215,0,.6)}\
.x-rank-frame-2{border:3px solid #C0C0C0;box-shadow:0 0 14px rgba(192,192,192,.7),inset 0 0 6px rgba(192,192,192,.3)}\
.x-rank-frame-2::before{content:"";position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(from 0deg,#C0C0C0,#E8E8E8,#A0A0A0,#C0C0C0);z-index:-1;animation:xRankSpin 3s linear infinite;box-shadow:0 0 10px rgba(192,192,192,.5)}\
.x-rank-frame-3{border:3px solid #CD7F32;box-shadow:0 0 12px rgba(205,127,50,.7),inset 0 0 6px rgba(205,127,50,.3)}\
.x-rank-frame-3::before{content:"";position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(from 0deg,#CD7F32,#E6A15C,#8B4513,#CD7F32);z-index:-1;animation:xRankSpin 3.5s linear infinite;box-shadow:0 0 10px rgba(205,127,50,.5)}\
.x-rank-frame-4{border:2px solid #AB47BC;box-shadow:0 0 10px rgba(171,71,188,.55),inset 0 0 4px rgba(171,71,188,.2)}\
.x-rank-frame-5{border:2px solid #42A5F5;box-shadow:0 0 10px rgba(66,165,245,.55),inset 0 0 4px rgba(66,165,245,.2)}\
.x-rank-frame-6{border:2px solid #66BB6A;box-shadow:0 0 8px rgba(102,187,106,.5),inset 0 0 4px rgba(102,187,106,.15)}\
.x-rank-frame-7{border:2px solid #26C6DA;box-shadow:0 0 8px rgba(38,198,218,.5),inset 0 0 4px rgba(38,198,218,.15)}\
.x-rank-frame-8{border:2px solid #EC407A;box-shadow:0 0 8px rgba(236,64,122,.5),inset 0 0 4px rgba(236,64,122,.15)}\
.x-rank-frame-9{border:2px solid #FFA726;box-shadow:0 0 8px rgba(255,167,38,.5),inset 0 0 4px rgba(255,167,38,.15)}\
.x-rank-frame-10{border:2px solid #C19A6B;box-shadow:0 0 8px rgba(193,154,107,.45),inset 0 0 4px rgba(193,154,107,.15)}\
@keyframes xRankSpin{to{transform:rotate(360deg)}}\
/* 排行榜行布局固定（防头像加入后换行） */\
.x-rank-row{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(193,154,107,.15);min-height:54px;flex-wrap:nowrap}\
.x-rank-row.head{font-weight:bold;color:#5D4E37;background:rgba(245,240,230,.7);border-bottom:2px solid rgba(193,154,107,.3);min-height:auto;padding:10px 12px}\
.x-rank-row.head .x-rank-avatar{font-size:11px;color:#5D4E37;text-align:center}\
.x-rank-medal{width:32px;text-align:center;font-size:16px;flex-shrink:0}\
.x-rank-name{flex:1;min-width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.x-rank-val{width:64px;text-align:center;flex-shrink:0}\
';
  document.head.appendChild(_xs2);
}


