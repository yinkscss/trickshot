export {
  RunFSM,
  RUN_TRANSITIONS,
  allowsContinue,
  createRunFSM,
  reduceRunFSM,
  restoreRunFSM,
  snapshotRunFSM,
  type PhysicsIntent,
  type RunEvent,
  type RunFSMResult,
  type RunFSMState,
  type RunFSMSnapshot,
  type RunFSMTransition,
  type RunState,
} from "./run-fsm.js";

export {
  createRng,
  dailySeedFromUtcDate,
  type Rng,
} from "./rng.js";

export {
  InputLogRecorder,
  createInputLogRecorder,
  type InputLogRecorderOptions,
  type RecordFrameResult,
} from "./input-log-recorder.js";

export {
  prepareShotFromSeed,
  replayRunFromInputLog,
  restoreRunFromReplaySnapshot,
  type ReplayRunResult,
} from "./input-log-replay.js";

export {
  buildObstacles,
  generateShotLayout,
  layoutForSide,
  nextSide,
  shotRng,
  type BumperObstacle,
  type GenerateShotLayoutInput,
  type HoopPose,
  type Obstacle,
  type ShotLayout,
  type Side,
  type Vec2,
  type WallObstacle,
} from "./shot-layout.js";

export {
  applySlowDrop,
  applyWideHoop,
  powerupsAllowed,
  type DropConstants,
  type HoopLayout,
  type PowerupModifiers,
} from "./powerups.js";

export {
  buildRunSummary,
  comboLabel,
  comboMultiplier,
  createScoreState,
  dunkPoints,
  DUNK_BASE_POINTS,
  reduceScoreEvent,
  shouldSpawnStar,
  STAR_GUARANTEE_BELOW_SCORE,
  STAR_POINTS,
  STAR_SPAWN_PROBABILITY,
  type ComboLabel,
  type ScoreEvent,
  type ScoreState,
} from "./scoring.js";
