import Phaser from "phaser";
import {
  RunFSM,
  allowsContinue,
  dailySeedFromUtcDate,
  generateShotLayout,
  type PhysicsIntent,
} from "@trickshot/logic";
import { makeHoop } from "../game/layout";
import {
  beginDunkTransition,
  finishDunkTransition,
  mixRimCss,
  updateDunkTransition,
  type DunkTransition,
} from "../game/transition";
import {
  BALL_RADIUS,
  MIN_SHOT,
  RIM_RX,
  RIM_RY,
  aimFrom,
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

const COURT = "#e8e8ea";
const ORANGE = "#ff4d1a";
const GREY = "#5f646e";
const BALL_FILL = 0x1e5fff;
const OBSTACLE_RED = 0xff3b30;

/**
 * Pitch-parity core loop: zigzag climb, one obstacle per shot,
 * seamless dunk→next-loop handoff (no hard teleport).
 */
export class PlayScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private continueText!: Phaser.GameObjects.Text;

  private readonly runFsm = new RunFSM("casual");
  private readonly runSeed =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `casual-${Date.now()}`;
  private score = 0;
  private side = 1;

  private source: Hoop | null = null;
  private target: Hoop | null = null;
  private obstacles: Obstacle[] = [];
  private transition: DunkTransition | null = null;
  private ball: Projectile = { x: 0, y: 0, vx: 0, vy: 0 };
  private aimOrigin: Vec2 = { x: 0, y: 0 };
  private aim: AimVector = { x: 0, y: 0, pull: 0 };

  private dragging = false;
  private dragPt: Vec2 | null = null;
  private showHint = true;

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
    this.continueText = this.add
      .text(0, 0, "TAP TO RETRY", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontStyle: "800",
        fontSize: "18px",
        color: "#5f646e",
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.syncSize();
    this.applyRunResult(this.runFsm.dispatch({ type: "bootComplete" }));

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
    if (this.runFsm.runState === "aiming" && prevW > 0 && prevH > 0) {
      this.place(this.runFsm.state.score, false);
    }
  };

  private syncSize(): void {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.scoreText.setFontSize(Math.floor(this.W * 0.38));
    this.scoreText.setPosition(this.W / 2, this.H * 0.22);
    this.continueText.setPosition(this.W / 2, this.H * 0.55);
  }

  /** Hard snap (boot / continue / resize). Dunks use seamless transition. */
  private place(fromScore: number, advanceSide = true): void {
    if (fromScore === 0) this.side = 1;
    else if (advanceSide) this.side *= -1;

    const mode = this.runFsm.state.mode;
    const seed =
      mode === "daily" ? dailySeedFromUtcDate() : this.runSeed;
    const L = generateShotLayout({
      side: this.side as -1 | 1,
      score: fromScore,
      seed,
      mode,
      width: this.W,
      height: this.H,
    });
    this.source = makeHoop(L.source.x, L.source.y, L.source.ang);
    this.target = makeHoop(L.goal.x, L.goal.y, L.goal.ang);
    this.obstacles = L.obstacles.map((o) => ({ ...o }));
    this.ball.x = L.source.x;
    this.ball.y = L.source.y - 1;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.aim = { x: 0, y: 0, pull: 0 };
    this.dragging = false;
    this.dragPt = null;
    this.transition = null;
    this.aimOrigin = { x: L.source.x, y: L.source.y - 1 };
    this.continueText.setVisible(false);
  }

  private applyRunResult(result: {
    accepted: boolean;
    intents: PhysicsIntent[];
  }): void {
    for (const intent of result.intents) {
      switch (intent.type) {
        case "startFlight":
          this.ball.x = intent.x;
          this.ball.y = intent.y;
          this.ball.vx = intent.vx;
          this.ball.vy = intent.vy;
          break;
        case "stopBall":
          this.ball.vx = 0;
          this.ball.vy = 0;
          break;
        case "seatBallAtHoop":
          if (this.target) {
            this.target.wobble = 1.5;
            this.ball.x = this.target.x;
            this.ball.y = this.target.y - 1;
          }
          break;
        case "beginDunkTransition":
          this.startTransition();
          break;
        case "completeDunkTransition":
          this.completeTransition();
          break;
        case "placeRun":
          this.place(intent.score, intent.advanceSide);
          break;
        case "showContinuePrompt":
          this.continueText.setVisible(true);
          break;
        case "hideContinuePrompt":
          this.continueText.setVisible(false);
          break;
        case "runEnded":
          this.continueText.setText("RUN OVER");
          this.continueText.setVisible(true);
          break;
      }
    }
    this.score = this.runFsm.state.score;
    this.scoreText.setText(String(this.score));
  }

  private dispatchMiss(): void {
    this.dragging = false;
    this.dragPt = null;
    this.applyRunResult(this.runFsm.dispatch({ type: "outOfBounds" }));
    if (allowsContinue(this.runFsm.state.mode)) {
      this.applyRunResult(this.runFsm.dispatch({ type: "offerContinue" }));
    } else {
      this.applyRunResult(this.runFsm.dispatch({ type: "endRun" }));
    }
  }

  private resetRun(): void {
    this.showHint = true;
    this.continueText.setText("TAP TO RETRY");
    this.applyRunResult(this.runFsm.dispatch({ type: "acceptContinue" }));
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.runFsm.runState === "continue") {
      this.resetRun();
      return;
    }
    if (this.runFsm.runState !== "aiming" || !this.source) return;
    const p = { x: pointer.worldX, y: pointer.worldY };
    if (hypot(p.x - this.source.x, p.y - this.source.y) > 160) return;
    this.aimOrigin = { x: this.source.x, y: this.source.y - 1 };
    this.dragging = true;
    this.dragPt = p;
    this.aim = aimFrom(this.aimOrigin, p, this.W, this.H);
    this.showHint = false;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging || this.runFsm.runState !== "aiming") return;
    this.dragPt = { x: pointer.worldX, y: pointer.worldY };
    this.aim = aimFrom(this.aimOrigin, this.dragPt, this.W, this.H);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging || this.runFsm.runState !== "aiming") return;
    this.dragPt = { x: pointer.worldX, y: pointer.worldY };
    this.aim = aimFrom(this.aimOrigin, this.dragPt, this.W, this.H);
    this.dragging = false;

    const result = this.runFsm.dispatch({
      type: "release",
      vx: this.aim.x,
      vy: this.aim.y,
      originX: this.aimOrigin.x,
      originY: this.aimOrigin.y,
      minSpeed: MIN_SHOT,
    });
    if (!result.accepted) {
      this.aim = { x: 0, y: 0, pull: 0 };
      if (this.runFsm.state.score === 0) this.showHint = true;
      return;
    }

    this.applyRunResult(result);
    this.aim = { x: 0, y: 0, pull: 0 };
    this.dragPt = null;
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.033);

    if (this.runFsm.runState === "transition" && this.transition) {
      const done = updateDunkTransition(this.transition, this.ball, dt);
      if (done) {
        this.applyRunResult(
          this.runFsm.dispatch({ type: "finishTransition" }),
        );
      }
      this.drawFrame();
      return;
    }

    if (this.source) this.source.wobble *= Math.pow(0.04, dt);
    if (this.target) this.target.wobble *= Math.pow(0.06, dt);

    if (this.runFsm.runState === "aiming" && this.source) {
      this.aimOrigin = { x: this.source.x, y: this.source.y - 1 };
      this.ball.x = this.aimOrigin.x;
      this.ball.y =
        this.aimOrigin.y + (this.dragging ? 0 : Math.sin(_time / 260) * 1.2);
    }

    if (this.runFsm.runState === "scored" && this.target) {
      this.ball.x = this.target.x;
      this.ball.y = this.target.y - 1 + Math.sin(_time / 120) * 0.8;
      const scoredAt = this.runFsm.state.scoredAtMs ?? _time;
      if (_time - scoredAt > 180) {
        this.applyRunResult(
          this.runFsm.dispatch({ type: "swishHoldComplete" }, _time),
        );
      }
    }

    if (this.runFsm.runState === "flying") {
      stepProjectile(this.ball, dt, this.W);
      if (this.source) rimHit(this.source, this.ball);
      if (this.target) rimHit(this.target, this.ball);
      collideObstacles(this.obstacles, this.ball, dt);

      if (this.target && throughHoop(this.target, this.ball)) {
        this.onScore(_time);
      } else if (
        this.ball.y > this.H + 90 ||
        this.ball.x < -120 ||
        this.ball.x > this.W + 120
      ) {
        this.dispatchMiss();
      }
    }

    this.drawFrame();
  }

  private onScore(time: number): void {
    if (
      this.runFsm.state.scoredAtMs !== null ||
      !this.target ||
      this.runFsm.runState === "transition"
    ) {
      return;
    }
    this.applyRunResult(this.runFsm.dispatch({ type: "throughHoop" }, time));
  }

  private startTransition(): void {
    if (!this.source || !this.target || this.transition) return;
    const { side, transition } = beginDunkTransition({
      side: this.side,
      score: this.score,
      seed:
        this.runFsm.state.mode === "daily"
          ? dailySeedFromUtcDate()
          : this.runSeed,
      mode: this.runFsm.state.mode,
      width: this.W,
      height: this.H,
      source: this.source,
      target: this.target,
      obstacles: this.obstacles,
    });
    this.side = side;
    this.transition = transition;
    this.source = null;
    this.target = null;
    this.obstacles = [];
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
    this.transition = null;
    this.aim = { x: 0, y: 0, pull: 0 };
    this.dragging = false;
    this.dragPt = null;
  }

  private drawFrame(): void {
    const g = this.gfx;
    g.clear();

    g.fillStyle(0x5a606e, 0.14);
    g.fillRect(0, 0, 14, this.H);
    g.fillRect(this.W - 14, 0, 14, this.H);

    if (this.runFsm.runState === "transition" && this.transition) {
      this.drawTransition(g, this.transition);
    } else {
      this.drawObstacles(g, this.obstacles, 1);
      if (this.target) this.drawHoop(g, this.target, ORANGE, null);
      if (this.source) {
        const pull =
          this.runFsm.runState === "aiming" && this.dragging
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

    if (this.runFsm.runState === "aiming" && this.dragging) {
      this.drawAimDots(g);
    }

    this.drawBall(g, this.ball.x, this.ball.y);

    this.hintText.setVisible(
      this.showHint &&
        this.runFsm.runState === "aiming" &&
        !this.dragging &&
        !!this.source,
    );
    if (this.source && this.hintText.visible) {
      this.hintText.setPosition(
        this.source.x,
        this.source.y + 62 + Math.sin(this.time.now / 220) * 6,
      );
    }
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
