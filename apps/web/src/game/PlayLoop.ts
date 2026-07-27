import {
  FLIGHT_TIMEOUT,
  LEVELS,
  RunFSM,
  allowsContinue,
  buildRunSummary,
  comboLabel,
  createInputLogRecorder,
  createScoreState,
  isChallengeUnlocked,
  loadChallengesProgress,
  makeWorld,
  recordChallengeClear,
  resolveRunSeed,
  generateShotLayout,
  reduceScoreEvent,
  saveChallengesProgress,
  shotRng,
  stepChallengeWorld,
  type ChallengeStar,
  type InputLogRecorder,
  type PhysicsIntent,
  type ScoreState,
  type Side,
} from "@trickshot/logic";
import {
  COURT_H,
  COURT_W,
  FIXED_DT,
  PHYSICS_BUILD_ID,
} from "@trickshot/physics";
import type { GameMode } from "@trickshot/shared";
import { makeHoop } from "./layout";
import {
  beginDunkTransition,
  finishDunkTransition,
  mixRimCss,
  updateDunkTransition,
  type DunkTransition,
} from "./transition";
import {
  MIN_SHOT,
  aimFrom,
  collideObstacles,
  hoopLocal,
  hypot,
  maxPull,
  netPullForHoop,
  predictPath,
  rimHit,
  stepProjectileSubsteps,
  throughHoop,
  updateObstacles,
  type AimVector,
  type Hoop,
  type Obstacle,
  type Projectile,
  type Vec2,
} from "../physics";
import {
  recordLocalScore,
  emitRunSummary,
  comboSubtext,
  shakeIntensity,
  tournamentRunId,
} from "../meta";
import { MetaHud } from "../ui/metaHud";
import {
  DirectCanvasRenderer,
  clientToCourt,
  kickNet,
  makeNet,
  safeTopInset,
  safeBottomInset,
  spawnLaunchRings,
  stepNetFor,
  updateTrailEffects,
  type LaunchRing,
  type PitchDrawState,
  type TrailParticle,
  type VerletNet,
  type VisualMode,
} from "../render";

interface ComboFx {
  label: string;
  sub: string;
  t: number;
  dur: number;
}

/**
 * Pitch-parity core loop + Alpha meta: combo juice, continue stub,
 * daily seed, local leaderboard, RunSummary. Canvas2D + rAF (no Phaser).
 */
export class PlayLoop {
  private readonly pitch: DirectCanvasRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly hud: MetaHud;

  private readonly trail: TrailParticle[] = [];
  private readonly rings: LaunchRing[] = [];

  private runSeed =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `casual-${Date.now()}`;
  private inputLog: InputLogRecorder = createInputLogRecorder({
    seed: this.runSeed,
    mode: "casual",
    physicsBuildId: PHYSICS_BUILD_ID,
  });
  private runFsm = new RunFSM("casual");
  private score = 0;
  private side = 1;
  private scoreState: ScoreState = createScoreState();
  private starPos: Vec2 | null = null;
  private tournamentId: string | null = null;
  private inMenu = true;
  private comboFx: ComboFx | null = null;
  private shake = 0;

  private source: Hoop | null = null;
  private target: Hoop | null = null;
  private sourceNet: VerletNet = makeNet();
  private targetNet: VerletNet = makeNet();
  private leaveNet: VerletNet | null = null;
  private carryNet: VerletNet | null = null;
  private arriveNet: VerletNet | null = null;
  private obstacles: Obstacle[] = [];
  /** Accumulated sim time for obstacle kinematics (never performance.now). */
  private worldT = 0;
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

  /** Challenges session — when set, endless zigzag / dunk transition is bypassed. */
  private challengeActive = false;
  private challengeIdx = 0;
  private challengePhase: "aim" | "flying" | "won" | "dead" = "aim";
  private challengeStars: ChallengeStar[] = [];
  private challengeAttempts = 0;
  private challengeFlightT = 0;
  private challengeName = "";
  private challengeTip = "";

