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
  ENDLESS_OBSTACLE_UNLOCK_ORDER,
  buildObstacles,
  generateShotLayout,
  layoutForSide,
  nextSide,
  shotRng,
  stepHoopOsc,
  unlockedObstacleTypes,
  type BumperObstacle,
  type EndlessObstacleType,
  type GenerateShotLayoutInput,
  type HoopOsc,
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
  assertPowerupAllowed,
  powerupsAllowed,
  type DropConstants,
  type HoopLayout,
  type PowerupModifiers,
} from "./powerups.js";

export {
  resolveRunSeed,
  type RunSeedContext,
} from "./run-seed.js";

export {
  tierFromDunks,
  tierLayoutModifiers,
  type DifficultyTier,
  type TierLayoutModifiers,
} from "./difficulty-tier.js";

export {
  buildRunSummary,
  classifyDunk,
  comboLabel,
  createScoreState,
  dunkPoints,
  dunkQualityLabel,
  DUNK_BASE_POINTS,
  reduceScoreEvent,
  shouldSpawnStar,
  STAR_GUARANTEE_BELOW_SCORE,
  STAR_POINTS,
  STAR_SPAWN_PROBABILITY,
  type ComboLabel,
  type DunkQuality,
  type ScoreEvent,
  type ScoreState,
} from "./scoring.js";

export {
  CHALLENGE_LEVEL_COUNT,
  CHALLENGES_PROGRESS_KEY,
  FLIGHT_TIMEOUT,
  LEVELS,
  SOLVE_ANGLES,
  SOLVE_PHASES,
  SOLVE_POWERS,
  challengePath,
  emptyChallengesProgress,
  isChallengeUnlocked,
  loadChallengesProgress,
  makeWorld,
  probe,
  recordChallengeClear,
  runSim,
  saveChallengesProgress,
  solveAll,
  solveLevel,
  stepChallengeWorld,
  type ChallengeLevel,
  type ChallengeStar,
  type ChallengeWorld,
  type ChallengesProgress,
  type LevelObsDef,
  type ProgressStorage,
  type SimResult,
  type SolveOptions,
  type SolveResult,
  type SolveShot,
} from "./challenges/index.js";
