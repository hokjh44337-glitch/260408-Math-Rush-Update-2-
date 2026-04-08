/* ================================================================
   Math Rush v3 — game.js
   의존성: index.html의 DOM ID들과 style.css 클래스명에 의존합니다.
================================================================ */

/* ── 게임 설정 상태 ── */
let cfg = { diff: 'easy', mode: 'calc', time: '15', deduct: '0' };

/* ── 게임 진행 상태 ── */
let score       = 0;
let timeLeft    = 0;
let totalTime   = 0;
let combo       = 0;
let crtC        = 0;   // 정답 횟수
let wrgC        = 0;   // 오답 횟수
let maxCombo    = 0;
let totalDeduct = 0;   // 누적 차감 점수
let correctAnswer;
let timerInt;
let locked      = false;
let bestScore   = 0;
let fxAnim      = null;

/* ── 콤보 버프 테이블 ── */
const BMULTS  = [1, 1, 1.2, 1.5, 2, 2.5];
const BLABELS = ['', '1콤보', '2콤보', '3콤보', '4콤보', 'MAX 5콤보!'];
const BCLS    = ['', 'b1', 'b2', 'b3', 'b4', 'b5'];

/* ── 난이도 설정 테이블 ── */
const DIFFS = {
  easy:       { maxA: 9,  maxB: 9,  ops: ['+', '-'] },
  medium:     { maxA: 9,  maxB: 9,  ops: ['+', '-', '×'] },
  hard:       { maxA: 19, maxB: 19, ops: ['+', '-', '×'] },
  expert:     { maxA: 19, maxB: 19, ops: ['+', '-', '×', '÷'] },
  impossible: { type: 'calc_adv' }
};

/* ── 임파서블 문제 풀 ── */
const IMP_POOL = [
  { q: 'd/dx [x³]',   correct: '3x²',     choices: ['3x²', '9',      '6',      '3x']      },
  { q: 'd/dx [sin x]',correct: 'cos x',   choices: ['cos x', '-sin x', 'sin x', '-cos x']  },
  { q: 'd/dx [eˣ]',   correct: 'eˣ',      choices: ['eˣ', 'xeˣ⁻¹', 'e', '0']              },
  { q: 'd/dx [ln x]', correct: '1/x',     choices: ['1/x', 'ln x', 'x', '1']               },
  { q: '∫ 2x dx',     correct: 'x²+C',    choices: ['x²+C', '2x²+C', 'x²', '2']           },
  { q: '∫ cos x dx',  correct: 'sin x+C', choices: ['sin x+C', '-sin x+C', 'cos x+C', 'tan x+C'] },
  { q: '∫ eˣ dx',     correct: 'eˣ+C',    choices: ['eˣ+C', 'xeˣ+C', 'eˣ⁻¹+C', '1']      },
  { q: 'L{1} = ?',    correct: '1/s',     choices: ['1/s', 's', '1', '1/s²']               },
  { q: 'L{t} = ?',    correct: '1/s²',    choices: ['1/s²', '1/s', 's', '2/s']             },
  { q: 'L{eᵃᵗ} = ?',  correct: '1/(s−a)', choices: ['1/(s−a)', '1/s', 'a/(s+a)', 's/(s−a)'] },
  { q: 'd/dx [x⁴]',   correct: '4x³',     choices: ['4x³', 'x³', '4x²', '4']              },
  { q: '∫ 3x² dx',    correct: 'x³+C',    choices: ['x³+C', '3x+C', 'x²+C', '6x']         },
];
let impIdx = [];

/* ── 유틸 ── */
function $(id) { return document.getElementById(id); }

function show(id) {
  ['S0', 'S1', 'S2'].forEach(s => $(s).classList.remove('active'));
  $(id).classList.add('active');
}

/* ── 설정 선택 (시작 화면 버튼) ── */
function pick(el, grp) {
  const gridId = { diff: 'diffGrid', mode: 'modeGrid', time: 'timeGrid', deduct: 'deductGrid' }[grp];
  const cls    = { diff: 'on-green', mode: 'on-purple', time: 'on-amber', deduct: 'on-amber' }[grp];
  $(gridId).querySelectorAll('.sel-btn').forEach(b =>
    b.classList.remove('on-green', 'on-purple', 'on-amber')
  );
  el.classList.add(cls);
  cfg[grp] = el.dataset.v;
  if (grp === 'time') {
    $('customRow').classList.toggle('hidden', cfg.time !== 'custom');
  }
}

