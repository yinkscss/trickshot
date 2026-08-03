import { PlayLoop } from "./game/PlayLoop";
import "./styles/meta.css";
import { guardCeloNetwork } from "./services/auth.js";

// Fail fast when VITE_CELO_CHAIN_ID is not a supported Celo network.
guardCeloNetwork();


const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Trick Shot: #game canvas missing");
}

const hudParent =
  document.getElementById("phone") ?? canvas.parentElement ?? document.body;

const loop = new PlayLoop(canvas, hudParent);
loop.start();

const host = document.getElementById("phone") ?? canvas.parentElement ?? canvas;
const ro = new ResizeObserver(() => loop.resize());
ro.observe(host);
window.addEventListener("orientationchange", () => loop.resize());

if (import.meta.env.DEV) {
  (window as Window & { __trickshot?: PlayLoop }).__trickshot = loop;
}
