import Phaser from "phaser";
import {
  RunFSM,
  allowsContinue,
  createInputLogRecorder,
  createScoreState,
  resolveRunSeed,
  generateShotLayout,
  reduceScoreEvent,
  shotRng,
  type PhysicsIntent,
  type ScoreState,
  type Side,
} from "@trickshot/logic";
import { PHYSICS_BUILD_ID } from "@trickshot/physics";
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
  aimFrom,
  collideObstacles,
  hypot,
  maxPull,
  netPullForHoop,
  predictPath,
  rimHit,
  stepProjectileSubsteps,
  throughHoop,
  type AimVector,
  type Hoop,
  type NetPull,
  type Obstacle,
  type Projectile,
  type Vec2,
} from "../physics";
import {
  COURT,
  GREY,
  ORANGE,
  comboChipText,
  drawAimDots,
  drawAimRubberBand,
  drawCourt,
  drawDragHint,
  drawHoop,
  drawMarble,
  drawObstacles,
  drawPauseIcon,
  drawStarIcon,
  drawTrail,
  hintBob,
  hintTextY,
  hudStarPosition,
  hudStarTextPosition,
  spawnLaunchRings,
  updateTrailEffects,
  type LaunchRing,
  type TrailParticle,
} from "../render";

/**
 * Pitch-parity core loop: zigzag climb, one obstacle per shot,
 * seamless dunk→next-loop handoff (no hard teleport).
 */
