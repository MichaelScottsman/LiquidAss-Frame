// Brick: the assPod's Breakout. The wheel slides the paddle (10 px per detent), the center button
// launches the ball, Play/Pause pauses and MENU leaves. Score, level and lives sit in a status-bar
// style strip at the top; glossy bricks and a blue paddle keep it in the 5G's look.
import { C, font } from '../os/theme.js';
import { SCREEN_W, SCREEN_H } from '../config.js';

// ---------------------------------------------------------------- layout (spec 6.5)
const W = SCREEN_W;
const H = SCREEN_H;
const TOP = 22;                       // the score strip occupies 0..22
const PADDLE_W = 40;
const PADDLE_H = 5;
const PADDLE_Y = 228;
const PADDLE_STEP = 10;
const BALL_R = 3;
const COLS = 8;
const ROWS = 5;
const BRICK_W = 36;
const BRICK_H = 10;
const GAP_X = 4;
const GAP_Y = 3;
const BRICKS_X = (W - (COLS * BRICK_W + (COLS - 1) * GAP_X)) / 2;
const BRICKS_Y = 40;
const ROW_COLORS = [['#ff6b6b', '#d62828'], ['#ffb05a', '#e8730c'], ['#ffe066', '#e0b400'], ['#7ddc6a', '#2f9e44'], ['#6fb6ff', '#1f62c9']];
const ROW_STOPS = ROW_COLORS.map(([light, dark]) => [[0, light], [1, dark]]);
const FIELD_STOPS = [[0, '#ffffff'], [1, '#dde3ea']];
const ROW_POINTS = [7, 5, 3, 2, 1];
const LIVES = 3;
const SPEED0 = 140;                   // px/s at level 1
const SUBSTEP = 1 / 240;              // fixed physics step, so a fast ball can't tunnel through a brick

const FONT_HUD = font(12, 600);
const FONT_LEVEL = font(14, 700);
const FONT_BIG = font(20, 700);
const FONT_HINT = font(12, 400);

// Brick layouts per level: 1 = brick, 2 = two-hit brick, 0 = empty.
const PATTERNS = [
  (r, c) => 1,
  (r, c) => (Math.abs(c - 3.5) <= r + 0.5 ? 1 : 0),
  (r, c) => ((r + c) % 2 ? 1 : r === 0 ? 2 : 0),
  (r, c) => (r === 0 || c === 0 || c === COLS - 1 ? 2 : 1),
];

