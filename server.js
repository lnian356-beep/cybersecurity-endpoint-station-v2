const http = require('http'),
  fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  { DatabaseSync } = require('node:sqlite');
const { topicForCategory, titlesForStats } = require('./titles.js');

const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, 'scores.sqlite'));
const endlessQuestions = require('./endless-questions.js');
const questionBank = require('./questions.js');
db.exec(
  'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS results(id INTEGER PRIMARY KEY, game_id TEXT, player_name TEXT, difficulty TEXT, correct INTEGER, total INTEGER, coins INTEGER, elapsed INTEGER, created_at TEXT); CREATE TABLE IF NOT EXISTS unlocks(player_name TEXT PRIMARY KEY, cleared_at TEXT); CREATE TABLE IF NOT EXISTS question_history(id INTEGER PRIMARY KEY, game_id TEXT, player_name TEXT, question_id TEXT, category TEXT, is_correct INTEGER, created_at TEXT); CREATE INDEX IF NOT EXISTS question_history_recent ON question_history(player_name,id DESC); CREATE TABLE IF NOT EXISTS topic_stats(player_name TEXT, topic TEXT, correct INTEGER NOT NULL DEFAULT 0, attempted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(player_name,topic))'
);
const save = db.prepare(
  'INSERT INTO results(game_id,player_name,difficulty,correct,total,coins,elapsed,created_at) VALUES(?,?,?,?,?,?,?,?)'
);
const unlockOne = db.prepare('INSERT OR REPLACE INTO unlocks(player_name,cleared_at) VALUES(?,?)');
const hasUnlock = db.prepare("SELECT 1 FROM unlocks WHERE player_name = ? UNION ALL SELECT 1 FROM results WHERE player_name = ? AND difficulty = 'GAY炮' AND correct >= 3 LIMIT 1");
const rank = db.prepare(
  'SELECT player_name AS name,difficulty,correct,total,coins,elapsed,created_at FROM results ORDER BY correct DESC,coins DESC,elapsed ASC LIMIT 10'
);
const recentQuestions = db.prepare('SELECT question_id FROM question_history WHERE player_name=? ORDER BY id DESC LIMIT 50');
const rememberQuestion = db.prepare('INSERT INTO question_history(game_id,player_name,question_id,category,is_correct,created_at) VALUES(?,?,?,?,NULL,?)');
const answerQuestion = db.prepare('UPDATE question_history SET is_correct=? WHERE id=(SELECT MAX(id) FROM question_history WHERE game_id=? AND player_name=? AND question_id=?)');
const updateTopicStat = db.prepare('INSERT INTO topic_stats(player_name,topic,correct,attempted) VALUES(?,?,?,1) ON CONFLICT(player_name,topic) DO UPDATE SET correct=correct+excluded.correct,attempted=attempted+1');
const readTopicStats = db.prepare('SELECT topic,correct,attempted FROM topic_stats WHERE player_name=?');

function titlesForPlayer(name) {
  const stats = Object.fromEntries(readTopicStats.all(name).map(row => [row.topic, row.correct]));
  return titlesForStats(stats);
}

function normalDeck(names) {
  const seen = new Set(names.flatMap(name => recentQuestions.all(name).map(row => row.question_id)));
  const fresh = shuffled(questionBank.filter(question => !seen.has(question.id)));
  const rest = shuffled(questionBank.filter(question => seen.has(question.id)));
  return [...fresh, ...rest].slice(0, 10).map(shuffledQuestion);
}

const T = [
  ['出發', 'start'], ['實體訊號', 'normal'], ['機會｜快線', 'chance'], ['區域網路', 'normal'],
  ['命運｜繞路', 'fate'], ['IP 路由', 'normal'], ['機會｜TCP', 'chance'], ['連接埠', 'normal'],
  ['命運｜TTL', 'fate'], ['交換器', 'normal'], ['機會｜DNS', 'chance'], ['封包轉運', 'normal'],
  ['命運｜路由', 'fate'], ['應用層', 'normal'], ['機會｜Wi-Fi', 'chance'], ['回到出發', 'start']
].map(a => ({ name: a[0], type: a[1] }));

