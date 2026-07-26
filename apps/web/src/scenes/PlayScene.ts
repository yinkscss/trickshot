import Phaser from "phaser";
import type { GameMode } from "@trickshot/shared";
import { layoutForSide, makeHoop } from "../game/layout";
import {
  beginDunkTransition,
  finishDunkTransition,
  mixRimCss,
  updateDunkTransition,
  type DunkTransition,
} from "../game/transition";
import {
  casualSeed,
  comboLabel,
  dailySeed,
  dunkScore,
  getLocalLeaderboard,
  recordLocalScore,
  buildRunSummary,
  shakeIntensity,
  STAR_POINTS,
  tournamentSeed,
} from "../meta";
import {
  BALL_RADIUS,
  MIN_SHOT,
  RIM_RX,
  RIM_RY,
  aimFrom,
  buildObstacles,
  collideObstacles,
  hypot,
  netPullForHoop,
  predictPath,
  rimHit,
  stepProjectile,
  throughHoop,
  type AimVector,
  type Hoop,
  type NetPull,
  type Obstacle,
  type Projectile,
  type Vec2,
} from "../physics";
import { MetaHud } from "../ui/metaHud";

const COURT = "#e8e8ea";
const ORANGE = "#ff4d1a";
const GREY = "#5f646e";
const BALL_FILL = 0x1e5fff;
const OBSTACLE_RED = 0xff3b30;
const STAR_GOLD = 0xffc14d;

type Mode = "menu" | "aim" | "flying" | "scored" | "transition" | "continue" | "summary";

/**
 * Pitch-parity core loop + Alpha meta: combo juice, continue stub,
 * daily seed, local leaderboard, RunSummary.
 */
