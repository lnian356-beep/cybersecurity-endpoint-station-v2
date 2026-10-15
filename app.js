const $ = s => document.querySelector(s);
let gameId = null,
  mode = 'normal',
  busy = false,
  timerId = null,
  deadline = 0,
  lastState = null,
  soundEnabled = true,
  audioCtx = null,
  lastBeepSec = -1,
  endlessUnlockedBeforeGame = false;

const letters = ['A', 'B', 'C', 'D'];
const tileIcons = { start: '⚑', normal: '⌘', chance: '✦', fate: '↗' };

// Web Audio 合成音效引擎（零外部音檔依賴）
function playTone(type) {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;

    const note = (freq, start, dur, wave = 'sine', vol = 0.12) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + dur);
    };

    if (type === 'click') note(520, now, 0.06, 'triangle', 0.08);
    if (type === 'step') note(680, now, 0.07, 'sine', 0.1);
    if (type === 'tick') note(880, now, 0.05, 'sine', 0.07);
    if (type === 'roll') {
      [300, 420, 540, 660, 780].forEach((f, i) => note(f, now + i * 0.05, 0.06, 'triangle', 0.09));
    }
    if (type === 'right') {
      note(523.25, now, 0.12, 'triangle', 0.14);
      note(659.25, now + 0.09, 0.14, 'triangle', 0.14);
      note(783.99, now + 0.18, 0.25, 'triangle', 0.16);
    }
    if (type === 'wrong') {
      note(240, now, 0.18, 'sawtooth', 0.11);
      note(180, now + 0.14, 0.28, 'sawtooth', 0.12);
    }
    if (type === 'win') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, now + i * 0.11, 0.3, 'triangle', 0.15));
    }
    const sweep = (from, to, start, duration, wave = 'sawtooth', volume = 0.12) => {
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(from, start);
      osc.frequency.exponentialRampToValueAtTime(to, start + duration);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(start); osc.stop(start + duration);
    };
    if (type === 'unlock') {
      sweep(196, 49, now, 0.9, 'sawtooth', 0.15);
      [73.42, 110, 146.83].forEach((f, i) => note(f, now + i * 0.18, 0.85, 'triangle', 0.11));
      [220, 293.66, 440, 587.33].forEach((f, i) => note(f, now + 0.8 + i * 0.13, 0.55, 'triangle', 0.12));
    }
    if (type === 'bossStart') {
      sweep(130.81, 55, now, 1.15, 'sawtooth', 0.16);
      note(55, now + 0.15, 1.1, 'triangle', 0.14);
      [82.41, 110, 164.81].forEach((f, i) => note(f, now + 0.72 + i * 0.2, 0.48, 'triangle', 0.1));
    }
    if (type === 'bossRoll') {
      sweep(392, 98, now, 0.72, 'triangle', 0.12);
      note(65.41, now + 0.48, 0.28, 'sawtooth', 0.1);
    }
    if (type === 'bossRight') {
      [146.83, 220, 293.66, 440].forEach((f, i) => note(f, now + i * 0.1, 0.32, 'triangle', 0.13));
    }
    if (type === 'bossHit') {
      sweep(220, 55, now, 0.42, 'sawtooth', 0.15);
      note(73.42, now + 0.1, 0.5, 'triangle', 0.11);
    }
    if (type === 'bossWin') {
      [110, 146.83, 196, 293.66, 392, 587.33].forEach((f, i) => note(f, now + i * 0.13, 0.58, 'triangle', 0.14));
    }
    if (type === 'bossTick') note(523.25, now, 0.07, 'triangle', 0.08);
    if (type === 'bossStep') note(130.81, now, 0.09, 'triangle', 0.07);
  } catch {}
}

// 勝利彩帶特效
function fireConfetti() {
  const canvas = $('#confetti');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#68785f', '#bd7659', '#b39a62', '#91816e', '#aa6556', '#87927a'];
  const pieces = Array.from({ length: 110 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 200,
    w: 6 + Math.random() * 6,
    h: 10 + Math.random() * 8,
    vx: (Math.random() - 0.5) * 5,
    vy: 3 + Math.random() * 5,
    rot: Math.random() * 360,
    vrot: (Math.random() - 0.5) * 10,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));
  let frame = 0;
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (++frame < 180) requestAnimationFrame(render);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  render();
}

async function api(url, data, method = 'POST') {
  const res = await fetch(url, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || '連線發生問題');
  return out;
}