/* ── 게임 시간 계산 ── */
function getTime() {
  if (cfg.time === 'custom') {
    const v = parseInt($('customSec').value) || 30;
    return Math.min(300, Math.max(5, v));
  }
  return parseInt(cfg.time);
}

/* ── 화면 전환 ── */
function goHome() {
  clearInterval(timerInt);
  stopFx();
  show('S0');
}

function restartSame() {
  stopFx();
  startGame();
}

/* ── 게임 시작 ── */
function startGame() {
  clearInterval(timerInt);
  stopFx();

  score       = 0;
  combo       = 0;
  crtC        = 0;
  wrgC        = 0;
  maxCombo    = 0;
  totalDeduct = 0;
  locked      = false;
  impIdx      = [];

  totalTime = getTime();
  timeLeft  = totalTime;

  $('score').textContent   = 0;
  $('timeNum').textContent = timeLeft;
  $('crtC').textContent    = 0;
  $('wrgC').textContent    = 0;
  $('acc').textContent     = '-';
  $('modeLabel').textContent = cfg.mode === 'calc' ? '계산 모드' : '역산 모드';

  updatePips();
  show('S1');
  nextQ();
  updateBar();

  timerInt = setInterval(() => {
    timeLeft--;
    $('timeNum').textContent = timeLeft;
    updateBar();
    if (timeLeft <= 0) endGame();
  }, 1000);
}

/* ── 타이머 바 갱신 ── */
function updateBar() {
  const pct = Math.max(0, (timeLeft / totalTime) * 100);
  const bar = $('timerBar');
  bar.style.width      = pct + '%';
  bar.style.background = pct > 50 ? '#0F6E56' : pct > 25 ? '#BA7517' : '#E24B4A';
}

/* ── 사칙연산 계산 ── */
function calcOp(a, op, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  if (op === '÷') return b !== 0 ? a / b : null;
}

/* ── 일반 문제 생성 ── */
function genQ() {
  const d = DIFFS[cfg.diff];
  if (d.type === 'calc_adv') return genImpossible();

  let a, b, op, ans, tries = 0;
  do {
    a   = Math.floor(Math.random() * (d.maxA + 1));
    b   = Math.floor(Math.random() * (d.maxB + 1));
    op  = d.ops[Math.floor(Math.random() * d.ops.length)];
    if (op === '÷') { b = b === 0 ? 1 : b; a = a * b; }
    ans = calcOp(a, op, b);
    tries++;
  } while ((ans === null || !Number.isInteger(ans)) && tries < 20);

  return { a, b, op, ans, label: `${a} ${op} ${b}` };
}

/* ── 임파서블 문제 생성 ── */
function genImpossible() {
  if (!impIdx.length) {
    impIdx = [...Array(IMP_POOL.length).keys()].sort(() => Math.random() - 0.5);
  }
  const item = IMP_POOL[impIdx.pop()];
  return { ...item, label: item.q, isImpossible: true };
}

/* ── 다음 문제 표시 ── */
function nextQ() {
  locked = false;
  $('fb').textContent = '';
  $('fb').className   = 'fbt';

  const q = genQ();

  if (q.isImpossible) {
    correctAnswer = q.correct;
    $('qlab').textContent = '다음의 값은?';
    $('qbox').textContent = q.q;
    const shuffled = [...q.choices].sort(() => Math.random() - 0.5);
    renderChoices(shuffled, c => c === correctAnswer, (btn, c) => { btn.textContent = c; });
    return;
  }

  if (cfg.mode === 'reverse') {
    correctAnswer = q.label;
    $('qlab').textContent = '이 숫자를 만드는 식은?';
    $('qbox').textContent = String(q.ans);
    const exprs = makeWrongExprs(q.label, q.ans);
    renderChoices(exprs, e => e === correctAnswer, (btn, e) => { btn.textContent = e; });
  } else {
    correctAnswer = q.ans;
    $('qlab').textContent = '다음 식의 정답은?';
    $('qbox').textContent = q.label + ' = ?';
    const nums = makeWrongNums(q.ans);
    renderChoices(nums, c => c === correctAnswer, (btn, c) => { btn.textContent = c; });
  }
}

