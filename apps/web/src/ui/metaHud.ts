import type { GameMode, RunSummary } from "@trickshot/shared";
import type { LeaderboardEntry } from "../meta/leaderboard";
import { continuesAllowedForMode } from "../meta/continuePolicy";
import { isMuted } from "../audio";
import {
  COSMETIC_PRESETS,
  equipPreset,
  getEquippedPresetId,
  getLifetimeStars,
  isPresetUnlocked,
  unlockAffordablePresets,
} from "../meta/cosmetics";

export type MetaHudCallbacks = {
  onSelectMode: (mode: GameMode) => void;
  onContinueStub: () => void;
  onEndRun: () => void;
  onDismissSummary: () => void;
  onPlayAgain: () => void;
  onToggleMute?: () => boolean;
  onEquipCosmetic?: (id: string) => void;
  onResume?: () => void;
  onQuitToMenu?: () => void;
};

/**
 * Mobile-first DOM overlays: landing / mode picker, miss/continue, run summary.
 * Kept out of the canvas so thumb targets stay CSS-safe-area friendly.
 */
export class MetaHud {
  readonly root: HTMLDivElement;
  private modeEl: HTMLDivElement;
  private continueEl: HTMLDivElement;
  private summaryEl: HTMLDivElement;
  private pauseEl: HTMLDivElement;
  private modeLabelEl: HTMLDivElement;
  private skinsEl: HTMLDivElement;
  private skinsToggle: HTMLButtonElement;
  private cbs: MetaHudCallbacks;