function view(id) {
  ['intro', 'game', 'handoff', 'end'].forEach(x =>
    $('#' + x).classList.toggle('hidden', x !== id)
  );
}

function makePlayerFields() {
  const wrap = $('#players'),
    count = wrap.children.length;
  if (count >= 4) return;
  const row = document.createElement('div');
  row.className = 'playerInput';
  const tag = document.createElement('span');
  tag.className = 'playerTag';
  tag.textContent = 'P' + (count + 1);
  const input = document.createElement('input');
  input.maxLength = 12;
  input.placeholder = '輸入玩家 ' + (count + 1) + ' 名稱';
  input.value = count === 0 ? '玩家一' : count === 1 ? '玩家二' : '';
  row.append(tag, input);
  if (count >= 2) {
    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.onclick = () => {
      playTone('click');
      row.remove();
      relabel();
    };
    row.append(remove);
  }
  wrap.append(row);
  $('#addPlayer').classList.toggle('hidden', wrap.children.length >= 4);
}

function relabel() {
  [...$('#players').children].forEach((row, i) => {
    row.querySelector('.playerTag').textContent = 'P' + (i + 1);
    row.querySelector('input').placeholder = '輸入玩家 ' + (i + 1) + ' 名稱';
  });
  $('#addPlayer').classList.toggle('hidden', $('#players').children.length >= 4);
}

function names() { return [...$('#players').querySelectorAll('input')].map(x=>x.value.trim()).filter(Boolean); }
const endlessPoolCount=580; let unlockCheckId=0;
async function arePlayersEndlessUnlocked(list) {
  if (list.length !== 2 || list[0] === list[1]) return false;
  try {
    const result = await api('/api/unlocks?names=' + encodeURIComponent(list.join('|')), null, 'GET');
    return result.unlocked;
  } catch { return false; }
}
async function updateEndlessAvailability() {
  const card = $('.endless-mode'), status = $('.endless-status');
  if (!card) return;
  const list = names(), check = ++unlockCheckId;
  const unlocked = await arePlayersEndlessUnlocked(list);
  if (check !== unlockCheckId) return;
  card.classList.toggle('hidden', !unlocked);
  card.disabled = !unlocked;
  card.classList.toggle('unlocked', unlocked);
  if (status) status.textContent = unlocked ? '魔王關卡已解鎖｜580 題進階題庫・每人 30 HP' : '隱藏關卡';
  const mark = card.querySelector('.lockMark');
  if (mark) mark.textContent = unlocked ? '♛' : '🔒';
  if (!unlocked && mode === 'endless') {
    mode = 'normal';
    document.querySelectorAll('.mode').forEach(button => button.classList.toggle('selected', button.dataset.mode === mode));
  }
}

function setTimer(seconds) {
  clearInterval(timerId);
  lastBeepSec = -1;
  deadline = Date.now() + seconds * 1000;
  const tick = () => {
    const left = Math.max(0, (deadline - Date.now()) / 1000);
    $('#timer').textContent = left.toFixed(1) + 's';
    $('#timer').style.setProperty('--progress', Math.max(0, left / seconds));
    const urgent = left <= 5 && left > 0;
    $('#timer').classList.toggle('urgent', urgent);
    const secInt = Math.ceil(left);
    if (urgent && secInt !== lastBeepSec) {
      lastBeepSec = secInt;
      playTone(lastState?.endless ? 'bossTick' : 'tick');
    }
    if (left <= 0) {
      clearInterval(timerId);
      answer(-1);
    }
  };
  tick();
  timerId = setInterval(tick, 100);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
  $('#timer').classList.remove('urgent');
}

// 3D 骰子角度對應表
const diceRotations = {
  1: 'translateZ(-34px) rotateX(0deg) rotateY(0deg)',
  2: 'translateZ(-34px) rotateX(0deg) rotateY(180deg)',
  3: 'translateZ(-34px) rotateX(0deg) rotateY(-90deg)',
  4: 'translateZ(-34px) rotateX(0deg) rotateY(90deg)',
  5: 'translateZ(-34px) rotateX(-90deg) rotateY(0deg)',
  6: 'translateZ(-34px) rotateX(90deg) rotateY(0deg)'
};

