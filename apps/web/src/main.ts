import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { PlayScene } from "./scenes/PlayScene";
import "./styles/meta.css";

const parent = document.getElementById("game");

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: parent ?? undefined,
  backgroundColor: "#cfd1d6",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PlayScene],
  banner: false,
  input: {
    activePointers: 1,
  },
  disableContextMenu: true,
});

if (import.meta.env.DEV) {
  (window as Window & { __trickshot?: Phaser.Game }).__trickshot = game;
}