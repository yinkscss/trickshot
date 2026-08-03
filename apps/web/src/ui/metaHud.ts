import type { GameMode, RunSummary } from "@trickshot/shared";
import type { LeaderboardEntry } from "../meta/leaderboard";
import { continuesAllowedForMode } from "../meta/continuePolicy";
import { getSession, type TrickshotSession } from "../services/auth";
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
  onLogin?: (email: string) => Promise<TrickshotSession>;
  onLogout?: () => Promise<void>;
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
  private accountButton: HTMLButtonElement;
  private accountPanel: HTMLDivElement;
  private loginForm: HTMLFormElement;
  private loginEmail: HTMLInputElement;
  private logoutButton: HTMLButtonElement;
  private accountStatus: HTMLParagraphElement;
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
        <div class="meta-account" id="meta-account">
          <button type="button" class="meta-chip meta-account-button" id="meta-account-btn">Sign in</button>
          <div class="meta-account-panel" id="meta-account-panel" hidden>
            <form id="meta-login-form">
              <label for="meta-login-email">Email</label>
              <input id="meta-login-email" name="email" type="email" autocomplete="email" required />
              <button type="submit">Continue</button>
            </form>
            <button type="button" id="meta-logout-btn" hidden>Sign out</button>
            <p id="meta-account-status" role="status" aria-live="polite"></p>
          </div>
        </div>
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
        <p class="meta-hint" id="meta-continue-hint" hidden></p>
        <button type="button" class="ghost" id="meta-end-btn">End run</button>
      </div>
      <div class="meta-panel" id="meta-summary" hidden>
        <h2>RESULTS</h2>
        <p class="meta-summary-mode" id="meta-summary-mode"></p>
        <div class="meta-stat-row" id="meta-summary-body"></div>
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
    this.accountButton = this.root.querySelector("#meta-account-btn")!;
    this.accountPanel = this.root.querySelector("#meta-account-panel")!;
    this.loginForm = this.root.querySelector("#meta-login-form")!;
    this.loginEmail = this.root.querySelector("#meta-login-email")!;
    this.logoutButton = this.root.querySelector("#meta-logout-btn")!;
    this.accountStatus = this.root.querySelector("#meta-account-status")!;
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
    this.accountButton.addEventListener("click", () => {
      this.accountPanel.hidden = !this.accountPanel.hidden;
      if (!this.accountPanel.hidden && !getSession()) this.loginEmail.focus();
    });
    this.loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.handleLogin();
    });
    this.logoutButton.addEventListener("click", () => {
      void this.handleLogout();
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
    this.setAuthSession(getSession());
    this.refreshCosmetics();
  }

  private async handleLogin(): Promise<void> {
    if (!this.cbs.onLogin) {
      this.accountStatus.textContent = "Login is unavailable";
      return;
    }
    const email = this.loginEmail.value.trim();
    if (!email) return;

    const submit = this.loginForm.querySelector("button[type=submit]") as HTMLButtonElement;
    submit.disabled = true;
    this.accountStatus.textContent = "Connecting...";
    try {
      const session = await this.cbs.onLogin(email);
      this.setAuthSession(session);
      this.accountPanel.hidden = true;
    } catch (error) {
      this.accountStatus.textContent = error instanceof Error ? error.message : "Login failed";
    } finally {
      submit.disabled = false;
    }
  }

  private async handleLogout(): Promise<void> {
    if (!this.cbs.onLogout) return;
    this.logoutButton.disabled = true;
    try {
      await this.cbs.onLogout();
      this.setAuthSession(null);
    } catch (error) {
      this.accountStatus.textContent = error instanceof Error ? error.message : "Logout failed";
    } finally {
      this.logoutButton.disabled = false;
    }
  }

  private setAuthSession(session: TrickshotSession | null): void {
    if (session) {
      this.accountButton.textContent = shortAddress(session.walletAddress);
      this.accountButton.title = session.walletAddress;
      this.loginForm.hidden = true;
      this.logoutButton.hidden = false;
      this.accountStatus.textContent = "Wallet connected";
      return;
    }
    this.accountButton.textContent = "Sign in";
    this.accountButton.removeAttribute("title");
    this.loginForm.hidden = false;
    this.logoutButton.hidden = true;
    this.accountStatus.textContent = "";
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
    if (!allowed) {
      hint.hidden = false;
      hint.textContent =
        args.mode === "challenges"
          ? "Tap or press space to retry"
          : "Continues are off in Tournament";
    } else {
      hint.hidden = true;
      hint.textContent = "";
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

    const modeEl = this.root.querySelector("#meta-summary-mode")!;
    modeEl.textContent = modeLabel(summary.mode);

    const body = this.root.querySelector("#meta-summary-body")!;
    body.innerHTML = [
      statCell(String(summary.score), "Score"),
      statCell(`★ ${summary.stars}`, "Stars"),
      statCell(
        summary.chainLength > 0 ? `x${summary.chainLength}` : "—",
        "Best chain",
      ),
    ].join("");

    const boardEl = this.root.querySelector("#meta-board")!;
    if (summary.mode === "tournament" || board.length === 0) {
      boardEl.innerHTML = "";
      return;
    }
    boardEl.innerHTML =
      `<h3>Top scores</h3><ol class="meta-board-list">` +
      board
        .slice(0, 5)
        .map(
          (e, i) =>
            `<li><span class="meta-board-rank">${i + 1}</span><span class="meta-board-score">${e.score}</span><span class="meta-board-meta">★${e.stars}${e.chainLength > 0 ? ` · x${e.chainLength}` : ""}</span></li>`,
        )
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

function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

function modeLabel(mode: GameMode): string {
  switch (mode) {
    case "casual":
      return "Casual";
    case "daily":
      return "Daily challenge";
    case "challenges":
      return "Challenges";
    case "tournament":
      return "Tournament";
    default:
      return mode;
  }
}

function statCell(value: string, label: string): string {
  return `<div class="meta-stat"><strong>${value}</strong><span>${label}</span></div>`;
}