function draw(s, activeDice = 1) {
  lastState = s;
  const board = $('#board');
  const spots = [
    [5, 1], [5, 2], [5, 3], [5, 4], [5, 5],
    [4, 5], [3, 5], [2, 5], [1, 5],
    [1, 4], [1, 3], [1, 2], [1, 1],
    [2, 1], [3, 1], [4, 1]
  ];
  board.innerHTML = '';

  s.tiles.forEach((tile, i) => {
    const cell = document.createElement('div');
    cell.className = 'tile ' + tile.type;
    cell.dataset.tileIndex = i;
    cell.style.gridRow = spots[i][0];
    cell.style.gridColumn = spots[i][1];

    const top = document.createElement('div');
    top.className = 'tile-top';
    top.innerHTML = `<span>#${String(i).padStart(2, '0')}</span><i class="tile-icon">${tileIcons[tile.type] || '🖧'}</i>`;

    const label = document.createElement('div');
    label.className = 'tile-name';
    label.textContent = tile.name;

    cell.append(top, label);

    const occupants = s.players
      .map((p, n) => ({ p, n }))
      .filter(x => x.p.position === i);

    if (occupants.length) {
      const tray = document.createElement('div');
      tray.className = 'token-tray';
      occupants.forEach(({ p, n }) => {
        const token = document.createElement('i');
        token.className = 'token color' + n;
        token.textContent = String(n + 1);
        token.title = `玩家 ${n + 1}：${p.name}`;
        token.setAttribute('aria-label', token.title);
        tray.append(token);
      });
      cell.append(tray);
    }

    if (occupants.some(x => x.n === s.currentPlayer.index)) {
      cell.classList.add('current');
    }
    board.append(cell);
  });

  const center = document.createElement('div');
  center.className = 'center';
  center.innerHTML = `
    <div class="dice-scene" id="centerDice" title="點擊擲骰">
      <div class="cube" id="diceCube" style="transform: ${diceRotations[activeDice] || diceRotations[1]}">
        <div class="cube-face f-1">1</div>
        <div class="cube-face f-2">2</div>
        <div class="cube-face f-3">3</div>
        <div class="cube-face f-4">4</div>
        <div class="cube-face f-5">5</div>
        <div class="cube-face f-6">6</div>
      </div>
    </div>
    <b>資安終點站</b>
    <small>${s.endless?`第 ${s.round} 回合 · 無盡對決`:`第 ${s.round} / ${s.totalRounds} 回合`}</small>
  `;
  board.append(center);
  const diceEl = $('#centerDice');
  if (diceEl) diceEl.onclick = () => { if ($('#roll') && !$('#roll').disabled) roll(); };

  $('#round').textContent=s.endless?`第 ${s.round} 回合｜剩餘題目 ${s.deckRemaining}`:'第 '+s.round+' / 10 回合';
  $('#modeLabel').textContent = s.difficulty + '模式';
  $('#playerTurn').textContent = s.currentPlayer.name + ' 的回合';

  $('#playersLive').replaceChildren(
    ...s.players.map((p, i) => {
      const d = document.createElement('div');
      d.className = 'livePlayer color' + i + (i === s.currentPlayer.index ? ' active' : '');
      const dot = document.createElement('i');
      dot.textContent = String(i + 1);
      dot.setAttribute('aria-label', `玩家 ${i + 1}`);
      const name = document.createElement('span');
      name.textContent = `玩家 ${i + 1}｜${p.name}`;
      const pts = document.createElement('b');
      pts.textContent=s.endless?`♥ ${p.hp} HP · ${p.correct} 題`:p.correct+'題 · '+p.coins+'◈';
      d.append(dot, name, pts);
      return d;
    })
  );
}

// 棋子逐格跳動動畫
async function animateSteps(startPos, steps, totalTiles) {
  for (let s = 1; s <= steps; s++) {
    const pos = (startPos + s) % totalTiles;
    document.querySelectorAll('.tile').forEach(t => t.classList.remove('stepping'));
    const target = document.querySelector(`.tile[data-tile-index="${pos}"]`);
    if (target) target.classList.add('stepping');
    playTone(lastState?.endless ? 'bossStep' : 'step');
    await new Promise(r => setTimeout(r, 110));
  }
}

