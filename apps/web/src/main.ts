import { PlayLoop } from "./game/PlayLoop";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Trick Shot: #game canvas missing");
}

const loop = new PlayLoop(canvas);
loop.start();

const host = document.getElementById("phone") ?? canvas.parentElement ?? canvas;
const ro = new ResizeObserver(() => loop.resize());
ro.observe(host);
window.addEventListener("orientationchange", () => loop.resize());

if (import.meta.env.DEV) {
  (window as Window & { __trickshot?: PlayLoop }).__trickshot = loop;
}
