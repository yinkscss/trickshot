import Phaser from "phaser";

/**
 * Brief splash → PlayScene (custom 2D integrator / net-drag aim).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#cfd1d6");

    this.add
      .text(width / 2, height * 0.42, "TRICK SHOT", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontSize: `${Math.min(64, width * 0.14)}px`,
        fontStyle: "900",
        color: "#1a1c22",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.42 + 48, "loading…", {
        fontFamily: "Nunito, system-ui, sans-serif",
        fontSize: "16px",
        fontStyle: "800",
        color: "#ff5a1f",
      })
      .setOrigin(0.5);

    this.time.delayedCall(400, () => {
      this.scene.start("play");
    });
  }
}