function renderQuestion(q) {
  const host = $('#question');
  host.innerHTML = '';

  const wrap = document.createElement('div');
  const cat = document.createElement('small');
  cat.className = 'category';
  cat.textContent = q.category;

  const title = document.createElement('h3');
  title.className = 'questionTitle';
  title.textContent = q.question;

  const list = document.createElement('div');
  list.className = 'choices';

  q.options.forEach((text, i) => {
    const button = document.createElement('button');
    button.className = 'choice';
    button.type = 'button';
    const key = document.createElement('b');
    key.textContent = letters[i];
    const label = document.createElement('span');
    label.textContent = text;
    button.append(key, label);
    button.onclick = () => answer(i);
    list.append(button);
  });

  wrap.append(cat, title, list);
  if(q.event){const event=document.createElement('aside');event.className='eventNote';const t=document.createElement('b');t.textContent=q.event.title;const d=document.createElement('span');d.textContent=q.event.text;event.append(t,d);wrap.insertBefore(event,cat);}
  host.append(wrap);
  setTimer(q.timeLimit||lastState.timeLimit);
}

function getPlayerSetup() {
  const list = names();
  if (list.length < 2) throw new Error('至少要填兩個名字才能開始。');
  return list;
}

async function start() {
  if (busy) return;
  let list;
  try {
    list = getPlayerSetup();
    if(mode==='endless'&&list.length!==2)throw new Error('無盡模式只支援兩位玩家。');
  } catch (e) {
    alert(e.message);
    return;
  }
  playTone('click');
  busy = true;
  $('#start').disabled = true;
  try {
    endlessUnlockedBeforeGame = mode === 'gay' ? await arePlayersEndlessUnlocked(list) : false;
    const s = await api('/api/start', { players: list, difficulty: mode });
    gameId = s.id;
    document.body.classList.toggle('endlessTheme', s.endless);
    if (s.endless) playTone('bossStart');
    draw(s);
    view('game');
    ready();
  } catch (e) {
    alert(e.message);
  } finally {
    busy = false;
    $('#start').disabled = false;
  }
}

async function roll() {
  if (busy || !gameId) return;
  busy = true;
  const b = $('#roll');
  if (b) b.disabled = true;
  const prevPos = lastState ? lastState.currentPlayer.position : 0;

  playTone(lastState?.endless ? 'bossRoll' : 'roll');
  const cube = $('#diceCube');
  if (cube) cube.classList.add('rolling');
  const diceScene = $('#centerDice');
  if (diceScene) diceScene.classList.add('throwing');
  $('#turn').textContent = '骰子轉動中…';

  await new Promise(r => setTimeout(r, 900));
  try {
    const s = await api('/api/roll', { gameId });
    if (cube) {
      cube.classList.remove('rolling');
      cube.style.transform = diceRotations[s.lastRoll] || diceRotations[1];
    }
    if (diceScene) diceScene.classList.remove('throwing');
    await animateSteps(prevPos, s.lastRoll, s.tiles.length);
    draw(s, s.lastRoll);
    $('#turn').textContent = '擲出 ' + s.lastRoll + ' 點 → 走到「' + s.tile.name + '」';
    renderQuestion(s.pending);
  } catch (e) {
    if (cube) cube.classList.remove('rolling');
    if (diceScene) diceScene.classList.remove('throwing');
    alert(e.message);
    if (b) b.disabled = false;
  } finally {
    busy = false;
  }
}

async function answer(choice) {
  if (busy) return;
  busy = true;
  stopTimer();
  document.querySelectorAll('.choice').forEach(b => (b.disabled = true));
  try {
    const s = await api('/api/answer', { gameId, choice });
    const r = s.result,
      buttons = [...document.querySelectorAll('.choice')];
    const answerText = buttons[r.answer]?.querySelector('span')?.textContent || '（答案未顯示）';
    draw(s);
    if (r.answer >= 0 && buttons[r.answer]) buttons[r.answer].classList.add('right');
    if (choice >= 0 && !r.correct && buttons[choice]) buttons[choice].classList.add('wrong');

    playTone(s.endless ? (r.correct ? 'bossRight' : 'bossHit') : (r.correct ? 'right' : 'wrong'));

    const f = document.createElement('div');
    f.className = 'feedback ' + (r.correct ? 'good' : 'bad');
    const strong = document.createElement('b');
    strong.textContent = r.timedOut
      ? '時間到！'
      : r.correct
      ? '答對了！'
      : '答錯了';

    const detail = document.createElement('span');
    const scoreLine = s.endless
      ? (r.correct ? `對手扣 ${r.damage} 點血` : `自己扣 ${r.damage} 點血`)
      : (r.correct ? `拿到 ${r.coinsChange} 網路幣` : `扣掉 ${Math.abs(r.coinsChange)} 網路幣`);
    detail.textContent = `${scoreLine}\n正解：${answerText}\n判斷重點：${r.explanation}`;

    f.append(strong, detail);
    $('#question').append(f);

    const next = document.createElement('button');
    next.className = 'nextButton';
    next.type = 'button';
    next.innerHTML = s.finished
      ? '<span>看結果</span><kbd>SPACE</kbd>'
      : '<span>交給下一位</span><kbd>SPACE</kbd>';
    next.onclick = () => (s.finished ? finish(s) : showHandoff(s));
    $('#question').append(next);
  } catch (e) {
    alert(e.message);
    document.querySelectorAll('.choice').forEach(b => (b.disabled = false));
  } finally {
    busy = false;
  }
}

