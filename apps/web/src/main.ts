import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";

const parent = document.getElementById("game");

new Phaser.Game({
  type: Phaser.AUTO,
  parent: parent ?? undefined,
  backgroundColor: "#cfd1d6",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene],
  banner: false,
});