  constructor(parent: HTMLElement, cbs: MetaHudCallbacks) {
    this.cbs = cbs;
    this.root = document.createElement("div");
    this.root.id = "meta-hud";
    this.root.innerHTML = `
      <div class="meta-chip-row">
        <div class="meta-chip" id="meta-mode-label" hidden>CASUAL</div>
        <button type="button" class="meta-chip meta-mute" id="meta-mute-btn" aria-label="Toggle mute">🔊</button>
      </div>
      <div class="meta-landing" id="meta-mode" hidden>
        <div class="meta-landing-glow" aria-hidden="true"></div>
        <div class="meta-landing-brand">
          <h1 class="meta-brand">TRICK <span>SHOT</span></h1>
          <p class="meta-tagline">Drag. Dunk. Chain.</p>
        </div>
        <div class="meta-landing-actions">
          <button type="button" class="meta-play" data-mode="casual">Play</button>
          <div class="meta-modes" role="group" aria-label="Game modes">
            <button type="button" data-mode="daily">Daily</button>
            <button type="button" data-mode="challenges">Challenges</button>
            <button type="button" data-mode="tournament">Tournament</button>
          </div>
          <button type="button" class="meta-skins-toggle" id="meta-skins-toggle" aria-expanded="false">
            Skins
          </button>
          <div class="meta-cosmetics" id="meta-cosmetics" hidden>
            <div id="meta-cosmetics-list"></div>
          </div>
        </div>
      </div>
      <div class="meta-panel" id="meta-pause" hidden>
        <h2>PAUSED</h2>
        <p>Take a breath. Rim’s waiting.</p>
        <button type="button" id="meta-resume-btn">Resume</button>
        <button type="button" class="ghost" id="meta-quit-btn">Quit to menu</button>
      </div>
      <div class="meta-panel" id="meta-continue" hidden>
        <h2>MISS</h2>
        <p class="meta-stats" id="meta-continue-stats"></p>
        <button type="button" id="meta-continue-btn">Continue</button>
        <p class="meta-hint" id="meta-continue-hint">Sandbox stub — payments later</p>
        <button type="button" class="ghost" id="meta-end-btn">End run</button>
      </div>
      <div class="meta-panel" id="meta-summary" hidden>
        <h2>RUN OVER</h2>
        <pre id="meta-summary-body"></pre>
        <div id="meta-board"></div>
        <button type="button" id="meta-again-btn">Play again</button>
        <button type="button" class="ghost" id="meta-dismiss-btn">Close</button>
      </div>
    `;
    parent.appendChild(this.root);

    this.modeEl = this.root.querySelector("#meta-mode")!;
    this.continueEl = this.root.querySelector("#meta-continue")!;
    this.summaryEl = this.root.querySelector("#meta-summary")!;
    this.pauseEl = this.root.querySelector("#meta-pause")!;
    this.modeLabelEl = this.root.querySelector("#meta-mode-label")!;
    this.skinsEl = this.root.querySelector("#meta-cosmetics")!;
    this.skinsToggle = this.root.querySelector("#meta-skins-toggle")!;

    this.modeEl.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = (btn as HTMLElement).dataset.mode as GameMode;
        this.cbs.onSelectMode(mode);
      });
    });
    this.skinsToggle.addEventListener("click", () => {
      const open = this.skinsEl.hidden;
      this.skinsEl.hidden = !open;
      this.skinsToggle.setAttribute("aria-expanded", open ? "true" : "false");
      this.skinsToggle.classList.toggle("is-open", open);
    });
    this.root.querySelector("#meta-resume-btn")!.addEventListener("click", () => {
      this.cbs.onResume?.();
    });
    this.root.querySelector("#meta-quit-btn")!.addEventListener("click", () => {
      this.cbs.onQuitToMenu?.();
    });
    this.root.querySelector("#meta-continue-btn")!.addEventListener("click", () => {
      this.cbs.onContinueStub();
    });
    this.root.querySelector("#meta-end-btn")!.addEventListener("click", () => {
      this.cbs.onEndRun();
    });
    this.root.querySelector("#meta-again-btn")!.addEventListener("click", () => {
      this.cbs.onPlayAgain();
    });
    this.root.querySelector("#meta-dismiss-btn")!.addEventListener("click", () => {
      this.cbs.onDismissSummary();
    });
    const muteBtn = this.root.querySelector("#meta-mute-btn") as HTMLButtonElement;
    muteBtn.textContent = isMuted() ? "🔇" : "🔊";
    muteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const muted = this.cbs.onToggleMute?.() ?? false;
      muteBtn.textContent = muted ? "🔇" : "🔊";
    });
    this.refreshCosmetics();
  }

  refreshCosmetics(): void {
    unlockAffordablePresets();
    const list = this.root.querySelector("#meta-cosmetics-list");
    if (!list) return;
    const equipped = getEquippedPresetId();
    const stars = getLifetimeStars();
    list.innerHTML =
      COSMETIC_PRESETS.map((p) => {
        const unlocked = isPresetUnlocked(p.id);
        const on = equipped === p.id;
        const lock = unlocked ? "" : ` · ★${p.starCost}`;
        return `<button type="button" class="cosmetic-btn${on ? " is-on" : ""}" data-cosmetic="${p.id}" ${unlocked ? "" : "disabled"} style="--skin:${p.ballCss}">
          <span class="cosmetic-swatch" aria-hidden="true"></span>
          <span>${p.name}${on ? " · on" : ""}${lock}</span>
        </button>`;
      }).join("") + `<p class="meta-hint">Lifetime ★ ${stars}</p>`;
    list.querySelectorAll("[data-cosmetic]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = (btn as HTMLElement).dataset.cosmetic!;
        if (equipPreset(id)) {
          this.cbs.onEquipCosmetic?.(id);
          this.refreshCosmetics();
        }
      });
    });
  }

  /** Stars are drawn on the canvas HUD — DOM chip removed to avoid a duplicate. */
  setStars(_n: number): void {}

  setModeLabel(mode: GameMode, detail?: string): void {
    this.modeLabelEl.textContent = detail
      ? `${mode.toUpperCase()} · ${detail}`
      : mode.toUpperCase();
  }

  showModePicker(): void {
    this.continueEl.hidden = true;
    this.summaryEl.hidden = true;
    this.pauseEl.hidden = true;
    this.modeLabelEl.hidden = true;
    this.skinsEl.hidden = true;
    this.skinsToggle.setAttribute("aria-expanded", "false");
    this.skinsToggle.classList.remove("is-open");
    this.root.classList.add("is-landing");
    this.modeEl.hidden = false;
  }

  hideModePicker(): void {
    this.modeEl.hidden = true;
    this.root.classList.remove("is-landing");
    this.modeLabelEl.hidden = false;
  }

  showPause(): void {
    this.modeEl.hidden = true;
    this.root.classList.remove("is-landing");
    this.continueEl.hidden = true;
    this.summaryEl.hidden = true;
    this.pauseEl.hidden = false;
  }

  hidePause(): void {
    this.pauseEl.hidden = true;
  }

  showContinue(args: {
    mode: GameMode;
    score: number;
    stars: number;
    chainLength: number;
  }): void {
    this.modeEl.hidden = true;
    this.root.classList.remove("is-landing");
    this.modeLabelEl.hidden = false;
    this.pauseEl.hidden = true;
    this.summaryEl.hidden = true;
    this.continueEl.hidden = false;
    const stats = this.root.querySelector("#meta-continue-stats")!;
    stats.textContent = `Score ${args.score} · ★ ${args.stars} · Chain ${args.chainLength}`;

    const btn = this.root.querySelector("#meta-continue-btn") as HTMLButtonElement;
    const hint = this.root.querySelector("#meta-continue-hint") as HTMLElement;
    const allowed = continuesAllowedForMode(args.mode);
    btn.hidden = !allowed;
    hint.hidden = !allowed;
    if (!allowed) {
      hint.hidden = false;
      hint.textContent =
        args.mode === "challenges"
          ? "Challenges — tap / space to retry"
          : "Tournament — continues disabled";
    } else {
      hint.textContent = "Sandbox stub — payments later";
    }
  }

  hideContinue(): void {
    this.continueEl.hidden = true;
  }

  showSummary(summary: RunSummary, board: LeaderboardEntry[]): void {
    this.modeEl.hidden = true;
    this.root.classList.remove("is-landing");
    this.modeLabelEl.hidden = false;
    this.pauseEl.hidden = true;
    this.continueEl.hidden = true;
    this.summaryEl.hidden = false;
    const body = this.root.querySelector("#meta-summary-body")!;
    body.textContent = [
      `mode: ${summary.mode}`,
      `score: ${summary.score}`,
      `stars: ${summary.stars}`,
      `chain: ${summary.chainLength}`,
      `continues: ${summary.continuesUsed}`,
      `seed: ${summary.seed}`,
    ].join("\n");
    const boardEl = this.root.querySelector("#meta-board")!;
    if (summary.mode === "tournament" || board.length === 0) {
      boardEl.innerHTML = "";
      return;
    }
    boardEl.innerHTML =
      `<h3>Local ${summary.mode}</h3><ol>` +
      board
        .slice(0, 5)
        .map((e) => `<li>${e.score} · ★${e.stars} · x${e.chainLength}</li>`)
        .join("") +
      `</ol>`;
  }

  hideSummary(): void {
    this.summaryEl.hidden = true;
  }

  destroy(): void {
    this.root.remove();
  }
}
