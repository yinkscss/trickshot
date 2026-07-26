import Phaser from "phaser";
import {
  CELO_SEPOLIA_CHAIN_ID,
  TOURNAMENT_ALLOWS_CONTINUES,
} from "@trickshot/shared";

/**
 * Scaffold boot screen. Alpha will replace this with pitch-parity PlayScene
 * (custom 2D integrator, net drag, wall banks, one obstacle, seamless handoff).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#cfd1d6");

    this.add
      .text(width / 2, height * 0.38, "TRICK SHOT", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontSize: `${Math.min(64, width * 0.14)}px`,
        fontStyle: "900",
        color: "#1a1c22",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.38 + 52, "PWA scaffold · Celo Sepolia", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontSize: "16px",
        fontStyle: "800",
        color: "#ff5a1f",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height * 0.55,
        [
          "Pitch parity lands in Alpha:",
          "net drag · wall banks · 1 obstacle · combo juice",
          "",
          `chainId ${CELO_SEPOLIA_CHAIN_ID}`,
          `tournament continues: ${TOURNAMENT_ALLOWS_CONTINUES ? "on" : "off"}`,
        ].join("\n"),
        {
          fontFamily: "Nunito, system-ui, sans-serif",
          fontSize: "14px",
          fontStyle: "700",
          color: "#4a4e5a",
          align: "center",
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5);

    this.scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      this.cameras.resize(gameSize.width, gameSize.height);
    });
  }
}
