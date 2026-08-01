import { PlayLoop } from "./game/PlayLoop";
import "./styles/meta.css";
import { guardCeloSepolia } from "./services/auth.js";

// Development-time network guard: warns when VITE_CELO_CHAIN_ID doesn't match
// the locked Celo Sepolia testnet chain ID (11142220).
guardCeloSepolia();


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