function showHandoff(s) {
  playTone('click');
  stopTimer();
  $('#nextName').textContent = s.currentPlayer.name;
  $('#readyName').textContent = s.currentPlayer.name;
  view('handoff');
}

function renderReadyPrompt() {
  $('#turn').textContent = '等待發送封包';
  $('#timer').textContent = lastState.timeLimit.toFixed(1) + 's';
  $('#timer').style.setProperty('--progress', 1);
  $('#question').innerHTML = `
    <div class="readyCard">
      <span>換你了</span>
      <h3>輪到你擲骰子</h3>
      <p>本回合答題限時 <b>${lastState.timeLimit} 秒</b>。也可以點棋盤中間的骰子。</p>
    </div>
    <button id="roll" type="button">
      <span>擲骰子</span>
      <kbd>SPACE</kbd>
    </button>
  `;
  $('#roll').onclick = roll;
}

async function ready() {
  try {
    if (lastState && lastState.handoff) {
      lastState = await api('/api/ready', { gameId });
    }
    draw(lastState);
    renderReadyPrompt();
    view('game');
  } catch (e) {
    alert(e.message);
  }
}

async function startReady() {
  if (busy) return;
  playTone('click');
  busy = true;
  $('#ready').disabled = true;
  try {
    lastState = await api('/api/ready', { gameId });
    draw(lastState);
    renderReadyPrompt();
    view('game');
  } catch (e) {
    alert(e.message);
  } finally {
    busy = false;
    $('#ready').disabled = false;
  }
}

function renderAfterGame(s, ordered) {
  const review = Array.isArray(s.review) ? s.review : [];
  const missed = review.filter(item => !item.correct);
  $('#reviewSummary').textContent = `本局答對 ${review.length - missed.length} / ${review.length} 題${missed.length ? `，有 ${missed.length} 題可以再看一次。` : '，全數答對，沒有錯題。'}`;

  const byTopic = new Map();
  review.forEach(item => {
    const stat = byTopic.get(item.category) || { correct: 0, total: 0 };
    stat.total++;
    if (item.correct) stat.correct++;
    byTopic.set(item.category, stat);
  });
  $('#topicReview').replaceChildren(...[...byTopic.entries()].map(([category, stat]) => {
    const chip = document.createElement('span');
    chip.className = 'topicChip' + (stat.correct < stat.total / 2 ? ' needsReview' : '');
    chip.textContent = `${category} ${stat.correct}/${stat.total}`;
    return chip;
  }));

  const wrongHost = $('#wrongReview');
  if (!missed.length) {
    const note = document.createElement('p');
    note.className = 'reviewEmpty';
    note.textContent = '這局沒有錯題，繼續保持。';
    wrongHost.replaceChildren(note);
  } else {
    wrongHost.replaceChildren(...missed.map((item, index) => {
      const card = document.createElement('article');
      card.className = 'reviewQuestion';
      const head = document.createElement('small');
      head.textContent = `第 ${index + 1} 題・${item.player}・${item.category}`;
      const prompt = document.createElement('b');
      prompt.textContent = item.question;
      const answer = document.createElement('p');
      answer.textContent = `正解：${item.options[item.answer] || '答案未提供'}`;
      const choice = document.createElement('p');
      choice.textContent = item.timedOut ? '作答時間已到。' : `你的選擇：${item.options[item.choice] || '未作答'}`;
      const why = document.createElement('p');
      why.textContent = `判斷重點：${item.explanation}`;
      card.append(head, prompt, answer, choice, why);
      return card;
    }));
  }

  const earned = ordered.flatMap(player => (player.newTitles || []).map(title => `${player.name}｜${title}`));
  const totalTitles = ordered.reduce((sum, player) => sum + (player.titleCount || 0), 0);
  const maxTitles = ordered.length * 100;
  $('#titleSummary').textContent = earned.length
    ? `本局新解鎖 ${earned.length} 個稱號。各玩家已解鎖數會累積保存。`
    : `本局沒有新解鎖稱號；目前玩家收藏共 ${totalTitles} / ${maxTitles} 個。`;
  const titleHost = $('#newTitles');
  titleHost.replaceChildren(...(earned.length ? earned.map(label => {
    const badge = document.createElement('span');
    badge.className = 'titleBadge';
    badge.textContent = '✦ ' + label;
    return badge;
  }) : [Object.assign(document.createElement('span'), { className: 'titleQuiet', textContent: '繼續累積各主題的答對紀錄，就會解鎖下一個稱號。' })]));

  const collection = $('#titleCollection');
  const unlocked = ordered.flatMap(player => (player.unlockedTitles || []).map(title => ({ player: player.name, title })));
  collection.replaceChildren(...(unlocked.length ? unlocked.map(({ player, title }) => {
    const item = document.createElement('span');
    item.className = 'collectionTitle';
    item.textContent = `${title}｜${player}`;
    return item;
  }) : [Object.assign(document.createElement('p'), { className: 'titleQuiet', textContent: '目前還沒有解鎖的稱號。答對不同主題的題目，就會慢慢收進收藏。' })]));
}

