export {
  CHALLENGE_LEVEL_COUNT,
  LEVELS,
  type ChallengeLevel,
  type LevelObsDef,
  type LevelPose,
} from "./levels.js";

export {
  makeWorld,
  type ChallengeStar,
  type ChallengeWorld,
} from "./make-world.js";

export {
  CHALLENGES_PROGRESS_KEY,
  emptyChallengesProgress,
  isChallengeUnlocked,
  loadChallengesProgress,
  recordChallengeClear,
  saveChallengesProgress,
  type ChallengesProgress,
  type ProgressStorage,
} from "./progress.js";

export {
  FLIGHT_TIMEOUT,
  SOLVE_ANGLES,
  SOLVE_PHASES,
  SOLVE_POWERS,
  challengePath,
  probe,
  runSim,
  solveAll,
  solveLevel,
  stepChallengeWorld,
  type SimResult,
  type SolveOptions,
  type SolveResult,
  type SolveShot,
} from "./solve.js";