const modes = {
  beginner: { name: '入門', seconds: 30, good: 150, bad: 0 },
  normal: { name: '普通', seconds: 20, good: 200, bad: 80 },
  hard: { name: '困難', seconds: 12, good: 300, bad: 150 },
  gay: { name: 'GAY炮', seconds: 8, good: 500, bad: 250 }
};

const games = new Map();
const recentBoards = [];

function send(r, n, d, type = 'application/json; charset=utf-8') {
  r.writeHead(n, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  r.end(type.startsWith('application/json') ? JSON.stringify(d) : d);
}

function read(q) {
  return new Promise((ok, no) => {
    let s = '';
    q.on('data', c => { s += c; if (s.length > 12000) no(Error()); });
    q.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { no(Error()); } });
  });
}

function shuffled(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    let j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeBoard() {
  let tiles, key;
  do {
    tiles = [T[0], ...shuffled(T.slice(1, -1)), T[T.length - 1]];
    key = tiles.map(tile => tile.name).join('|');
  } while (recentBoards.includes(key));
  recentBoards.unshift(key);
  if (recentBoards.length > 50) recentBoards.pop();
  return tiles;
}

function shuffledQuestion(question) {
  const order = shuffled(question.options.map((_, index) => index));
  return {
    ...question,
    options: order.map(index => question.options[index]),
    answer: order.indexOf(question.answer)
  };
}

function pub(g) {
  const players = g.players.map(p => {
    const basic = { name: p.name, correct: p.correct, coins: p.coins, hp: p.hp, position: p.pos, turns: p.turns };
    if (!g.done) return basic;
    const titles = titlesForPlayer(p.name);
    const oldTitles = new Set(g.titleBaseline?.[p.name] || []);
    const bestTitle = titles.reduce((best, title) => !best || title.level > best.level ? title : best, null);
    return { ...basic, titleCount: titles.length, bestTitle: bestTitle?.name || '新手上路', newTitles: titles.filter(title => !oldTitles.has(title.id)).map(title => title.name), unlockedTitles: titles.map(title => title.name) };
  });
  return {
    id: g.id,
    difficulty: g.isEndless ? '無盡' : g.mode.name,
    endless: !!g.isEndless,
    deckRemaining: g.isEndless ? g.deck.length - g.deckIndex : null,
    timeLimit: g.mode.seconds,
    round: g.turn,
    totalRounds: g.isEndless ? null : 10,
    finished: g.done,
    handoff: g.handoff,
    players,
    currentPlayer: {
      name: g.players[g.current].name,
      correct: g.players[g.current].correct,
      coins: g.players[g.current].coins,
      position: g.players[g.current].pos,
      hp: g.players[g.current].hp,
      index: g.current
    },
    tiles: g.tiles,
    pending: g.pending ? { id: g.pending.id, category: g.pending.category, question: g.pending.question, options: g.pending.options, event: g.pending.event || null, timeLimit: g.pending.timeLimit || g.mode.seconds } : null,
    review: g.done ? g.review : null
  };
}

function record(g) {
  if (g.isEndless) {
    let elapsed = Math.max(1, Math.round((Date.now() - g.started) / 1000));
    g.players.forEach(p => save.run(g.id, p.name, '無盡模式', p.correct, p.turns, p.hp, elapsed, new Date().toISOString()));
    return;
  }
  let elapsed = Math.max(1, Math.round((Date.now() - g.started) / 1000));
  g.players.forEach(p => {
    save.run(g.id, p.name, g.mode.name, p.correct, p.turns, p.coins, elapsed, new Date().toISOString());
    if (g.mode.name === 'GAY炮' && p.correct >= 3) unlockOne.run(p.name, new Date().toISOString());
  });
}

const server = http.createServer(async (q, r) => {
  try {
    let u = new URL(q.url, 'http://localhost');
    if (q.method === 'GET' && u.pathname === '/api/scores') return send(r, 200, { scores: rank.all() });
    if (q.method === 'GET' && u.pathname === '/api/unlocks') {
      const names = String(u.searchParams.get('names') || '').split('|').map(x => x.trim().slice(0,12)).filter(Boolean);
      return send(r, 200, { unlocked: names.length === 2 && names.every(n => !!hasUnlock.get(n,n)), names: names.map(name => ({ name, unlocked: !!hasUnlock.get(name,name) })) });
    }
    const staticFiles = { '/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' };
    if (q.method === 'GET' && Object.prototype.hasOwnProperty.call(staticFiles, u.pathname)) {
      let f = path.join(__dirname, staticFiles[u.pathname]);
      if (!fs.existsSync(f)) return send(r, 404, { error: '檔案不存在' });
      return send(r, 200, fs.readFileSync(f, 'utf8'), u.pathname.endsWith('.js') ? 'text/javascript; charset=utf-8' : u.pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
    }
    if (q.method !== 'POST') return send(r, 404, { error: '找不到頁面' });
    let b = await read(q);

    if (u.pathname === '/api/start') {
      let names = Array.isArray(b.players) ? b.players.slice(0, 4) : [];
      names = names.map(x => String(x || '').trim().slice(0, 12)).filter(Boolean);
      if (names.length < 2) return send(r, 400, { error: '至少要輸入兩位玩家名稱。' });
      const isEndless = b.difficulty === 'endless';
      if (isEndless && names.length !== 2) return send(r, 400, { error: '無盡模式是雙人對戰，請只留兩位玩家。' });
      if (isEndless && names[0] === names[1]) return send(r, 400, { error: '兩位玩家請使用不同名稱。' });
      if (isEndless && names.some(name => !hasUnlock.get(name,name))) return send(r, 403, { error: '兩位玩家都要先以 GAY炮 難度答對至少 3 題，才能解鎖無盡模式。' });
      let mode = isEndless ? { name: '無盡', seconds: 30, good: 0, bad: 0 } : (modes[b.difficulty] || modes.normal);
      let g = {
        id: crypto.randomUUID(),
        mode,
        isEndless,
        tiles: makeBoard(),
        players: names.map(name => ({ name, correct: 0, coins: 1200, hp: isEndless ? 30 : null, pos: 0, turns: 0 })),
        current: 0,
        turn: 0,
        done: false,
        handoff: false,
        pending: null,
        review: [],
        titleBaseline: Object.fromEntries(names.map(name => [name, titlesForPlayer(name).map(title => title.id)])),
        deck: isEndless ? shuffled(endlessQuestions) : normalDeck(names),
        deckIndex: 0,
        started: Date.now()
      };
      games.set(g.id, g);
      return send(r, 201, pub(g));
    }

    let g = games.get(String(b.gameId || ''));
    if (!g) return send(r, 404, { error: '這場遊戲已結束，請重新開始。' });

    if (u.pathname === '/api/ready') {
      if (g.done || !g.handoff) return send(r, 409, { error: '現在不需要交接。' });
      g.handoff = false;
      return send(r, 200, pub(g));
    }

    if (u.pathname === '/api/roll') {
      if (g.done || g.handoff || g.pending) return send(r, 409, { error: '先完成目前回合。' });
      let p = g.players[g.current], d = crypto.randomInt(1, 7);
      p.pos = (p.pos + d) % g.tiles.length;
      g.turn++;
      const tile = g.tiles[p.pos];
      let question;
      if (g.isEndless) {
        if (g.deckIndex >= g.deck.length) { g.deck = shuffled(endlessQuestions); g.deckIndex = 0; }
        question = g.deck[g.deckIndex++];
      } else question = g.deck[g.turn - 1];
      let event = null;
      if (!g.isEndless && crypto.randomInt(100) < (['chance','fate'].includes(tile.type) ? 48 : 16)) {
        const events = [
          { title: '臨時事件｜封包加速', text: '網路狀況突然變好，這題答對額外 +100 網路幣。', bonus: 100 },
          { title: '臨時事件｜路由繞遠', text: '路由多繞了一站，這題答錯會多扣 50 網路幣。', penalty: 50 },
          { title: '臨時事件｜值班支援', text: '隊友傳來提示，答對額外 +150 網路幣。', bonus: 150 },
          { title: '臨時事件｜連線不穩', text: '訊號忽強忽弱，答題時間少 5 秒。', timePenalty: 5 }
        ];
        event = events[crypto.randomInt(events.length)];
      }
      g.pending = { ...question, event, tile: p.pos, started: Date.now(), timeLimit: event?.timePenalty ? Math.max(5, g.mode.seconds - event.timePenalty) : g.mode.seconds };
      if (!g.isEndless && g.pending.id) {
        const seenAt = new Date().toISOString();
        g.players.forEach(player => rememberQuestion.run(g.id, player.name, g.pending.id, g.pending.category, seenAt));
      }
      return send(r, 200, { ...pub(g), lastRoll: d, tile, pending: { id: g.pending.id, category: g.pending.category, question: g.pending.question, options: g.pending.options, event, timeLimit: g.pending.timeLimit } });
    }

    if (u.pathname === '/api/answer') {
      if (!g.pending) return send(r, 409, { error: '現在沒有題目。' });
      let p = g.players[g.current],
        elapsed = Date.now() - g.pending.started,
        timedOut = elapsed > (g.pending.timeLimit || g.mode.seconds) * 1000,
        c = Number(b.choice),
        valid = Number.isInteger(c) && c >= -1 && c < 4,
        yes = !timedOut && valid && c === g.pending.answer;

      if (g.isEndless) {
        if (yes) { p.correct++; g.players[(g.current + 1) % 2].hp = Math.max(0, g.players[(g.current + 1) % 2].hp - 3); }
        else p.hp = Math.max(0, p.hp - (timedOut ? 3 : 2));
      } else {
        if (!yes) p.coins = Math.max(0, p.coins - g.mode.bad - (g.pending.event?.penalty || 0));
        else { p.correct++; p.coins += g.mode.good + (g.pending.event?.bonus || 0); }
      }

      if (!g.isEndless) {
        const topic = topicForCategory(g.pending.category);
        if (topic) updateTopicStat.run(p.name, topic, yes ? 1 : 0);
        answerQuestion.run(yes ? 1 : 0, g.id, p.name, g.pending.id);
      }
      g.review.push({
        player: p.name,
        category: g.pending.category,
        question: g.pending.question,
        options: g.pending.options,
        answer: g.pending.answer,
        choice: valid && !timedOut ? c : -1,
        correct: yes,
        timedOut,
        explanation: g.pending.why
      });

      let result = { correct: yes, timedOut, answer: g.pending.answer, explanation: g.pending.why, coinsChange: g.isEndless ? 0 : (yes ? g.mode.good + (g.pending.event?.bonus || 0) : -(g.mode.bad + (g.pending.event?.penalty || 0))), damage: g.isEndless ? (yes ? 3 : timedOut ? 3 : 2) : 0, event: g.pending.event || null };
      g.pending = null;
      p.turns++;

      if (g.isEndless && g.players.some(player => player.hp <= 0)) {
        g.done = true;
        g.winner = g.players.find(player => player.hp > 0)?.name || null;
        record(g);
      } else if (!g.isEndless && g.turn >= 10) {
        g.done = true;
        record(g);
      } else {
        g.current = (g.current + 1) % g.players.length;
        g.handoff = true;
      }
      return send(r, 200, { ...pub(g), winner: g.winner || null, result });
    }

    return send(r, 404, { error: '找不到頁面' });
  } catch (e) {
    console.error(e.stack || e);
    send(r, 500, { error: '伺服器發生錯誤' });
  }
});

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, '127.0.0.1', () => console.log('資安終點站已啟動：http://127.0.0.1:' + PORT));