async function showEndlessUnlock() {
  const curtain = $('#unlockCurtain'), button = $('#unlockContinue');
  if (!curtain || !button) return;
  curtain.classList.remove('hidden');
  requestAnimationFrame(() => curtain.classList.add('revealed'));
  playTone('unlock');
  button.focus();
  await new Promise(resolve => {
    button.onclick = () => {
      curtain.classList.remove('revealed');
      curtain.classList.add('leaving');
      setTimeout(() => {
        curtain.classList.add('hidden');
        curtain.classList.remove('leaving');
        button.onclick = null;
        resolve();
      }, 360);
    };
  });
}

async function finish(s) {
  if (s.difficulty === 'GAY炮' && !endlessUnlockedBeforeGame && s.players.length === 2 && s.players[0].name !== s.players[1].name) {
    const unlocked = await arePlayersEndlessUnlocked(s.players.map(player => player.name));
    endlessUnlockedBeforeGame = unlocked;
    if (unlocked) {
      updateEndlessAvailability();
      await showEndlessUnlock();
    }
  }
  stopTimer();
  playTone(s.endless ? 'bossWin' : 'win');
  fireConfetti();
  const ordered=[...s.players].sort((a,b)=>s.endless?b.hp-a.hp:b.correct-a.correct||b.coins-a.coins);const tied=!s.endless&&ordered.length>1&&ordered[0].correct===ordered[1].correct&&ordered[0].coins===ordered[1].coins;$('#winner').textContent=s.endless?`🏆 ${s.winner||ordered[0].name} 贏下無盡對決！`:tied?'平手！':'👑 '+ordered[0].name+' 贏了！';
  $('#winnerTitle').textContent = tied ? '本場最佳稱號｜' + (ordered[0].bestTitle || '新手上路') : '本場稱號｜' + (ordered[0].bestTitle || '新手上路');
  $('#subtitle').textContent=s.endless?`30 HP 對決結束・題庫 ${endlessPoolCount} 題・成績已保存`:`${s.difficulty}模式・本局紀錄已保存`;

  $('#finalRanks').replaceChildren(
    ...ordered.map((p, i) => {
      const row = document.createElement('div');
      row.className = 'rankRow';
      const place = document.createElement('b');
      place.textContent = ['🥇', '🥈', '🥉', '#4'][i];
      const identity = document.createElement('div');
      identity.className = 'rankIdentity';
      const n = document.createElement('span');
      n.textContent = p.name;
      const title = document.createElement('small');
      title.className = 'rankTitle';
      title.textContent = `稱號｜${p.bestTitle || '新手上路'} · ${p.titleCount || 0}/100`;
      identity.append(n, title);
      const stat = document.createElement('small');
      stat.className = 'rankStat';
      stat.textContent = p.correct + ' 題正確 · ' + p.coins + ' ◈';
      row.append(place, identity, stat);
      return row;
    })
  );
  renderAfterGame(s, ordered);
  view('end');
  loadScores();
}