  /** Fixed logical court — never adopt container pixel size as physics space. */
  private readonly W = COURT_W;
  private readonly H = COURT_H;
  private raf = 0;
  private lastTs = 0;
  private running = false;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== "Space" && e.key !== " ") return;
    if (!this.challengeActive || this.inMenu) return;
    e.preventDefault();
    this.challengeTapAdvance();
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.handleDown(e.clientX, e.clientY, e.timeStamp);
  };
  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    e.preventDefault();
    this.handleMove(e.clientX, e.clientY, e.timeStamp);
  };
  private readonly onPointerUp = (e: PointerEvent): void => {
    e.preventDefault();
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    this.handleUp(e.clientX, e.clientY, e.timeStamp);
  };

  constructor(canvas: HTMLCanvasElement, hudParent: HTMLElement) {
    this.canvas = canvas;
    this.pitch = new DirectCanvasRenderer(canvas);
    this.hud = new MetaHud(hudParent, {
      onSelectMode: (mode) => this.startMode(mode),
      onContinueStub: () => this.applyContinueStub(),
      onEndRun: () => this.declineContinue(),
      onDismissSummary: () => this.backToMenu(),
      onPlayAgain: () => this.backToMenu(),
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.syncSize();
    this.hud.showModePicker();

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("lostpointercapture", this.onPointerUp);
    window.addEventListener("keydown", this.onKeyDown);

    if (import.meta.env.DEV) {
      const w = window as Window & {
        __trickshotLoop?: PlayLoop;
        __trickshotCapture?: () => string;
        __trickshotPose?: (kind: "idle" | "aim" | "flight" | "scored") => void;
      };
      w.__trickshotLoop = this;
      w.__trickshotCapture = () => this.pitch.toDataURL("image/png");
      w.__trickshotPose = (kind) => this.devPose(kind);
    }

    this.lastTs = performance.now();
    const tick = (ts: number): void => {
      if (!this.running) return;
      const delta = ts - this.lastTs;
      this.lastTs = ts;
      this.update(ts, delta);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("lostpointercapture", this.onPointerUp);
    window.removeEventListener("keydown", this.onKeyDown);
    this.hud.destroy();
  }

  resize(): void {
    this.syncSize();
  }

  private syncSize(): void {
    const host = this.canvas.parentElement ?? this.canvas;
    const rect = host.getBoundingClientRect();
    const viewW = Math.max(1, Math.floor(rect.width));
    const viewH = Math.max(1, Math.floor(rect.height));
    this.pitch.resize(viewW, viewH);
  }

  private pointerCourt(clientX: number, clientY: number): Vec2 {
    return clientToCourt(this.canvas, clientX, clientY, this.W, this.H);
  }

  private startMode(mode: GameMode): void {
    this.inMenu = false;
    this.runSeed =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${mode}-${Date.now()}`;
    this.tournamentId = mode === "tournament" ? tournamentRunId() : null;

    this.runFsm = new RunFSM(mode);
    this.inputLog = createInputLogRecorder({
      seed: this.currentSeed(),
      mode,
      physicsBuildId: PHYSICS_BUILD_ID,
    });
    this.scoreState = createScoreState();
    this.score = 0;
    this.side = 1;
    this.showHint = true;
    this.comboFx = null;
    this.shake = 0;
    this.continueLabel = null;

    this.hud.setModeLabel(mode);
    this.hud.setStars(0);
    this.hud.hideModePicker();
    this.hud.hideContinue();
    this.hud.hideSummary();

    if (mode === "challenges") {
      this.startChallenges();
      return;
    }

    this.challengeActive = false;
    this.applyRunResult(this.runFsm.dispatch({ type: "bootComplete" }));
  }

  private firstPlayableChallenge(): number {
    const progress = loadChallengesProgress();
    for (let i = 0; i < LEVELS.length; i++) {
      if (!isChallengeUnlocked(i, progress)) break;
      const cleared = !!progress.cleared[String(i)] || !!progress.cleared[i];
      if (!cleared) return i;
    }
    for (let i = 0; i < LEVELS.length; i++) {
      if (isChallengeUnlocked(i, progress)) return i;
    }
    return 0;
  }

  private startChallenges(): void {
    this.challengeActive = true;
    this.challengeIdx = this.firstPlayableChallenge();
    this.loadChallengeLevel(this.challengeIdx);
  }

  private loadChallengeLevel(idx: number): void {
    const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, idx))];
    this.challengeIdx = idx;
    this.challengeName = level.n;
    this.challengeTip = level.tip;
    this.challengeAttempts = 0;
    this.showHint = idx === 0;

    const world = makeWorld(level, this.W, this.H);
    this.source = makeHoop(world.src.x, world.src.y, world.src.ang);
    this.target = makeHoop(world.goal.x, world.goal.y, world.goal.ang);
    this.obstacles = world.obs;
    this.challengeStars = world.stars.map((s) => ({ ...s }));
    this.worldT = 0;
    updateObstacles(this.worldT, this.obstacles, 0);
    this.resetNets();
    this.resetChallengeShot();
    this.hud.setModeLabel("challenges", `${idx + 1}/${LEVELS.length}`);
    this.hud.setStars(0);
  }

  private resetChallengeShot(): void {
    for (const o of this.obstacles) {
      o.segs = [];
      o.prev = null;
      if (o.type === "glass") {
        o.broken = false;
        o.shatter = 0;
      }
      if (o.type === "portal") o.cool = 0;
      if (o.type === "spinner") o.ang = 0;
      if (o.type === "bumper" || o.type === "orbiter") o.pulse = 0;
    }
    for (const s of this.challengeStars) s.on = true;
    this.worldT = 0;
    updateObstacles(this.worldT, this.obstacles, 0);
    this.challengePhase = "aim";
    this.challengeFlightT = 0;
    this.dragging = false;
    this.dragPt = null;
    this.aim = { x: 0, y: 0, pull: 0 };
    this.trail.length = 0;
    this.rings.length = 0;
    this.continueLabel = null;
    this.transition = null;
    if (this.source) {
      this.aimOrigin = { x: this.source.x, y: this.source.y - 1 };
      this.ball.x = this.aimOrigin.x;
      this.ball.y = this.aimOrigin.y;
      this.ball.vx = 0;
      this.ball.vy = 0;
    }
    this.hud.setStars(0);
  }

  private challengeStarsCollected(): number {
    return this.challengeStars.filter((s) => !s.on).length;
  }

  private onChallengeWin(): void {
    this.challengePhase = "won";
    const collected = this.challengeStarsCollected();
    const next = recordChallengeClear(
      loadChallengesProgress(),
      this.challengeIdx,
      collected,
    );
    saveChallengesProgress(next);
    this.shake = 9;
    if (this.target) {
      this.target.wobble = 1.5;
      this.ball.x = this.target.x;
      this.ball.y = this.target.y - 1;
      kickNet(this.targetNet, 13);
    }
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.continueLabel = "CLEARED";
    this.challengeTip =
      this.challengeIdx >= LEVELS.length - 1
        ? "All clear — tap for menu"
        : "Tap / space for next";
    this.hud.setStars(collected);
  }

  private onChallengeDead(): void {
    this.challengePhase = "dead";
    this.shake = 5;
    this.continueLabel = "MISSED";
    this.challengeTip = "Tap / space to retry";
  }

  private challengeTapAdvance(): void {
    if (this.challengePhase === "dead") {
      this.resetChallengeShot();
      this.challengeTip = LEVELS[this.challengeIdx]?.tip ?? "";
      return;
    }
    if (this.challengePhase === "won") {
      if (this.challengeIdx >= LEVELS.length - 1) {
        this.backToMenu();
        return;
      }
      const nextIdx = this.challengeIdx + 1;
      const progress = loadChallengesProgress();
      if (!isChallengeUnlocked(nextIdx, progress)) {
        this.backToMenu();
        return;
      }
      this.loadChallengeLevel(nextIdx);
    }
  }

  private backToMenu(): void {
    this.inMenu = true;
    this.challengeActive = false;
    this.dragging = false;
    this.dragPt = null;
    this.source = null;
    this.target = null;
    this.resetNets();
    this.obstacles = [];
    this.challengeStars = [];
    this.transition = null;
    this.comboFx = null;
    this.shake = 0;
    this.continueLabel = null;
    this.hud.hideContinue();
    this.hud.hideSummary();
    this.hud.showModePicker();
  }

  private resetNets(): void {
    this.sourceNet = makeNet();
    this.targetNet = makeNet();
    this.leaveNet = null;
    this.carryNet = null;
    this.arriveNet = null;
  }

  private finishRun(): void {
    const mode = this.runFsm.state.mode;
    const summary = buildRunSummary({
      mode,
      scoreState: this.scoreState,
      continuesUsed: this.runFsm.state.continuesUsed,
      seed: this.currentSeed(),
      inputLog: this.inputLog.finalize(),
    });

    const board =
      mode === "casual" || mode === "daily"
        ? recordLocalScore({
            score: summary.score,
            stars: summary.stars,
            chainLength: summary.chainLength,
            mode,
            seed: summary.seed,
            at: new Date().toISOString(),
          })
        : [];

    emitRunSummary(summary);
    this.hud.showSummary(summary, board);
    this.inMenu = true;
  }

  /** Mode-matrix seed resolution (`per_run` / `utc_daily` / `tournament_id`). */
  private currentSeed(): string {
    return resolveRunSeed(this.runFsm.state.mode, {
      runSeed: this.runSeed,
      tournamentId: this.tournamentId ?? undefined,
    });
  }

  /** Hard snap (boot / continue / resize). Dunks use seamless transition. */
  private place(fromScore: number, advanceSide = true): void {
    if (fromScore === 0) {
      this.side = 1;
      this.resetNets();
    } else if (advanceSide) this.side *= -1;

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
    this.worldT = 0;
    updateObstacles(this.worldT, this.obstacles, 0);
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
          kickNet(this.sourceNet, 5);
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
            kickNet(this.targetNet, 13);
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
          this.continueLabel = "MISS";
          this.hud.showContinue({
            mode: this.runFsm.state.mode,
            score: this.scoreState.score,
            stars: this.scoreState.stars,
            chainLength: this.scoreState.chainLength,
          });
          break;
        case "hideContinuePrompt":
          this.continueLabel = null;
          this.hud.hideContinue();
          break;
        case "runEnded":
          this.continueLabel = "RUN OVER";
          this.finishRun();
          break;
      }
    }
    this.score = this.runFsm.state.score;
    this.hud.setStars(this.scoreState.stars);
  }

  private tryCollectStar(): void {
    if (!this.scoreState.starActive || !this.starPos) return;
    if (hypot(this.ball.x - this.starPos.x, this.ball.y - this.starPos.y) < 28) {
      this.scoreState = reduceScoreEvent(this.scoreState, {
        type: "collectStar",
      });
      this.starPos = null;
      this.hud.setStars(this.scoreState.stars);
    }
  }

  private dispatchMiss(): void {
    this.inputLog.record({ type: "out_of_bounds" }, performance.now());
    this.scoreState = reduceScoreEvent(this.scoreState, { type: "miss" });
    this.dragging = false;
    this.dragPt = null;
    this.trail.length = 0;
    this.rings.length = 0;
    this.comboFx = null;
    this.applyRunResult(this.runFsm.dispatch({ type: "outOfBounds" }));
    if (allowsContinue(this.runFsm.state.mode)) {
      this.applyRunResult(this.runFsm.dispatch({ type: "offerContinue" }));
    } else {
      this.applyRunResult(this.runFsm.dispatch({ type: "endRun" }));
    }
  }

  private applyContinueStub(): void {
    if (this.runFsm.runState !== "continue") return;
    if (!allowsContinue(this.runFsm.state.mode)) return;
    this.inputLog.record({ type: "continue_accept" }, performance.now());
    this.showHint = true;
    this.scoreState = reduceScoreEvent(this.scoreState, {
      type: "acceptContinue",
    });
    this.hud.hideContinue();
    this.applyRunResult(this.runFsm.dispatch({ type: "acceptContinue" }));
  }

  private declineContinue(): void {
    if (this.runFsm.runState !== "continue") return;
    this.inputLog.record({ type: "continue_decline" }, performance.now());
    this.hud.hideContinue();
    this.applyRunResult(this.runFsm.dispatch({ type: "declineContinue" }));
  }

  private handleDown(clientX: number, clientY: number, time: number): void {
    if (this.inMenu) return;

    if (this.challengeActive) {
      if (this.challengePhase === "dead" || this.challengePhase === "won") {
        this.challengeTapAdvance();
        return;
      }
      if (this.challengePhase !== "aim" || !this.source) return;
      const p = this.pointerCourt(clientX, clientY);
      if (hypot(p.x - this.source.x, p.y - this.source.y) > 130) return;
      this.aimOrigin = { x: this.source.x, y: this.source.y - 1 };
      this.dragging = true;
      this.dragPt = p;
      this.inputLog.record({ type: "pointer_down", x: p.x, y: p.y }, time);
      this.aim = aimFrom(this.aimOrigin, p, this.W, this.H);
      this.showHint = false;
      return;
    }

    if (this.runFsm.runState !== "aiming" || !this.source) return;
    const p = this.pointerCourt(clientX, clientY);
    if (hypot(p.x - this.source.x, p.y - this.source.y) > 160) return;
    this.aimOrigin = { x: this.source.x, y: this.source.y - 1 };
    this.dragging = true;
    this.dragPt = p;
    this.inputLog.record({ type: "pointer_down", x: p.x, y: p.y }, time);
    this.aim = aimFrom(this.aimOrigin, p, this.W, this.H);
    this.showHint = false;
  }

  private handleMove(clientX: number, clientY: number, time: number): void {
    const aiming = this.challengeActive
      ? this.challengePhase === "aim"
      : this.runFsm.runState === "aiming";
    if (!this.dragging || !aiming) return;
    const p = this.pointerCourt(clientX, clientY);
    this.dragPt = p;
    this.inputLog.record({ type: "pointer_move", x: p.x, y: p.y }, time);
    this.aim = aimFrom(this.aimOrigin, p, this.W, this.H);
  }

  private handleUp(clientX: number, clientY: number, time: number): void {
    const aiming = this.challengeActive
      ? this.challengePhase === "aim"
      : this.runFsm.runState === "aiming";
    if (!this.dragging || !aiming) return;
    const p = this.pointerCourt(clientX, clientY);
    this.dragPt = p;
    this.aim = aimFrom(this.aimOrigin, p, this.W, this.H);
    this.dragging = false;

    if (this.challengeActive) {
      if (hypot(this.aim.x, this.aim.y) < MIN_SHOT) {
        this.inputLog.record({ type: "pointer_up", x: p.x, y: p.y }, time);
        this.aim = { x: 0, y: 0, pull: 0 };
        if (this.challengeIdx === 0) this.showHint = true;
        return;
      }
      this.ball.x = this.aimOrigin.x;
      this.ball.y = this.aimOrigin.y;
      this.ball.vx = this.aim.x;
      this.ball.vy = this.aim.y;
      this.challengePhase = "flying";
      this.challengeFlightT = 0;
      this.challengeAttempts++;
      spawnLaunchRings(this.rings, this.ball.x, this.ball.y);
      kickNet(this.sourceNet, 5);
      this.inputLog.record(
        {
          type: "release",
          vx: this.aim.x,
          vy: this.aim.y,
          originX: this.aimOrigin.x,
          originY: this.aimOrigin.y,
          x: p.x,
          y: p.y,
        },
        time,
      );
      this.aim = { x: 0, y: 0, pull: 0 };
      this.dragPt = null;
      return;
    }

    const result = this.runFsm.dispatch({
      type: "release",
      vx: this.aim.x,
      vy: this.aim.y,
      originX: this.aimOrigin.x,
      originY: this.aimOrigin.y,
      minSpeed: MIN_SHOT,
    });
    if (!result.accepted) {
      this.inputLog.record({ type: "pointer_up", x: p.x, y: p.y }, time);
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
        x: p.x,
        y: p.y,
      },
      time,
    );
    this.applyRunResult(result);
    this.aim = { x: 0, y: 0, pull: 0 };
    this.dragPt = null;
  }

  private updateComboFx(dt: number): void {
    if (this.comboFx) {
      this.comboFx.t += dt;
      if (this.comboFx.t >= this.comboFx.dur) {
        this.comboFx = null;
      }
    }
    if (this.shake > 0) {
      this.shake *= Math.pow(0.008, dt);
      if (this.shake < 0.05) this.shake = 0;
    }
  }

  private update(time: number, delta: number): void {
    if (this.poseOverride) {
      this.drawFrame(time);
      return;
    }

    const dt = Math.min(delta / 1000, 0.033);
    this.updateComboFx(dt);

    if (this.inMenu) {
      this.drawFrame(time);
      return;
    }

    if (this.challengeActive) {
      this.updateChallenges(time, dt);
      this.stepNets(dt);
      this.drawFrame(time);
      return;
    }

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
      this.stepNets(dt);
      this.drawFrame(time);
      return;
    }

    if (this.source) this.source.wobble *= Math.pow(0.04, dt);
    if (this.target) this.target.wobble *= Math.pow(0.06, dt);

    // Keep obstacle kinematics / bumper pulse on the sim clock (pitch parity).
    this.worldT += dt;
    updateObstacles(this.worldT, this.obstacles, dt);

    if (this.runFsm.runState === "aiming" && this.source) {
      this.aimOrigin = { x: this.source.x, y: this.source.y - 1 };
      this.ball.x = this.aimOrigin.x;
      this.ball.y =
        this.aimOrigin.y + (this.dragging ? 0 : Math.sin(time / 260) * 1.2);
    }

    if (this.runFsm.runState === "scored" && this.target) {
      this.ball.x = this.target.x;
      this.ball.y = this.target.y - 1 + Math.sin(time / 120) * 0.8;
      const scoredAt = this.runFsm.state.scoredAtMs ?? time;
      if (time - scoredAt > 180) {
        this.applyRunResult(
          this.runFsm.dispatch({ type: "swishHoldComplete" }, time),
        );
      }
    }

    if (flying) {
      stepProjectileSubsteps(this.ball, dt, this.W);
      if (this.source) rimHit(this.source, this.ball);
      if (this.target) rimHit(this.target, this.ball);
      const hazard = collideObstacles(this.obstacles, this.ball, dt);
      this.tryCollectStar();

      if (hazard === "dead") {
        this.dispatchMiss();
      } else if (this.target && throughHoop(this.target, this.ball)) {
        this.onScore(time);
      } else if (
        this.ball.y > this.H + 90 ||
        this.ball.x < -120 ||
        this.ball.x > this.W + 120
      ) {
        this.dispatchMiss();
      }
    }

    this.stepNets(dt);
    this.drawFrame(time);
  }

  /** Challenges flight uses FIXED_DT stepWorld order (pitch / physics README). */
  private updateChallenges(time: number, dt: number): void {
    const flying = this.challengePhase === "flying";
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

    if (this.source) this.source.wobble *= Math.pow(0.04, dt);
    if (this.target) this.target.wobble *= Math.pow(0.06, dt);

    if (this.challengePhase === "aim" && this.source) {
      this.aimOrigin = { x: this.source.x, y: this.source.y - 1 };
      this.ball.x = this.aimOrigin.x;
      this.ball.y =
        this.aimOrigin.y + (this.dragging ? 0 : Math.sin(time / 260) * 1.2);
      this.worldT += dt;
      updateObstacles(this.worldT, this.obstacles, dt);
      return;
    }

    if (this.challengePhase === "won" && this.target) {
      this.ball.x = this.target.x;
      this.ball.y = this.target.y - 1 + Math.sin(time / 120) * 0.8;
      this.worldT += dt;
      updateObstacles(this.worldT, this.obstacles, dt);
      return;
    }

    if (this.challengePhase === "dead") {
      this.worldT += dt;
      updateObstacles(this.worldT, this.obstacles, dt);
      return;
    }

    if (!flying || !this.source || !this.target) return;

    let steps = Math.min(12, Math.ceil(dt / FIXED_DT));
    let acc = Math.min(dt, 0.05);
    while (steps-- > 0 && this.challengePhase === "flying") {
      const stepDt = Math.min(FIXED_DT, acc);
      if (stepDt <= 0) break;
      acc -= stepDt;
      this.challengeFlightT += stepDt;
      const world = {
        t: this.worldT,
        w: this.W,
        h: this.H,
        src: this.source,
        goal: this.target,
        stars: this.challengeStars,
        obs: this.obstacles,
      };
      const r = stepChallengeWorld(world, this.ball, stepDt);
      this.worldT = world.t;
      this.hud.setStars(this.challengeStarsCollected());
      if (r === "win") {
        this.onChallengeWin();
        break;
      }
      if (r === "dead") {
        this.onChallengeDead();
        break;
      }
      if (this.challengeFlightT > FLIGHT_TIMEOUT) {
        this.onChallengeDead();
        break;
      }
    }
  }

  private triggerComboPopup(chainLength: number): void {
    const label = comboLabel(chainLength);
    if (!label) return;
    this.comboFx = {
      label,
      sub: comboSubtext(chainLength),
      t: 0,
      dur: chainLength >= 3 ? 0.85 : 0.65,
    };
    this.shake = shakeIntensity(chainLength);
    if (this.target) {
      spawnLaunchRings(this.rings, this.target.x, this.target.y);
      spawnLaunchRings(this.rings, this.target.x, this.target.y - 8);
    }
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
    this.triggerComboPopup(this.scoreState.chainLength);
    this.hud.setStars(this.scoreState.stars);
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
    // Carry scored hoop's net; leave fades old source; arrive gets a fresh net.
    this.leaveNet = this.sourceNet;
    this.carryNet = this.targetNet;
    this.arriveNet = makeNet();
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
    this.sourceNet = this.carryNet ?? makeNet();
    this.targetNet = this.arriveNet ?? makeNet();
    this.leaveNet = null;
    this.carryNet = null;
    this.arriveNet = null;
    this.obstacles = next.obstacles;
    this.worldT = 0;
    updateObstacles(this.worldT, this.obstacles, 0);
    this.ball = next.ball;
    this.aimOrigin = next.aimOrigin;
    this.transition = null;
    this.aim = { x: 0, y: 0, pull: 0 };
    this.dragging = false;
    this.dragPt = null;
    this.applyShotStar(this.runFsm.state.score);
  }

  private stepNets(dt: number): void {
    const ball = this.ball;
    const local = (h: { x: number; y: number; ang: number }, x: number, y: number) =>
      hoopLocal({ ...h, wobble: 0 }, x, y);
    if (this.transition) {
      const tr = this.transition;
      if (this.leaveNet && tr.leave) {
        stepNetFor(this.leaveNet, tr.leave, ball, dt, local);
      }
      if (this.carryNet && tr.carry) {
        stepNetFor(this.carryNet, tr.carry, ball, dt, local);
      }
      if (this.arriveNet && tr.arrive) {
        stepNetFor(this.arriveNet, tr.arrive, ball, dt, local);
      }
      return;
    }
    if (this.source) {
      stepNetFor(this.sourceNet, this.source, ball, dt, local);
    }
    if (this.target) {
      stepNetFor(this.targetNet, this.target, ball, dt, local);
    }
  }

  private visualMode(): VisualMode {
    if (this.poseOverride) return this.poseOverride;
    if (this.inMenu) return "boot";
    if (this.challengeActive) {
      switch (this.challengePhase) {
        case "aim":
          return "aim";
        case "flying":
          return "flying";
        case "won":
          return "scored";
        case "dead":
          return "continue";
      }
    }
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
        leaveNet: this.leaveNet,
        arriveNet: this.arriveNet,
        carryNet: this.carryNet,
        oldObstacles: tr.oldObstacles,
        nextObstacles: tr.nextObstacles,
      };
    }

    const comboFxDraw = this.comboFx
      ? {
          label: this.comboFx.label,
          sub: this.comboFx.sub,
          life: this.comboFx.t / this.comboFx.dur,
        }
      : null;

    const challengeHud = this.challengeActive;
    return {
      W: this.W,
      H: this.H,
      timeMs,
      mode,
      score: challengeHud ? this.challengeIdx + 1 : this.scoreState.score,
      stars: challengeHud
        ? this.challengeStarsCollected()
        : this.scoreState.stars,
      combo: challengeHud ? 0 : this.scoreState.chainLength,
      safeTop: safeTopInset(),
      safeBottom: safeBottomInset(),
      ball: { x: this.ball.x, y: this.ball.y },
      source: this.source,
      target: this.target,
      sourceNet: mode === "transition" ? null : this.sourceNet,
      targetNet: mode === "transition" ? null : this.targetNet,
      sourcePull,
      obstacles: this.obstacles,
      star: challengeHud ? null : this.starPos,
      starOn: challengeHud
        ? false
        : !!this.scoreState.starActive && !!this.starPos,
      challengeStars: challengeHud ? this.challengeStars : undefined,
      tip: challengeHud
        ? this.challengePhase === "aim"
          ? `${this.challengeName} — ${this.challengeTip}`
          : this.challengeTip
        : null,
      drag: this.dragging,
      dragPt: this.dragPt,
      aimOrigin: this.aimOrigin,
      aimPull: this.aim.pull,
      maxPull: maxPull(this.W, this.H),
      predictDots,
      trail: this.trail,
      rings: this.rings,
      showHint: this.showHint && !challengeHud,
      comboChip: challengeHud ? null : chip,
      comboFx: challengeHud ? null : comboFxDraw,
      shake: this.shake,
      continueLabel:
        mode === "continue" || mode === "ended" || mode === "scored"
          ? this.continueLabel
          : null,
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
    kickNet(this.targetNet, 13);
    for (let i = 0; i < 24; i++) this.stepNets(1 / 60);
    this.scoreState = {
      ...this.scoreState,
      score: Math.max(1, this.scoreState.score),
    };
    this.drawFrame(performance.now());
  }
}