/* ── 오답 숫자 보기 생성 ── */
function makeWrongNums(correct) {
  const s = new Set([correct]);
  let t = 0;
  while (s.size < 4 && t < 60) {
    t++;
    const offset = Math.floor(Math.random() * 11) - 5;
    if (offset !== 0) s.add(correct + offset);
  }
  return [...s].sort(() => Math.random() - 0.5);
}

/* ── 오답 식 보기 생성 (역산 모드) ── */
function makeWrongExprs(correct, target) {
  const d = DIFFS[cfg.diff];
  const s = new Set([correct]);
  let t = 0;
  while (s.size < 4 && t < 80) {
    t++;
    const a2  = Math.floor(Math.random() * (d.maxA + 1));
    let   b2  = Math.floor(Math.random() * (d.maxB + 1));
    const op  = d.ops[Math.floor(Math.random() * d.ops.length)];
    if (op === '÷') b2 = b2 === 0 ? 1 : b2;
    const ans2 = calcOp(a2, op, b2);
    const expr  = `${a2} ${op} ${b2}`;
    if (Number.isInteger(ans2) && ans2 !== target && !s.has(expr)) s.add(expr);
  }
  return [...s].sort(() => Math.random() - 0.5);
}

/* ── 선택지 DOM 렌더링 ── */
function renderChoices(items, isOk, setLbl) {
  const div = $('choices');
  div.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'cb';
    setLbl(btn, item);
    btn.onclick = () => checkAns(btn, isOk(item));
    div.appendChild(btn);
  });
}

/* ── 정답 확인 ── */
function checkAns(btn, isRight) {
  if (locked) return;
  locked = true;

  const mult = BMULTS[Math.min(combo, 5)];
  const fb   = $('fb');

  if (isRight) {
    const gain = Math.round((10 + combo * 2) * mult);
    score += gain;
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    crtC++;
    btn.classList.add('correct');
    fb.textContent = '+' + gain;
    fb.className   = 'fbt pos';
  } else {
    const pen = parseInt(cfg.deduct) || 0;
    if (pen > 0) {
      score       = Math.max(0, score - pen);
      totalDeduct += pen;
    }
    combo = 0;
    wrgC++;
    btn.classList.add('wrong');
    fb.textContent = pen ? `−${pen}점` : '틀림';
    fb.className   = 'fbt neg';

    $('choices').querySelectorAll('.cb').forEach(b => {
      const isAns = cfg.mode === 'reverse' || b.closest && false
        ? b.textContent === correctAnswer
        : b.textContent === String(correctAnswer);
      if (isAns) b.classList.add('correct');
      else if (b !== btn) b.classList.add('dis');
    });
  }

  $('score').textContent = score;
  updatePips();
  updateAcc();
  setTimeout(nextQ, 420);
}

/* ── 정답률 갱신 ── */
function updateAcc() {
  const t = crtC + wrgC;
  $('acc').textContent  = t ? Math.round(crtC / t * 100) + '%' : '-';
  $('crtC').textContent = crtC;
  $('wrgC').textContent = wrgC;
}

