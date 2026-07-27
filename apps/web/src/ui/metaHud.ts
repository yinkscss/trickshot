import type { GameMode, RunSummary } from "@trickshot/shared";
import type { LeaderboardEntry } from "../meta/leaderboard";
import { continuesAllowedForMode } from "../meta/continuePolicy";

export type MetaHudCallbacks = {
  onSelectMode: (mode: GameMode) => void;
  onContinueStub: () => void;
  onEndRun: () => void;
  onDismissSummary: () => void;
  onPlayAgain: () => void;
};

/**
 * Mobile-first DOM overlays: mode picker, miss/continue, run summary + board.
 * Kept out of Phaser so thumb targets stay CSS-safe-area friendly.
 */
export class MetaHud {
  readonly root: HTMLDivElement;
  private modeEl: HTMLDivElement;
  private continueEl: HTMLDivElement;
  private summaryEl: HTMLDivElement;
  private modeLabelEl: HTMLDivElement;
  private cbs: MetaHudCallbacks;

  constructor(parent: HTMLElement, cbs: MetaHudCallbacks) {
    this.cbs = cbs;
    this.root = document.createElement("div");
    this.root.id = "meta-hud";
    this.root.innerHTML = `
      <div class="meta-chip-row">
        <div class="meta-chip" id="meta-mode-label">CASUAL</div>
      </div>
      <div class="meta-panel" id="meta-mode" hidden>
        <h2>PLAY</h2>
        <p>Mobile-first chain dunks. Pick a mode.</p>
        <button type="button" data-mode="casual">Casual</button>
        <button type="button" data-mode="daily">Daily challenge</button>
        <button type="button" data-mode="challenges">Challenges</button>
        <button type="button" data-mode="tournament" class="ghost">Tournament (no continues)</button>
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
    this.modeLabelEl = this.root.querySelector("#meta-mode-label")!;

    this.modeEl.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = (btn as HTMLElement).dataset.mode as GameMode;
        this.cbs.onSelectMode(mode);
      });
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
    this.modeEl.hidden = false;
  }

  hideModePicker(): void {
    this.modeEl.hidden = true;
  }

  showContinue(args: {
    mode: GameMode;
    score: number;
    stars: number;
    chainLength: number;
  }): void {
    this.modeEl.hidden = true;
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
