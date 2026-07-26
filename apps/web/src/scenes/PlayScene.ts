import Phaser from "phaser";
import {
  RunFSM,
  allowsContinue,
  comboLabel,
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
  type Obstacle,
  type Projectile,
  type Vec2,
} from "../physics";
import {
  COURT,
  PitchCanvasRenderer,
  safeTopInset,
  spawnLaunchRings,
  updateTrailEffects,
  type LaunchRing,
  type PitchDrawState,
  type TrailParticle,
  type VisualMode,
} from "../render";

/**
 * Pitch-parity core loop: zigzag climb, one obstacle per shot,
 * seamless dunk→next-loop handoff. Rendering is Canvas2D pitch draw
 * blitted into a Phaser CanvasTexture.
 */
export class PlayScene extends Phaser.Scene {
  private pitch!: PitchCanvasRenderer;

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
  private continueLabel: string | null = null;
  /** DEV screenshot pose — freezes sim and drives visualMode. */
  private poseOverride: VisualMode | null = null;

  private W = 390;
  private H = 780;

  constructor() {
    super("play");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COURT);
    this.pitch = new PitchCanvasRenderer(this);

    this.syncSize();
    this.applyRunResult(this.runFsm.dispatch({ type: "bootComplete" }));

    this.input.on("pointerdown", this.onDown, this);
    this.input.on("pointermove", this.onMove, this);
    this.input.on("pointerup", this.onUp, this);
    this.input.on("pointerupoutside", this.onUp, this);

    this.scale.on("resize", this.onResize, this);