export class PlayScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private starText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private continueText!: Phaser.GameObjects.Text;

  private readonly trail: TrailParticle[] = [];
  private readonly rings: LaunchRing[] = [];

  private readonly runSeed =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `casual-${Date.now()}`;
  private readonly inputLog = createInputLogRecorder({
    seed: this.runSeed,
    mode: "casual",
    physicsBuildId: PHYSICS_BUILD_ID,
  });
  private readonly runFsm = new RunFSM("casual");
  private score = 0;
  private side = 1;
  private scoreState: ScoreState = createScoreState();
  private starPos: Vec2 | null = null;

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
    this.gfx = this.add.graphics().setDepth(5);

    this.scoreText = this.add
      .text(0, 0, "0", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontStyle: "900",
        color: "rgba(110,114,124,0.16)",
      })
      .setOrigin(0.5)
      .setDepth(1);

    this.starText = this.add
      .text(0, 0, "0", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontStyle: "800",
        fontSize: "22px",
        color: "#555964",
      })
      .setOrigin(1, 0)
      .setDepth(20);

    this.comboText = this.add
      .text(48, 40, "", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontStyle: "900",
        fontSize: "14px",
        color: ORANGE,
      })
      .setDepth(20);

    this.hintText = this.add
      .text(0, 0, "DRAG IT!", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontStyle: "800",
        fontSize: "15px",
        color: "#9aa0aa",
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.continueText = this.add
      .text(0, 0, "TAP TO RETRY", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontStyle: "800",
        fontSize: "18px",
        color: "#5f646e",
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth(20);

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

    const starPos = hudStarTextPosition(this.W);
    this.starText.setPosition(starPos.x, starPos.y);
  }

  private syncHud(): void {
    this.starText.setText(String(this.scoreState.stars));
    const chip = comboChipText(this.scoreState.chainLength);
    this.comboText.setText(chip ?? "");
    this.comboText.setVisible(
      !!chip && this.runFsm.runState !== "continue",
    );
  }

  /** Mode-matrix seed resolution (`per_run` / `utc_daily` / `tournament_id`). */
  private currentSeed(): string {
    return resolveRunSeed(this.runFsm.state.mode, { runSeed: this.runSeed });
  }

  /** Hard snap (boot / continue / resize). Dunks use seamless transition. */
  private place(fromScore: number, advanceSide = true): void {
    if (fromScore === 0) this.side = 1;
    else if (advanceSide) this.side *= -1;

    const mode = this.runFsm.state.mode;
    const seed = this.currentSeed();
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
    this.trail.length = 0;
    this.rings.length = 0;
    this.aimOrigin = { x: L.source.x, y: L.source.y - 1 };
    this.continueText.setVisible(false);
    this.applyShotStar(fromScore);
    this.syncHud();
  }

  private applyShotStar(fromScore: number): void {
    const mode = this.runFsm.state.mode;
    const seed = this.currentSeed();
    const side = this.side as Side;
    const rng = shotRng(seed, fromScore, side, mode);
    this.scoreState = reduceScoreEvent(this.scoreState, {
      type: "prepareShot",
      fromScore,
      rngUnit: rng.next(),
    });
    if (!this.scoreState.starActive) {
      this.starPos = null;
      return;
    }
    const L = generateShotLayout({
      side,
      score: fromScore,
      seed,
      mode,
      width: this.W,
      height: this.H,
    });
    this.starPos = { ...L.star };
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
          spawnLaunchRings(this.rings, intent.x, intent.y);
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
    this.scoreText.setText(String(this.scoreState.score));
    this.syncHud();
  }

  private tryCollectStar(): void {
    if (!this.scoreState.starActive || !this.starPos) return;
    if (hypot(this.ball.x - this.starPos.x, this.ball.y - this.starPos.y) < 28) {
      this.scoreState = reduceScoreEvent(this.scoreState, {
        type: "collectStar",
      });
      this.starPos = null;
      this.scoreText.setText(String(this.scoreState.score));
      this.syncHud();
    }
  }

  private dispatchMiss(): void {
    this.inputLog.record({ type: "out_of_bounds" }, this.time.now);
    this.scoreState = reduceScoreEvent(this.scoreState, { type: "miss" });
    this.dragging = false;
    this.dragPt = null;
    this.trail.length = 0;
    this.rings.length = 0;
    this.applyRunResult(this.runFsm.dispatch({ type: "outOfBounds" }));
    if (allowsContinue(this.runFsm.state.mode)) {
      this.applyRunResult(this.runFsm.dispatch({ type: "offerContinue" }));
    } else {
      this.applyRunResult(this.runFsm.dispatch({ type: "endRun" }));
    }
  }

  private resetRun(): void {
    this.inputLog.record({ type: "continue_accept" }, this.time.now);
    this.showHint = true;
    this.continueText.setText("TAP TO RETRY");
    this.scoreState = reduceScoreEvent(this.scoreState, {
      type: "acceptContinue",
    });
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
    this.inputLog.record({ type: "pointer_down", x: p.x, y: p.y }, pointer.time);
    this.aim = aimFrom(this.aimOrigin, p, this.W, this.H);
    this.showHint = false;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging || this.runFsm.runState !== "aiming") return;
    this.dragPt = { x: pointer.worldX, y: pointer.worldY };
    this.inputLog.record(
      { type: "pointer_move", x: pointer.worldX, y: pointer.worldY },
      pointer.time,
    );
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
      this.inputLog.record(
        { type: "pointer_up", x: pointer.worldX, y: pointer.worldY },
        pointer.time,
      );
      this.aim = { x: 0, y: 0, pull: 0 };
      if (this.runFsm.state.score === 0) this.showHint = true;
      return;
    }

    this.inputLog.record(
      {
        type: "release",
        vx: this.aim.x,
        vy: this.aim.y,
        originX: this.aimOrigin.x,
        originY: this.aimOrigin.y,
        x: pointer.worldX,
        y: pointer.worldY,
      },
      pointer.time,
    );
    this.applyRunResult(result);
    this.aim = { x: 0, y: 0, pull: 0 };
    this.dragPt = null;
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.033);
    const flying = this.runFsm.runState === "flying";

    updateTrailEffects(
      this.trail,
      this.rings,
      dt,
      this.ball.x,
      this.ball.y,
      this.ball.vx,
      this.ball.vy,
      flying,
    );

    if (this.runFsm.runState === "transition" && this.transition) {
      const done = updateDunkTransition(this.transition, this.ball, dt);
      if (done) {
        this.applyRunResult(
          this.runFsm.dispatch({ type: "finishTransition" }),
        );
      }
      this.drawFrame(_time);
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

    if (flying) {
      stepProjectileSubsteps(this.ball, dt, this.W);
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
        this.dispatchMiss();
      }
    }

    this.drawFrame(_time);
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
    this.inputLog.record({ type: "through_hoop" }, time);
    this.scoreState = reduceScoreEvent(this.scoreState, { type: "dunk" });
    this.scoreText.setText(String(this.scoreState.score));
    this.trail.length = 0;
    this.rings.length = 0;
    this.syncHud();
  }

  private startTransition(): void {
    if (!this.source || !this.target || this.transition) return;
    const { side, transition } = beginDunkTransition({
      side: this.side,
      score: this.score,
      seed: this.currentSeed(),
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
    this.applyShotStar(this.runFsm.state.score);
  }

  private comboHeat(): number {
    return Math.min(1, this.scoreState.chainLength / 5);
  }

  private drawFrame(timeMs: number): void {
    const g = this.gfx;
    g.clear();

    drawCourt(g, this.W, this.H);

    const comboHeat = this.comboHeat();

    if (this.runFsm.runState === "transition" && this.transition) {
      this.drawTransition(g, this.transition, timeMs, comboHeat);
    } else {
      drawObstacles(g, this.obstacles, 1, timeMs);

      if (this.scoreState.starActive && this.starPos) {
        drawStarIcon(
          g,
          this.starPos.x,
          this.starPos.y,
          12,
          timeMs / 800,
        );
      }

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
        drawHoop(g, this.source, GREY, {
          withBall: this.runFsm.runState === "aiming",
          ballX: this.ball.x,
          ballY: this.ball.y,
          pullNet: this.runFsm.runState === "aiming" && this.dragging,
          pull,
          timeMs,
          comboHeat,
        });
      }

      if (this.target) {
        drawHoop(g, this.target, ORANGE, {
          withBall: this.runFsm.runState === "scored",
          ballX: this.ball.x,
          ballY: this.ball.y,
          timeMs,
          comboHeat,
        });
      }
    }

    drawTrail(g, this.trail, this.rings);

    if (this.runFsm.runState === "aiming" && this.dragging) {
      const dots = predictPath(
        this.aimOrigin,
        this.aim.x,
        this.aim.y,
        this.W,
        this.H,
      );
      drawAimDots(g, dots);
      if (this.dragPt) {
        drawAimRubberBand(
          g,
          this.aimOrigin.x,
          this.aimOrigin.y,
          this.dragPt.x,
          this.dragPt.y,
          this.aim.pull,
          maxPull(this.W, this.H),
        );
      }
    }

    if (
      this.runFsm.runState === "flying" ||
      this.runFsm.runState === "continue"
    ) {
      drawMarble(g, this.ball.x, this.ball.y, BALL_RADIUS);
    }

    drawPauseIcon(g);
    const starHud = hudStarPosition(this.W);
    drawStarIcon(g, starHud.x, starHud.y, 10);

    const showHint =
      this.showHint &&
      this.runFsm.runState === "aiming" &&
      !this.dragging &&
      !!this.source;
    this.hintText.setVisible(showHint);
    if (this.source && showHint) {
      const bob = hintBob(timeMs);
      const baseY = this.source.y + 62;
      drawDragHint(g, this.source.x, baseY, bob);
      this.hintText.setPosition(this.source.x, hintTextY(baseY, bob));
    }
  }

  private drawTransition(
    g: Phaser.GameObjects.Graphics,
    tr: DunkTransition,
    timeMs: number,
    comboHeat: number,
  ): void {
    if (tr.oldObstacles.length && tr.leave) {
      const fade = tr.leave.a ?? 1;
      drawObstacles(g, tr.oldObstacles, fade, timeMs);
    }
    if (tr.nextObstacles.length && tr.arrive) {
      const fade = (tr.arrive.a ?? 1) * 0.85;
      drawObstacles(g, tr.nextObstacles, fade, timeMs);
    }
    if (tr.leave) {
      const h = makeHoop(tr.leave.x, tr.leave.y, tr.leave.ang);
      h.wobble = tr.leave.wobble;
      drawHoop(g, h, GREY, { alpha: tr.leave.a ?? 1, timeMs, comboHeat });
    }
    if (tr.arrive) {
      const h = makeHoop(tr.arrive.x, tr.arrive.y, tr.arrive.ang);
      h.wobble = tr.arrive.wobble;
      drawHoop(g, h, ORANGE, { alpha: tr.arrive.a ?? 1, timeMs, comboHeat });
      if ((tr.arrive.a ?? 0) > 0.55) {
        drawStarIcon(
          g,
          tr.arriveTo.x,
          tr.arriveTo.y - 34,
          12,
          timeMs / 800,
          tr.arrive.a ?? 1,
        );
      }
    }
    if (tr.carry) {
      const h = makeHoop(tr.carry.x, tr.carry.y, tr.carry.ang);
      h.wobble = tr.carry.wobble;
      const color = mixRimCss(tr.carry.colorT ?? 0);
      drawHoop(g, h, color, {
        withBall: true,
        ballX: this.ball.x,
        ballY: this.ball.y,
        timeMs,
        comboHeat,
      });
    }
  }
}