/* ── 콤보 pip & 배지 갱신 ── */
function updatePips() {
  const div = $('pips');
  div.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip' + (i < combo ? (combo >= 5 ? ' mx' : ' f') : '');
    div.appendChild(pip);
  }
  $('cnum').textContent = combo;

  const badge   = $('badge');
  const buffIdx = Math.min(combo, 5);
  if (combo >= 2) {
    badge.className   = 'bbadge ' + BCLS[buffIdx];
    badge.textContent = BLABELS[buffIdx] + ' ×' + BMULTS[buffIdx];
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/* ── 게임 종료 ── */
function endGame() {
  clearInterval(timerInt);
  locked = true;
  if (score > bestScore) bestScore = score;

  const t   = crtC + wrgC;
  const acc = t ? Math.round(crtC / t * 100) + '%' : '-';

  $('endScore').textContent = score;
  $('eBest').textContent    = bestScore + '점';
  $('eAcc').textContent     = acc;
  $('eCombo').textContent   = maxCombo + '콤보';
  $('eDeduct').textContent  = '-' + totalDeduct + '점';

  const diffNames = {
    easy: '쉬움', medium: '중간', hard: '어려움',
    expert: '고난도', impossible: '임파서블'
  };
  $('endSub').textContent =
    diffNames[cfg.diff] + ' · ' +
    (cfg.mode === 'calc' ? '계산' : '역산') + ' · ' + totalTime + '초';

  let rank = '', rankColor = '#0F6E56';
  if      (score <= 50)  { rank = '조금 더 연습해 봐요';  rankColor = '#378ADD'; }
  else if (score < 100)  { rank = '좋아요! 계속 도전!';   rankColor = '#639922'; }
  else if (score < 300)  { rank = '훌륭해요!';            rankColor = '#BA7517'; }
  else                   { rank = '천재급 계산 실력!';     rankColor = '#D85A30'; }

  const rankEl = $('endRank');
  rankEl.textContent  = rank;
  rankEl.style.color  = rankColor;

  show('S2');
  requestAnimationFrame(() => runFx(score));
}

/* ── 이펙트 중지 ── */
function stopFx() {
  if (fxAnim) { cancelAnimationFrame(fxAnim); fxAnim = null; }
  const canvas = $('fx');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/* ── 점수별 결과 이펙트 ── */
function runFx(sc) {
  const wrap   = $('fxWrap');
  const canvas = $('fx');
  const W = wrap.offsetWidth  || 380;
  const H = wrap.offsetHeight || 180;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  /* 50점 이하: 빗방울 */
  if (sc <= 50) {
    const drops = [];
    for (let i = 0; i < 60; i++) {
      drops.push({
        x: Math.random() * W,
        y: Math.random() * -H,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 1 + Math.random() * 2,
        r: 1.5 + Math.random() * 2,
        alpha: 0.5 + Math.random() * 0.4
      });
    }
    function animRain() {
      ctx.clearRect(0, 0, W, H);
      drops.forEach(p => {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 3, p.y + p.vy * 6);
        ctx.strokeStyle = `rgba(55,138,221,${p.alpha})`;
        ctx.lineWidth   = p.r;
        ctx.stroke();
        p.x += p.vx;
        p.y += p.vy * 2;
        if (p.y > H) { p.y = -10; p.x = Math.random() * W; }
      });
      fxAnim = requestAnimationFrame(animRain);
    }
    animRain();

  /* 100점 이상 300점 미만: 별 파티클 (박수) */
  } else if (sc < 300) {
    const STAR_COLORS = ['#D4537E', '#1D9E75', '#BA7517', '#7F77DD'];
    const notes = [];
    for (let i = 0; i < 30; i++) {
      notes.push({
        x:     Math.random() * W,
        y:     H + Math.random() * 50,
        vy:    1.5 + Math.random() * 1.5,
        alpha: 0.8,
        size:  10 + Math.random() * 10,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
      });
    }
    function animClap() {
      ctx.clearRect(0, 0, W, H);
      notes.forEach(p => {
        p.y    -= p.vy;
        p.alpha -= 0.004;
        if (p.alpha <= 0 || p.y < -20) {
          p.y = H + 10; p.alpha = 0.8; p.x = Math.random() * W;
        }
        ctx.font        = Math.round(p.size) + 'px sans-serif';
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = p.color;
        ctx.fillText('★', p.x, p.y);
      });
      ctx.globalAlpha = 1;
      fxAnim = requestAnimationFrame(animClap);
    }
    animClap();

  /* 300점 이상: 폭죽 */
  } else {
    const FIREWORK_COLORS = ['#D85A30', '#BA7517', '#D4537E', '#1D9E75', '#7F77DD', '#FAC775'];
    const bursts = [];
    function spawnBurst() {
      const bx = Math.random() * W;
      const by = Math.random() * H * 0.7 + H * 0.1;
      for (let i = 0; i < 24; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 5;
        bursts.push({
          x:     bx, y: by,
          vx:    Math.cos(ang) * spd,
          vy:    Math.sin(ang) * spd,
          alpha: 1,
          r:     3 + Math.random() * 3,
          color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
          life:  60 + Math.random() * 30
        });
      }
    }
    spawnBurst();
    let frameN = 0;
    function animFirework() {
      ctx.clearRect(0, 0, W, H);
      frameN++;
      if (frameN % 30 === 0) spawnBurst();
      for (let i = bursts.length - 1; i >= 0; i--) {
        const p = bursts[i];
        p.x    += p.vx;
        p.y    += p.vy;
        p.vy   += 0.12;
        p.alpha -= 0.018;
        p.life--;
        if (p.alpha <= 0 || p.life <= 0) { bursts.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle   = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      fxAnim = requestAnimationFrame(animFirework);
    }
    animFirework();
  }
}