    if (import.meta.env.DEV) {
      const w = window as Window & {
        __trickshotScene?: PlayScene;
        __trickshotCapture?: () => string;
        __trickshotPose?: (kind: "idle" | "aim" | "flight" | "scored") => void;
      };
      w.__trickshotScene = this;
      w.__trickshotCapture = () => this.pitch.toDataURL("image/png");
      w.__trickshotPose = (kind) => this.devPose(kind);
    }
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
    this.pitch.resize(this.W, this.H);
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
    this.continueLabel = null;
    this.applyShotStar(fromScore);
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
          this.continueLabel = "TAP TO RETRY";
          break;
        case "hideContinuePrompt":
          this.continueLabel = null;
          break;
        case "runEnded":
          this.continueLabel = "RUN OVER";
          break;
      }
    }
    this.score = this.runFsm.state.score;
  }

  private tryCollectStar(): void {
    if (!this.scoreState.starActive || !this.starPos) return;
    if (hypot(this.ball.x - this.starPos.x, this.ball.y - this.starPos.y) < 28) {
      this.scoreState = reduceScoreEvent(this.scoreState, {
        type: "collectStar",
      });
      this.starPos = null;
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
    this.continueLabel = "TAP TO RETRY";
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
    if (this.poseOverride) {
      this.drawFrame(_time);
      return;
    }

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
    this.trail.length = 0;
    this.rings.length = 0;
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

  private visualMode(): VisualMode {
    if (this.poseOverride) return this.poseOverride;
    switch (this.runFsm.runState) {
      case "aiming":
        return "aim";
      case "flying":
        return "flying";
      case "scored":
        return "scored";
      case "continue":
        return "continue";
      case "transition":
        return "transition";
      case "ended":
        return "ended";
      default:
        return "boot";
    }
  }

  private buildDrawState(timeMs: number): PitchDrawState {
    const mode = this.visualMode();
    const sourcePull =
      mode === "aim" && this.dragging && this.source
        ? netPullForHoop(
            this.source,
            this.dragPt,
            this.dragging,
            this.W,
            this.H,
          )
        : null;

    const predictDots =
      mode === "aim" && this.dragging
        ? predictPath(
            this.aimOrigin,
            this.aim.x,
            this.aim.y,
            this.W,
            this.H,
          )
        : [];

    const chip = comboLabel(this.scoreState.chainLength);

    let transition: PitchDrawState["transition"] = null;
    if (mode === "transition" && this.transition) {
      const tr = this.transition;
      transition = {
        leave: tr.leave,
        arrive: tr.arrive,
        arriveTo: tr.arriveTo,
        carry: tr.carry
          ? {
              x: tr.carry.x,
              y: tr.carry.y,
              ang: tr.carry.ang,
              wobble: tr.carry.wobble,
              color: mixRimCss(tr.carry.colorT ?? 0),
            }
          : null,
        oldObstacles: tr.oldObstacles,
        nextObstacles: tr.nextObstacles,
      };
    }

    return {
      W: this.W,
      H: this.H,
      timeMs,
      mode,
      score: this.scoreState.score,
      stars: this.scoreState.stars,
      combo: this.scoreState.chainLength,
      safeTop: safeTopInset(),
      ball: { x: this.ball.x, y: this.ball.y },
      source: this.source,
      target: this.target,
      sourcePull,
      obstacles: this.obstacles,
      star: this.starPos,
      starOn: !!this.scoreState.starActive && !!this.starPos,
      drag: this.dragging,
      dragPt: this.dragPt,
      aimOrigin: this.aimOrigin,
      aimPull: this.aim.pull,
      maxPull: maxPull(this.W, this.H),
      predictDots,
      trail: this.trail,
      rings: this.rings,
      showHint: this.showHint,
      comboChip: chip,
      continueLabel:
        mode === "continue" || mode === "ended" ? this.continueLabel : null,
      transition,
    };
  }

  private drawFrame(timeMs: number): void {
    this.pitch.render(this.buildDrawState(timeMs));
  }

  /**
   * DEV-only: force visual poses for screenshot capture through the real
   * Canvas2D pitch path (does not alter physics packages).
   */
  private devPose(kind: "idle" | "aim" | "flight" | "scored"): void {
    if (!this.source || !this.target) this.place(0, false);
    const src = this.source!;
    const tgt = this.target!;
    this.continueLabel = null;
    this.trail.length = 0;
    this.rings.length = 0;

    if (kind === "idle") {
      this.poseOverride = "aim";
      this.showHint = true;
      this.dragging = false;
      this.dragPt = null;
      this.aim = { x: 0, y: 0, pull: 0 };
      this.ball.x = src.x;
      this.ball.y = src.y - 1;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.drawFrame(performance.now());
      return;
    }

    if (kind === "aim") {
      this.poseOverride = "aim";
      this.showHint = false;
      this.dragging = true;
      this.aimOrigin = { x: src.x, y: src.y - 1 };
      this.dragPt = { x: src.x - 40, y: src.y + 110 };
      this.aim = aimFrom(this.aimOrigin, this.dragPt, this.W, this.H);
      this.ball.x = this.aimOrigin.x;
      this.ball.y = this.aimOrigin.y;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.drawFrame(performance.now());
      return;
    }

    if (kind === "flight") {
      this.poseOverride = "flying";
      this.showHint = false;
      this.dragging = false;
      this.dragPt = null;
      const midX = (src.x + tgt.x) / 2;
      const midY = (src.y + tgt.y) / 2;
      this.ball.x = midX;
      this.ball.y = midY;
      this.ball.vx = (tgt.x - src.x) * 2;
      this.ball.vy = (tgt.y - src.y) * 2;
      spawnLaunchRings(this.rings, midX, midY + 20);
      for (let i = 0; i < 10; i++) {
        this.trail.push({
          x: midX - i * 8,
          y: midY + i * 10,
          life: 1 - i * 0.08,
          rot: Math.atan2(this.ball.vy, this.ball.vx),
        });
      }
      this.drawFrame(performance.now());
      return;
    }

    this.poseOverride = "scored";
    this.showHint = false;
    this.dragging = false;
    this.dragPt = null;
    this.ball.x = tgt.x;
    this.ball.y = tgt.y - 1;
    this.ball.vx = 0;
    this.ball.vy = 0;
    tgt.wobble = 1.2;
    this.scoreState = {
      ...this.scoreState,
      score: Math.max(1, this.scoreState.score),
    };
    this.drawFrame(performance.now());
  }
}
