/** Pitch / reference palette — keep in sync with docs/animation-pitch.html */
export const COURT = "#e8e8ea";
export const ORANGE = "#ff4d1a";
export const GREY = "#5f646e";
export const CYAN = "#4ecbff";
export const STAR = "#ffc400";
export const STAR_LINE = "#ff9800";
export const RED = "#e53920";
/** Challenges kit — docs/challenges-pitch.html */
export const VIOLET = "#7c4dff";
export const GREEN = "#00b894";
export const GLASS = "#8fcbff";
export const LASER = "#ff2d55";

export type AmbientColors = {
  court: string;
  rail: string;
};

/** Difficulty-tier ambient court / rail tints (DunkShot-style mood). */
export function ambientForTier(tier: number): AmbientColors {
  switch (tier) {
    case 1:
      return { court: "#e8e8ea", rail: "rgba(90,96,110,0.14)" };
    case 2:
      return { court: "#ebe6dc", rail: "rgba(180,140,60,0.16)" };
    case 3:
      return { court: "#eadfd4", rail: "rgba(200,90,50,0.18)" };
    case 4:
      return { court: "#e4d0d8", rail: "rgba(140,50,120,0.2)" };
    case 5:
      return { court: "#d4c8dc", rail: "rgba(80,30,100,0.22)" };
    case 6:
    default:
      return { court: "#c8c8ce", rail: "rgba(40,40,50,0.28)" };
  }
}

/** @deprecated use STAR */
export const STAR_FILL = STAR;
/** @deprecated use RED */
export const OBSTACLE_RED = RED;
export const BALL_FILL = 0x1e5fff;