// ---------------------------------------------------------------- game state (pure, testable)
export function createBrickGame() {
  const bricks = new Uint8Array(COLS * ROWS);
  const game = {
    state: 'ready',          // ready (ball on paddle) | playing | paused | dead (between lives) | over | cleared
    score: 0,
    level: 1,
    lives: LIVES,
    paddleX: (W - PADDLE_W) / 2,
    ballX: 0, ballY: 0, vx: 0, vy: 0,
    speed: SPEED0,
    bricks,
    broken: 0,
    hits: 0,
    effects: [],              // { x, y, color, t } brief shards where a brick broke
    timer: 0,
  };
  for (let i = 0; i < 8; i++) game.effects.push({ x: 0, y: 0, color: '', t: 1 });

  function layLevel() {
    const pat = PATTERNS[(game.level - 1) % PATTERNS.length];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bricks[r * COLS + c] = pat(r, c);
    game.speed = SPEED0 * (1 + 0.12 * (game.level - 1));
  }
  function remaining() {
    let n = 0;
    for (let i = 0; i < bricks.length; i++) if (bricks[i]) n++;
    return n;
  }
  function resetBall() {
    game.state = 'ready';
    game.ballX = game.paddleX + PADDLE_W / 2;
    game.ballY = PADDLE_Y - BALL_R - 0.5;
    game.vx = 0;
    game.vy = 0;
  }
  game.newGame = () => {
    game.score = 0;
    game.level = 1;
    game.lives = LIVES;
    game.broken = 0;
    layLevel();
    resetBall();
  };
  game.launch = () => {
    if (game.state !== 'ready') return false;
    // Launch slightly off vertical, toward the side the paddle has more room on.
    const a = -Math.PI / 2 + (game.paddleX + PADDLE_W / 2 < W / 2 ? 0.35 : -0.35);
    game.vx = Math.cos(a) * game.speed;
    game.vy = Math.sin(a) * game.speed;
    game.state = 'playing';
    return true;
  };
  game.movePaddle = (steps) => {
    const x = Math.max(0, Math.min(W - PADDLE_W, game.paddleX + steps * PADDLE_STEP));
    if (x === game.paddleX) return false;
    game.paddleX = x;
    if (game.state === 'ready') game.ballX = x + PADDLE_W / 2;
    return true;
  };
  function shard(x, y, color) {
    let e = game.effects[0];
    for (const f of game.effects) if (f.t > e.t) e = f;
    e.x = x; e.y = y; e.color = color; e.t = 0;
  }
  function hitBricks() {
    const c0 = Math.floor((game.ballX - BALL_R - BRICKS_X) / (BRICK_W + GAP_X));
    const r0 = Math.floor((game.ballY - BALL_R - BRICKS_Y) / (BRICK_H + GAP_Y));
    for (let r = r0; r <= r0 + 1; r++) {
      if (r < 0 || r >= ROWS) continue;
      for (let c = c0; c <= c0 + 1; c++) {
        if (c < 0 || c >= COLS) continue;
        const i = r * COLS + c;
        if (!bricks[i]) continue;
        const bx = BRICKS_X + c * (BRICK_W + GAP_X);
        const by = BRICKS_Y + r * (BRICK_H + GAP_Y);
        // Circle against box: nearest point on the box.
        const nx = Math.max(bx, Math.min(game.ballX, bx + BRICK_W));
        const ny = Math.max(by, Math.min(game.ballY, by + BRICK_H));
        const dx = game.ballX - nx;
        const dy = game.ballY - ny;
        if (dx * dx + dy * dy > BALL_R * BALL_R) continue;
        // Bounce off the face it came through: the axis of least penetration.
        const penX = Math.min(Math.abs(game.ballX + BALL_R - bx), Math.abs(bx + BRICK_W - (game.ballX - BALL_R)));
        const penY = Math.min(Math.abs(game.ballY + BALL_R - by), Math.abs(by + BRICK_H - (game.ballY - BALL_R)));
        if (penX < penY) game.vx = -game.vx; else game.vy = -game.vy;
        bricks[i]--;
        game.hits++;
        if (!bricks[i]) {
          game.score += ROW_POINTS[r] * game.level;
          game.broken++;
          shard(bx + BRICK_W / 2, by + BRICK_H / 2, ROW_COLORS[r][1]);
        }
        return true;
      }
    }
    return false;
  }
  function physics(dt) {
    game.ballX += game.vx * dt;
    game.ballY += game.vy * dt;
    if (game.ballX < BALL_R) { game.ballX = BALL_R; game.vx = Math.abs(game.vx); }
    if (game.ballX > W - BALL_R) { game.ballX = W - BALL_R; game.vx = -Math.abs(game.vx); }
    if (game.ballY < TOP + BALL_R) { game.ballY = TOP + BALL_R; game.vy = Math.abs(game.vy); }
    if (game.vy > 0 && game.ballY + BALL_R >= PADDLE_Y && game.ballY - BALL_R <= PADDLE_Y + PADDLE_H
      && game.ballX >= game.paddleX - BALL_R && game.ballX <= game.paddleX + PADDLE_W + BALL_R) {
      // Where it lands on the paddle sets the angle: the edges send it out at 60° from vertical.
      const off = Math.max(-1, Math.min(1, (game.ballX - (game.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2)));
      const a = -Math.PI / 2 + off * (Math.PI / 3);
      game.speed *= 1.01;
      game.vx = Math.cos(a) * game.speed;
      game.vy = Math.sin(a) * game.speed;
      game.ballY = PADDLE_Y - BALL_R;
    }
    if (game.vy < 0 || game.ballY < BRICKS_Y + ROWS * (BRICK_H + GAP_Y) + BALL_R) hitBricks();
    if (game.ballY - BALL_R > H) {
      game.lives--;
      game.state = game.lives > 0 ? 'dead' : 'over';
      game.timer = 0;
    } else if (!remaining()) {
      game.state = 'cleared';
      game.timer = 0;
    }
  }
  game.step = (dt) => {
    for (const e of game.effects) if (e.t < 1) e.t = Math.min(1, e.t + dt / 0.35);
    if (game.state === 'playing') {
      let left = dt;
      while (left > 0 && game.state === 'playing') {
        const h = Math.min(SUBSTEP, left);
        physics(h);
        left -= h;
      }
    } else if (game.state === 'dead' || game.state === 'cleared') {
      game.timer += dt;
      if (game.timer > 0.9) {
        if (game.state === 'cleared') { game.level++; layLevel(); }
        resetBall();
      }
    }
  };
  game.busy = () => game.state === 'playing' || game.state === 'dead' || game.state === 'cleared'
    || game.effects.some((e) => e.t < 1);
  game.newGame();
  return game;
}

// ---------------------------------------------------------------- screen
export function brick(ctx) {
  const { ui } = ctx;
  const game = createBrickGame();
  let last = 0;
  // HUD strings are rebuilt only when the numbers change, not every frame.
  let hudScore = -1;
  let hudLevel = -1;
  let scoreText = '';
  let levelText = '';

  function drawHud(g) {
    g.fillStyle = ui.gradient(g, 0, 0, 0, TOP - 1, C.status);
    g.fillRect(0, 0, W, TOP - 1);
    g.fillStyle = C.statusLine;
    g.fillRect(0, TOP - 1, W, 1);
    if (hudScore !== game.score) { hudScore = game.score; scoreText = `Score: ${hudScore}`; }
    if (hudLevel !== game.level) { hudLevel = game.level; levelText = `Level ${hudLevel}`; }
    g.textBaseline = 'alphabetic';
    g.font = FONT_HUD;
    g.textAlign = 'left';
    g.fillStyle = C.text;
    g.fillText(scoreText, 8, 16);
    g.font = FONT_LEVEL;
    g.textAlign = 'center';
    g.fillStyle = C.statusShadow;
    g.fillText(levelText, W / 2, 17);
    g.fillStyle = C.text;
    g.fillText(levelText, W / 2, 16);
    // Lives as little paddles, right-aligned where the battery usually is.
    for (let i = 0; i < game.lives; i++) {
      const x = W - 8 - (i + 1) * 16 + 2;
      g.fillStyle = ui.gradient(g, 0, 8, 0, 14, C.hi);
      g.fillRect(x, 8, 13, 5);
      g.fillStyle = C.hiBottom;
      g.fillRect(x, 12, 13, 1);
    }
  }

  function drawBrick(g, x, y, r, tough) {
    g.fillStyle = ui.gradient(g, 0, y, 0, y + BRICK_H, ROW_STOPS[r]);
    g.fillRect(x, y, BRICK_W, BRICK_H);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(x + 1, y + 1, BRICK_W - 2, 3);
    g.strokeStyle = tough ? '#333333' : 'rgba(0,0,0,0.25)';
    g.lineWidth = tough ? 1.5 : 1;
    g.strokeRect(x + 0.5, y + 0.5, BRICK_W - 1, BRICK_H - 1);
  }

  function drawBanner(g, line1, line2) {
    g.fillStyle = 'rgba(255,255,255,0.88)';
    g.fillRect(40, 132, 240, 50);
    g.strokeStyle = C.sbBorder;
    g.lineWidth = 1;
    g.strokeRect(40.5, 132.5, 239, 49);
    g.textAlign = 'center';
    g.fillStyle = C.text;
    g.font = FONT_BIG;
    g.fillText(line1, W / 2, 155);
    if (line2) {
      g.font = FONT_HINT;
      g.fillStyle = C.textDim;
      g.fillText(line2, W / 2, 172);
    }
  }

  const screen = {
    id: 'brick',
    title: 'Brick',
    fullscreen: true,
    _game: game,               // test hook

    enter() { last = 0; },
    resume() { last = 0; },
    animating() { return game.busy(); },
    highlight() { return { index: game.level, label: `Score ${game.score}` }; },

    handle(e) {
      if (e.type === 'scroll') {
        if (game.state === 'paused' || game.state === 'over') return false;
        return game.movePaddle(e.delta);
      }
      if (e.type === 'press' && e.part === 'select') {
        if (game.state === 'over') { game.newGame(); return true; }
        if (game.state === 'paused') { game.state = 'playing'; last = 0; return true; }
        if (game.launch()) { last = 0; return true; }
        return false;
      }
      if (e.type === 'press' && e.part === 'play') {
        if (game.state === 'playing') { game.state = 'paused'; return true; }
        if (game.state === 'paused') { game.state = 'playing'; last = 0; return true; }
        return false;
      }
      // Holding next/prev would scrub the music; leave those and MENU to the OS.
      return undefined;
    },

    draw(g, r, now) {
      let dt = last ? (now - last) / 1000 : 1 / 40;
      if (dt > 0.05) dt = 0.05;
      if (dt < 0) dt = 0;
      last = now;
      game.step(dt);

      g.save();
      g.translate(r.x, r.y);
      g.fillStyle = ui.gradient(g, 0, TOP, 0, H, FIELD_STOPS);
      g.fillRect(0, TOP, W, H - TOP);
      drawHud(g);
      for (let row = 0; row < ROWS; row++) {
        for (let c = 0; c < COLS; c++) {
          const v = game.bricks[row * COLS + c];
          if (v) drawBrick(g, BRICKS_X + c * (BRICK_W + GAP_X), BRICKS_Y + row * (BRICK_H + GAP_Y), row, v > 1);
        }
      }
      for (const e of game.effects) {
        if (e.t >= 1) continue;
        // Shards flying apart from where the brick was.
        g.globalAlpha = 1 - e.t;
        g.fillStyle = e.color;
        const d = 4 + e.t * 18;
        for (let k = 0; k < 6; k++) {
          const a = k * 1.047 + 0.4;
          g.fillRect(e.x + Math.cos(a) * d - 1.5, e.y + Math.sin(a) * d * 0.6 + e.t * 10 - 1.5, 3, 3);
        }
        g.globalAlpha = 1;
      }
      // Paddle: the 5G highlight gradient, rounded ends.
      g.fillStyle = ui.gradient(g, 0, PADDLE_Y, 0, PADDLE_Y + PADDLE_H, C.hi);
      g.beginPath();
      g.arc(game.paddleX + 2.5, PADDLE_Y + 2.5, 2.5, Math.PI / 2, Math.PI * 1.5);
      g.arc(game.paddleX + PADDLE_W - 2.5, PADDLE_Y + 2.5, 2.5, -Math.PI / 2, Math.PI / 2);
      g.closePath();
      g.fill();
      g.fillStyle = C.hiTop;
      g.fillRect(game.paddleX + 2, PADDLE_Y, PADDLE_W - 4, 1);
      if (game.state !== 'over' && game.ballY - BALL_R <= H) {
        g.fillStyle = '#222222';
        g.beginPath();
        g.arc(game.ballX, game.ballY, BALL_R, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.fillRect(game.ballX - 1.5, game.ballY - 1.5, 1.2, 1.2);
      }
      if (game.state === 'ready') drawBanner(g, game.broken || game.level > 1 ? `Level ${game.level}` : 'Brick', 'Press the center button to start');
      else if (game.state === 'paused') drawBanner(g, 'Paused', 'Press Play/Pause to continue');
      else if (game.state === 'over') drawBanner(g, 'Game Over', `Score ${game.score} · Press center to play again`);
      else if (game.state === 'cleared') drawBanner(g, 'Level Cleared!', '');
      g.restore();
    },
  };
  return screen;
}