async function loadScores() {
  try {
    const config = await api('/api/config', null, 'GET');
    $('#storageScope').textContent = config.storage === 'cloud' ? '雲端共用' : '留在這台電腦';
    $('#recordsStorageNote').textContent = config.storage === 'cloud' ? '成績同步保存於雲端，可跨裝置查看' : '成績存在這台電腦';
    const data = await api('/api/scores', null, 'GET'),
      target = $('#scores');
    target.innerHTML = '';
    if (!data.scores.length) {
      target.innerHTML =
        '<p class="empty">目前還沒有成績。</p>';
      return;
    }
    data.scores.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'scoreRow';
      const pos = document.createElement('b');
      pos.textContent = String(i + 1).padStart(2, '0');
      const n = document.createElement('span');
      n.textContent = s.name;
      const modeText = document.createElement('small');
      modeText.textContent = s.difficulty;
      const points = document.createElement('strong');
      points.textContent = s.difficulty === '無盡模式' ? s.correct + '/' + s.total + ' 題 · 剩 ' + (s.coins ?? 0) + ' HP' : s.correct + '/' + s.total + '題 · ' + (s.coins ?? 1200) + '◈';
      row.append(pos, n, modeText, points);
      target.append(row);
    });
  } catch (e) {
    $('#scores').textContent = '暫時無法讀取歷史成績。';
  }
}

function reset() {
  playTone('click');
  stopTimer();
  gameId = null;
  lastState = null;
  view('intro');
  document.body.classList.remove('endlessTheme');
  loadScores();
  updateEndlessAvailability();
}

// 音效開關
$('#soundToggle').onclick = () => {
  soundEnabled = !soundEnabled;
  $('#soundToggle').textContent = soundEnabled ? '🔊 音效開啟' : '🔇 靜音模式';
  if (soundEnabled) playTone('click');
};

$('#start').onclick = start;
$('#addPlayer').onclick=()=>{playTone('click');makePlayerFields();bindPlayerInputs();};
function bindPlayerInputs(){document.querySelectorAll('#players input').forEach(input=>input.oninput=updateEndlessAvailability);}
$('#reset').onclick = () => {
  if (confirm('確定要提早終止這場比賽嗎？目前的進度將不會保存。')) reset();
};
$('#ready').onclick = startReady;
$('#again').onclick = reset;

document.querySelectorAll('.mode').forEach(b => {
  b.onclick = () => {
    playTone('click');
    document.querySelectorAll('.mode').forEach(x => x.classList.remove('selected'));
    if(b.disabled)return;
    b.classList.add('selected');
    mode = b.dataset.mode;
  };
});

// 全鍵盤電競快捷鍵支援
window.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
    if (e.code === 'Enter' && !$('#intro').classList.contains('hidden')) start();
    return;
  }

  if (!$('#intro').classList.contains('hidden') && e.code === 'Enter') {
    e.preventDefault();
    start();
    return;
  }

  if (!$('#handoff').classList.contains('hidden') && (e.code === 'Space' || e.code === 'Enter')) {
    e.preventDefault();
    startReady();
    return;
  }

  if (!$('#end').classList.contains('hidden') && (e.code === 'Space' || e.code === 'Enter')) {
    e.preventDefault();
    reset();
    return;
  }

  if (!$('#game').classList.contains('hidden')) {
    const rollBtn = $('#roll');
    if (rollBtn && !rollBtn.disabled && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      roll();
      return;
    }
    const nextBtn = $('.nextButton');
    if (nextBtn && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      nextBtn.click();
      return;
    }
    const choices = [...document.querySelectorAll('.choice:not(:disabled)')];
    if (choices.length === 4) {
      const keyMap = {
        Digit1: 0, KeyA: 0, Numpad1: 0,
        Digit2: 1, KeyB: 1, Numpad2: 1,
        Digit3: 2, KeyC: 2, Numpad3: 2,
        Digit4: 3, KeyD: 3, Numpad4: 3
      };
      if (keyMap[e.code] !== undefined) {
        e.preventDefault();
        choices[keyMap[e.code]].click();
      }
    }
  }
});

makePlayerFields();
makePlayerFields();
bindPlayerInputs();
loadScores();
updateEndlessAvailability();