export class PlayScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private hud!: MetaHud;

  private mode: Mode = "menu";
  private gameMode: GameMode = "casual";
  private seed = casualSeed("boot");
  /** Unbroken dunk count (layout / chain). */
  private dunks = 0;
  /** Soft score points. */
  private score = 0;
  private stars = 0;
  private continuesUsed = 0;
  private side = 1;

  private source: Hoop | null = null;
  private target: Hoop | null = null;
  private starPos: Vec2 | null = null;
  private starTaken = false;
  private obstacles: Obstacle[] = [];
  private transition: DunkTransition | null = null;
  private ball: Projectile = { x: 0, y: 0, vx: 0, vy: 0 };
  private aimOrigin: Vec2 = { x: 0, y: 0 };
  private aim: AimVector = { x: 0, y: 0, pull: 0 };

  private dragging = false;
  private dragPt: Vec2 | null = null;
  private showHint = true;
  private scoredAt = 0;

  private W = 390;
  private H = 780;

  constructor() {
    super("play");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COURT);
    this.gfx = this.add.graphics();
    this.scoreText = this.add
      .text(0, 0, "0", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontStyle: "900",
        color: "rgba(110,114,124,0.16)",
      })
      .setOrigin(0.5);
    this.hintText = this.add
      .text(0, 0, "DRAG IT!", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontStyle: "800",
        fontSize: "15px",
        color: "#9aa0aa",
      })
      .setOrigin(0.5);
    this.comboText = this.add
      .text(0, 0, "", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontStyle: "900",
        fontSize: "42px",
        color: "#ff5a1f",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const parent = (this.game.config.parent as HTMLElement | null) ?? document.body;
    this.hud = new MetaHud(parent, {
      onSelectMode: (m) => this.startMode(m),
      onContinueStub: () => this.applyContinueStub(),
      onEndRun: () => this.endRun(),
      onDismissSummary: () => this.backToMenu(),
      onPlayAgain: () => this.backToMenu(),
    });

    this.syncSize();
    this.hud.showModePicker();
    this.mode = "menu";

    this.input.on("pointerdown", this.onDown, this);
    this.input.on("pointermove", this.onMove, this);
    this.input.on("pointerup", this.onUp, this);
    this.input.on("pointerupoutside", this.onUp, this);
    this.scale.on("resize", this.onResize, this);
  }

  private onResize = (gameSize: Phaser.Structs.Size): void => {
    this.cameras.resize(gameSize.width, gameSize.height);
    const prevW = this.W;
    const prevH = this.H;
    this.syncSize();
    if (this.mode === "aim" && prevW > 0 && prevH > 0) {
      this.place(this.dunks, false);
    }
  };

  private syncSize(): void {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.scoreText.setFontSize(Math.floor(this.W * 0.38));
    this.scoreText.setPosition(this.W / 2, this.H * 0.22);
    this.comboText.setPosition(this.W / 2, this.H * 0.38);
  }

  private startMode(mode: GameMode): void {
    this.gameMode = mode;
    if (mode === "daily") this.seed = dailySeed();
    else if (mode === "tournament") this.seed = tournamentSeed(String(Date.now()));
    else this.seed = casualSeed(String(Date.now()));

    this.dunks = 0;
    this.score = 0;
    this.stars = 0;
    this.continuesUsed = 0;
    this.side = 1;
    this.showHint = true;
    this.scoreText.setText("0");
    this.hud.setModeLabel(mode);
    this.hud.setStars(0);
    this.hud.hideModePicker();
    this.hud.hideContinue();
    this.hud.hideSummary();
    this.place(0);
  }

  private backToMenu(): void {
    this.mode = "menu";
    this.dragging = false;
    this.source = null;
    this.target = null;
    this.obstacles = [];
    this.hud.hideContinue();
    this.hud.hideSummary();
    this.hud.showModePicker();
    this.scoreText.setText("0");
  }

  /** Hard snap (boot / continue / resize). Dunks use seamless transition. */
  private place(fromDunks: number, advanceSide = true): void {
    if (fromDunks === 0) this.side = 1;
    else if (advanceSide) this.side *= -1;

    const L = layoutForSide(this.side, fromDunks, this.W, this.H, this.seed);
    this.source = makeHoop(L.sx, L.sy, L.sourceAng);
    this.target = makeHoop(L.tx, L.ty, L.targetAng);
    this.starPos = { ...L.star };
    this.starTaken = false;
    this.obstacles = buildObstacles(
      L.sx,
      L.sy,
      L.tx,
      L.ty,
      fromDunks,
      this.W,
      this.seed,
    );
    this.ball.x = L.sx;
    this.ball.y = L.sy - 1;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.mode = "aim";
    this.aim = { x: 0, y: 0, pull: 0 };
    this.dragging = false;
    this.dragPt = null;
    this.scoredAt = 0;
    this.transition = null;
    this.aimOrigin = { x: L.sx, y: L.sy - 1 };
    this.hud.hideContinue();
  }

  private applyContinueStub(): void {
    if (this.mode !== "continue") return;
    if (this.gameMode === "tournament") return;
    this.continuesUsed += 1;
    this.hud.hideContinue();
    this.place(this.dunks, false);
  }

  private endRun(): void {
    const summary = buildRunSummary({
      mode: this.gameMode,
      chainLength: this.dunks,
      score: this.score,
      continuesUsed: this.continuesUsed,
      powerupsUsed: [],
      seed: this.seed,
    });
    let board =
      summary.mode === "casual" || summary.mode === "daily"
        ? recordLocalScore({
            score: summary.score,
            stars: this.stars,
            chainLength: summary.chainLength,
            mode: summary.mode,
            seed: summary.seed,
            at: new Date().toISOString(),
          })
        : [];
    if (summary.mode === "casual" || summary.mode === "daily") {
      board = getLocalLeaderboard(summary.mode);
    }
    this.mode = "summary";
    this.hud.hideContinue();
    this.hud.showSummary(summary, board);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.mode !== "aim" || !this.source) return;
    const p = { x: pointer.worldX, y: pointer.worldY };
    if (hypot(p.x - this.source.x, p.y - this.source.y) > 160) return;
    this.aimOrigin = { x: this.source.x, y: this.source.y - 1 };
    this.dragging = true;
    this.dragPt = p;
    this.aim = aimFrom(this.aimOrigin, p, this.W, this.H);
    this.showHint = false;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging || this.mode !== "aim") return;
    this.dragPt = { x: pointer.worldX, y: pointer.worldY };
    this.aim = aimFrom(this.aimOrigin, this.dragPt, this.W, this.H);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging || this.mode !== "aim") return;
    this.dragPt = { x: pointer.worldX, y: pointer.worldY };
    this.aim = aimFrom(this.aimOrigin, this.dragPt, this.W, this.H);
    this.dragging = false;

    if (hypot(this.aim.x, this.aim.y) < MIN_SHOT) {
      this.aim = { x: 0, y: 0, pull: 0 };
      if (this.dunks === 0) this.showHint = true;
      return;
    }

    this.ball.x = this.aimOrigin.x;
    this.ball.y = this.aimOrigin.y;
    this.ball.vx = this.aim.x;
    this.ball.vy = this.aim.y;
    this.mode = "flying";
    this.aim = { x: 0, y: 0, pull: 0 };
    this.dragPt = null;
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.033);

    if (this.mode === "menu" || this.mode === "summary") {
      this.gfx.clear();
      return;
    }

    if (this.mode === "transition" && this.transition) {
      const done = updateDunkTransition(this.transition, this.ball, dt);
      if (done) this.completeTransition();
      this.drawFrame();
      return;
    }

    if (this.source) this.source.wobble *= Math.pow(0.04, dt);
    if (this.target) this.target.wobble *= Math.pow(0.06, dt);

    if (this.mode === "aim" && this.source) {
      this.aimOrigin = { x: this.source.x, y: this.source.y - 1 };
      this.ball.x = this.aimOrigin.x;
      this.ball.y =
        this.aimOrigin.y + (this.dragging ? 0 : Math.sin(_time / 260) * 1.2);
    }

    if (this.mode === "scored" && this.target) {
      this.ball.x = this.target.x;
      this.ball.y = this.target.y - 1 + Math.sin(_time / 120) * 0.8;
      if (_time - this.scoredAt > 180) {
        this.startTransition();
      }
    }

    if (this.mode === "flying") {
      stepProjectile(this.ball, dt, this.W);
      if (this.source) rimHit(this.source, this.ball);
      if (this.target) rimHit(this.target, this.ball);
      collideObstacles(this.obstacles, this.ball, dt);
      this.tryCollectStar();

      if (this.target && throughHoop(this.target, this.ball)) {
        this.onScore(_time);
      } else if (
        this.ball.y > this.H + 90 ||
        this.ball.x < -120 ||
        this.ball.x > this.W + 120
      ) {
        this.onMiss();
      }
    }

    this.drawFrame();
  }

  private tryCollectStar(): void {
    if (this.starTaken || !this.starPos) return;
    if (hypot(this.ball.x - this.starPos.x, this.ball.y - this.starPos.y) < 28) {
      this.starTaken = true;
      this.stars += 1;
      this.score += STAR_POINTS;
      this.hud.setStars(this.stars);
      this.scoreText.setText(String(this.score));
    }
  }

  private onScore(time: number): void {
    if (this.scoredAt || !this.target || this.mode === "transition") return;
    this.scoredAt = time;
    this.dunks += 1;
    this.score += dunkScore(this.dunks);
    this.target.wobble = 1.5;
    this.ball.x = this.target.x;
    this.ball.y = this.target.y - 1;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.mode = "scored";
    this.scoreText.setText(String(this.score));
    this.popupCombo(this.dunks);
    this.cameras.main.shake(160, shakeIntensity(this.dunks));
  }

  private popupCombo(chain: number): void {
    const label = comboLabel(chain);
    if (!label) {
      this.comboText.setAlpha(0);
      return;
    }
    this.comboText.setText(label);
    this.comboText.setAlpha(1);
    this.comboText.setScale(label === "ON FIRE" ? 1.15 : 1);
    this.tweens.add({
      targets: this.comboText,
      alpha: 0,
      scale: 1.35,
      duration: 700,
      ease: "Cubic.easeOut",
    });
  }

  private onMiss(): void {
    this.mode = "continue";
    this.dragging = false;
    this.dragPt = null;
    this.hud.showContinue({
      mode: this.gameMode,
      score: this.score,
      stars: this.stars,
      chainLength: this.dunks,
    });
  }

  private startTransition(): void {
    if (!this.source || !this.target || this.mode === "transition") return;
    const { side, transition } = beginDunkTransition({
      side: this.side,
      score: this.dunks,
      width: this.W,
      height: this.H,
      source: this.source,
      target: this.target,
      obstacles: this.obstacles,
      seed: this.seed,
    });
    this.side = side;
    this.transition = transition;
    this.source = null;
    this.target = null;
    this.starPos = null;
    this.obstacles = [];
    this.mode = "transition";
    this.dragging = false;
    this.dragPt = null;
  }

  private completeTransition(): void {
    if (!this.transition) return;
    const next = finishDunkTransition(this.transition);
    this.source = next.source;
    this.target = next.target;
    this.obstacles = next.obstacles;
    this.ball = next.ball;
    this.aimOrigin = next.aimOrigin;
    const L = layoutForSide(this.side, this.dunks, this.W, this.H, this.seed);
    this.starPos = { ...L.star };
    this.starTaken = false;
    this.transition = null;
    this.mode = "aim";
    this.aim = { x: 0, y: 0, pull: 0 };
    this.dragging = false;
    this.dragPt = null;
    this.scoredAt = 0;
  }

  private drawFrame(): void {
    const g = this.gfx;
    g.clear();

    g.fillStyle(0x5a606e, 0.14);
    g.fillRect(0, 0, 14, this.H);
    g.fillRect(this.W - 14, 0, 14, this.H);

    if (this.mode === "transition" && this.transition) {
      this.drawTransition(g, this.transition);
    } else {
      this.drawObstacles(g, this.obstacles, 1);
      if (this.target) this.drawHoop(g, this.target, ORANGE, null);
      if (this.source) {
        const pull =
          this.mode === "aim" && this.dragging
            ? netPullForHoop(
                this.source,
                this.dragPt,
                this.dragging,
                this.W,
                this.H,
              )
            : null;
        this.drawHoop(g, this.source, GREY, pull);
      }
    }

    if (this.starPos && !this.starTaken && this.mode !== "transition") {
      this.drawStar(g, this.starPos.x, this.starPos.y);
    }

    if (this.mode === "aim" && this.dragging) {
      this.drawAimDots(g);
    }

    this.drawBall(g, this.ball.x, this.ball.y);

    this.hintText.setVisible(
      this.showHint && this.mode === "aim" && !this.dragging && !!this.source,
    );
    if (this.source && this.hintText.visible) {
      this.hintText.setPosition(
        this.source.x,
        this.source.y + 62 + Math.sin(this.time.now / 220) * 6,
      );
    }
  }

  private drawStar(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const pulse = 1 + Math.sin(this.time.now / 160) * 0.08;
    g.fillStyle(STAR_GOLD, 1);
    g.fillCircle(x, y, 9 * pulse);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(x - 2, y - 2, 3);
  }

  private drawTransition(g: Phaser.GameObjects.Graphics, tr: DunkTransition): void {
    if (tr.oldObstacles.length && tr.leave) {
      const fade = tr.leave.a ?? 1;
      this.drawObstacles(g, tr.oldObstacles, fade);
    }
    if (tr.nextObstacles.length && tr.arrive) {
      const fade = tr.arrive.a ?? 1;
      this.drawObstacles(g, tr.nextObstacles, fade * 0.85);
    }
    if (tr.leave) {
      const h = makeHoop(tr.leave.x, tr.leave.y, tr.leave.ang);
      h.wobble = tr.leave.wobble;
      this.drawHoop(g, h, GREY, null, tr.leave.a ?? 1);
    }
    if (tr.arrive) {
      const h = makeHoop(tr.arrive.x, tr.arrive.y, tr.arrive.ang);
      h.wobble = tr.arrive.wobble;
      this.drawHoop(g, h, ORANGE, null, tr.arrive.a ?? 1);
    }
    if (tr.carry) {
      const h = makeHoop(tr.carry.x, tr.carry.y, tr.carry.ang);
      h.wobble = tr.carry.wobble;
      const color = mixRimCss(tr.carry.colorT ?? 0);
      this.drawHoop(g, h, color, null, 1);
    }
  }

  private drawObstacles(
    g: Phaser.GameObjects.Graphics,
    list: Obstacle[],
    alpha: number,
  ): void {
    for (const o of list) {
      if (o.type === "wall") {
        g.lineStyle(o.w, OBSTACLE_RED, alpha);
        g.beginPath();
        g.moveTo(o.x, o.y - o.h / 2);
        g.lineTo(o.x, o.y + o.h / 2);
        g.strokePath();
        g.lineStyle(o.w * 0.35, 0xffffff, 0.25 * alpha);
        g.beginPath();
        g.moveTo(o.x, o.y - o.h / 2);
        g.lineTo(o.x, o.y + o.h / 2);
        g.strokePath();
      } else if (o.type === "bumper") {
        const p =
          1 +
          Math.sin(this.time.now / 180) * 0.04 +
          (o.pulse || 0) * 0.15;
        g.fillStyle(OBSTACLE_RED, alpha);
        g.fillCircle(o.x, o.y, o.r * p);
        g.fillStyle(0xffffff, alpha);
        g.fillCircle(o.x, o.y, o.r * 0.45 * p);
        g.fillStyle(0xffffff, 0.35 * alpha);
        g.fillCircle(o.x - o.r * 0.25, o.y - o.r * 0.25, o.r * 0.18);
      }
    }
  }

  private drawAimDots(g: Phaser.GameObjects.Graphics): void {
    const dots = predictPath(
      this.aimOrigin,
      this.aim.x,
      this.aim.y,
      this.W,
      this.H,
    );
    for (const d of dots) {
      const r = d.bounced ? 4.2 : 2.4 + 2.0 * d.fade;
      if (d.bounced) g.fillStyle(0x4ecbff, 0.95 * d.fade);
      else g.fillStyle(0xff4d1a, 0.95 * d.fade);
      g.fillCircle(d.x, d.y, r);
    }
  }

  private drawBall(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(BALL_FILL, 1);
    g.fillCircle(x, y, BALL_RADIUS);
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(
      x - BALL_RADIUS * 0.3,
      y - BALL_RADIUS * 0.35,
      BALL_RADIUS * 0.55,
      BALL_RADIUS * 0.32,
    );
  }

  private hoopToWorld(h: Hoop, tipAng: number, lx: number, ly: number): Vec2 {
    const c = Math.cos(tipAng);
    const s = Math.sin(tipAng);
    return {
      x: h.x + lx * c - ly * s,
      y: h.y + lx * s + ly * c,
    };
  }

  private strokeEllipseWorld(
    g: Phaser.GameObjects.Graphics,
    h: Hoop,
    tipAng: number,
    rx: number,
    ry: number,
    color: number,
    width: number,
    alpha: number,
  ): void {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const p = this.hoopToWorld(h, tipAng, Math.cos(t) * rx, Math.sin(t) * ry);
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.closePath();
    g.strokePath();
  }

  private cssToColor(colorCss: string): number {
    if (colorCss.startsWith("rgb")) {
      const m = colorCss.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (m) {
        return (
          (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3])
        );
      }
    }
    return Phaser.Display.Color.HexStringToColor(colorCss).color;
  }

  private drawHoop(
    g: Phaser.GameObjects.Graphics,
    h: Hoop,
    colorCss: string,
    pull: NetPull | null,
    alpha = 1,
  ): void {
    const color = this.cssToColor(colorCss);
    const p = pull ?? { lx: 0, ly: 0, amt: 0 };
    const tip = p.amt * 0.22;
    const tipAng = h.ang + Math.atan2(p.lx, 40) * tip;

    const shadow = this.hoopToWorld(
      h,
      tipAng,
      2 + p.lx * p.amt * 0.04,
      10 + p.ly * p.amt * 0.04,
    );
    g.fillStyle(0x000000, 0.08 * alpha);
    g.fillEllipse(shadow.x, shadow.y, RIM_RX * 1.9, RIM_RY * 2.2);

    this.drawWovenNet(g, h, tipAng, h.wobble || 0, p, alpha);

    this.strokeEllipseWorld(g, h, tipAng, RIM_RX, RIM_RY, color, 8, alpha);
    this.strokeEllipseWorld(
      g,
      h,
      tipAng,
      RIM_RX - 3.5,
      RIM_RY - 2.2,
      0x000000,
      2,
      0.18 * alpha,
    );
  }

  private drawWovenNet(
    g: Phaser.GameObjects.Graphics,
    h: Hoop,
    tipAng: number,
    wob: number,
    pull: NetPull,
    alpha = 1,
  ): void {
    const amt = pull.amt || 0;
    const depth = 52 + wob * 16 + amt * 28;
    const attachY = RIM_RY * 0.35;
    const topW = RIM_RX * 0.92;
    const botW = RIM_RX * (0.28 - amt * 0.06);
    const cols = 8;
    const rows = 5;
    const yankX = (pull.lx || 0) * 0.55;
    const yankY = (pull.ly || 0) * 0.55;

    const pt = (i: number, j: number): Vec2 => {
      const u = i / (cols - 1);
      const v = j / rows;
      const spread = topW + (botW - topW) * v;
      let x = -spread + u * spread * 2;
      let y = attachY + v * depth + wob * v * 8;
      const belly = Math.sin(u * Math.PI) * (4 + v * 6);
      x *= 1 - v * 0.04;
      y += belly * 0.15;
      const falloff = v * v * amt;
      x += yankX * falloff;
      y += yankY * falloff;
      x *= 1 - falloff * 0.12;
      return this.hoopToWorld(h, tipAng, x, y);
    };

    g.fillStyle(0xffffff, (0.2 + amt * 0.12) * alpha);
    g.beginPath();
    const p00 = pt(0, 0);
    g.moveTo(p00.x, p00.y);
    for (let i = 1; i < cols; i++) {
      const q = pt(i, 0);
      g.lineTo(q.x, q.y);
    }
    const pbr = pt(cols - 1, rows);
    const pbl = pt(0, rows);
    g.lineTo(pbr.x, pbr.y);
    g.lineTo(pbl.x, pbl.y);
    g.closePath();
    g.fillPath();

    g.lineStyle(2.3, 0xffffff, 0.98 * alpha);
    for (let i = 0; i < cols; i++) {
      g.beginPath();
      const a = pt(i, 0);
      g.moveTo(a.x, a.y);
      for (let j = 1; j <= rows; j++) {
        const q = pt(i, j);
        g.lineTo(q.x, q.y);
      }
      g.strokePath();
    }

    g.lineStyle(2.05, 0xffffff, 0.98 * alpha);
    for (let j = 1; j <= rows; j++) {
      g.beginPath();
      for (let i = 0; i < cols; i++) {
        const q = pt(i, j);
        if (i === 0) g.moveTo(q.x, q.y);
        else g.lineTo(q.x, q.y);
      }
      g.strokePath();
    }

    g.lineStyle(1.7, 0xffffff, 0.9 * alpha);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = pt(i, j);
        const b = pt(i + 1, j + 1);
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.strokePath();
        const c = pt(i + 1, j);
        const d = pt(i, j + 1);
        g.beginPath();
        g.moveTo(c.x, c.y);
        g.lineTo(d.x, d.y);
        g.strokePath();
      }
    }
  }
}
