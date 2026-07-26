import Phaser from "phaser";
import { layoutForSide, makeHoop } from "../game/layout";
import {
  BALL_RADIUS,
  MIN_SHOT,
  RIM_RX,
  RIM_RY,
  aimFrom,
  hypot,
  netPullForHoop,
  predictPath,
  rimHit,
  stepProjectile,
  throughHoop,
  type AimVector,
  type Hoop,
  type NetPull,
  type Projectile,
  type Vec2,
} from "../physics";

const COURT = "#e8e8ea";
const ORANGE = "#ff4d1a";
const GREY = "#5f646e";
const CYAN = "#4ecbff";
const BALL_FILL = 0x1e5fff;

type Mode = "aim" | "flying" | "scored";

/**
 * Pitch-parity core loop: custom 2D integrator, net-drag aim, wall banks.
 * Seamless dunk handoff / obstacles / continue UX land in later issues.
 */
export class PlayScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  private mode: Mode = "aim";
  private score = 0;
  private side = 1;

  private source: Hoop | null = null;
  private target: Hoop | null = null;
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

    this.syncSize();
    this.place(0);

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
    // Re-place current shot so aim coords stay on-screen after resize
    if (this.mode === "aim" && prevW > 0 && prevH > 0) {
      this.place(this.score, false);
    }
  };

  private syncSize(): void {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.scoreText.setFontSize(Math.floor(this.W * 0.38));
    this.scoreText.setPosition(this.W / 2, this.H * 0.22);
  }

  private place(fromScore: number, advanceSide = true): void {
    if (fromScore === 0) this.side = 1;
    else if (advanceSide) this.side *= -1;

    const L = layoutForSide(this.side, fromScore, this.W, this.H);
    this.source = makeHoop(L.sx, L.sy, L.sourceAng);
    this.target = makeHoop(L.tx, L.ty, L.targetAng);
    this.ball.x = L.sx;
    this.ball.y = L.sy - 1;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.mode = "aim";
    this.aim = { x: 0, y: 0, pull: 0 };
    this.dragging = false;
    this.dragPt = null;
    this.scoredAt = 0;
    this.aimOrigin = { x: L.sx, y: L.sy - 1 };
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.mode !== "aim" || !this.source) return;
    // Prefer world coords (RESIZE / camera-safe)
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
      if (this.score === 0) this.showHint = true;
      return;
    }

    // Launch from fixed origin — matches the preview exactly
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
      this.ball.y =
        this.target.y - 1 + Math.sin(_time / 120) * 0.8;
      if (_time - this.scoredAt > 220) {
        // Hard place next lane (seamless handoff is issue #3)
        this.place(this.score);
      }
    }

    if (this.mode === "flying") {
      stepProjectile(this.ball, dt, this.W);
      if (this.source) rimHit(this.source, this.ball);
      if (this.target) rimHit(this.target, this.ball);

      if (this.target && throughHoop(this.target, this.ball)) {
        this.onScore(_time);
      } else if (
        this.ball.y > this.H + 90 ||
        this.ball.x < -120 ||
        this.ball.x > this.W + 120
      ) {
        // Miss → same lane (continue UX is issue #4)
        this.place(this.score, false);
        if (this.score === 0) this.showHint = true;
      }
    }

    this.drawFrame();
  }

  private onScore(time: number): void {
    if (this.scoredAt || !this.target) return;
    this.scoredAt = time;
    this.score += 1;
    this.target.wobble = 1.5;
    this.ball.x = this.target.x;
    this.ball.y = this.target.y - 1;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.mode = "scored";
    this.scoreText.setText(String(this.score));
  }

  private drawFrame(): void {
    const g = this.gfx;
    g.clear();

    // Edge rails (hint sides deflect)
    g.fillStyle(0x5a606e, 0.14);
    g.fillRect(0, 0, 14, this.H);
    g.fillRect(this.W - 14, 0, 14, this.H);

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

    if (this.mode === "aim" && this.dragging) {
      this.drawAimDots(g);
    }

    // Ball stays seated at aimOrigin while aiming — net takes the stretch
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
    g.fillEllipse(x - BALL_RADIUS * 0.3, y - BALL_RADIUS * 0.35, BALL_RADIUS * 0.55, BALL_RADIUS * 0.32);
  }

  /** Local hoop point → world (avoids Phaser Graphics canvas-matrix leaks) */
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

  private drawHoop(
    g: Phaser.GameObjects.Graphics,
    h: Hoop,
    colorCss: string,
    pull: NetPull | null,
  ): void {
    const color = Phaser.Display.Color.HexStringToColor(colorCss).color;
    const p = pull ?? { lx: 0, ly: 0, amt: 0 };
    const tip = p.amt * 0.22;
    const tipAng = h.ang + Math.atan2(p.lx, 40) * tip;

    // Contact shadow
    const shadow = this.hoopToWorld(
      h,
      tipAng,
      2 + p.lx * p.amt * 0.04,
      10 + p.ly * p.amt * 0.04,
    );
    g.fillStyle(0x000000, 0.08);
    g.fillEllipse(shadow.x, shadow.y, RIM_RX * 1.9, RIM_RY * 2.2);

    this.drawWovenNet(g, h, tipAng, h.wobble || 0, p);

    this.strokeEllipseWorld(g, h, tipAng, RIM_RX, RIM_RY, color, 8, 1);
    this.strokeEllipseWorld(
      g,
      h,
      tipAng,
      RIM_RX - 3.5,
      RIM_RY - 2.2,
      0x000000,
      2,
      0.18,
    );
  }

  /** Diamond mesh pouch — stretches toward drag (pitch `drawWovenNet`) */
  private drawWovenNet(
    g: Phaser.GameObjects.Graphics,
    h: Hoop,
    tipAng: number,
    wob: number,
    pull: NetPull,
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

    g.fillStyle(0xffffff, 0.2 + amt * 0.12);
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

    g.lineStyle(2.3, 0xffffff, 0.98);
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

    g.lineStyle(2.05, 0xffffff, 0.98);
    for (let j = 1; j <= rows; j++) {
      g.beginPath();
      for (let i = 0; i < cols; i++) {
        const q = pt(i, j);
        if (i === 0) g.moveTo(q.x, q.y);
        else g.lineTo(q.x, q.y);
      }
      g.strokePath();
    }

    g.lineStyle(1.7, 0xffffff, 0.9);
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
