<!-- ============================================
     DiceRoller.svelte — Dice Roller sub app
     
     Quick-pick standard dice, custom dice input,
     rolling history. Listens on the event bus
     for roll requests from other sub apps.
     ============================================ -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { eventBus } from "../../lib/eventBus";
  import { STANDARD_DICE, parseDice, rollDice, parseAndRoll } from "../../lib/dice";
  import type { RollResult } from "../../lib/dice";
  import type { BusMessage } from "../../lib/types";

  /** Custom dice string input */
  let customInput = "";

  /** Rolling history (most recent first) */
  let history: Array<{ result: RollResult; timestamp: number }> = [];
  const MAX_HISTORY = 20;

  /** Last roll result — shown prominently */
  let lastResult: RollResult | null = null;

  /** Flash animation trigger */
  let flashKey = 0;

  function doRoll(diceStr: string, respondTo?: string) {
    const result = parseAndRoll(diceStr);
    if (!result) return;

    lastResult = result;
    flashKey++;
    history = [{ result, timestamp: Date.now() }, ...history].slice(0, MAX_HISTORY);

    // Broadcast result on the bus
    eventBus.send({
      target: respondTo || "*",
      source: "diceRoller",
      action: "rollResult",
      dice: result.roll.input,
      result: result.total,
      rolls: result.rolls,
      modifier: result.roll.modifier,
    });
  }

  function rollStandard(dice: string) {
    doRoll(dice);
  }

  function rollCustom() {
    if (!customInput.trim()) return;
    doRoll(customInput.trim());
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") rollCustom();
  }

  function clearHistory() {
    history = [];
    lastResult = null;
  }

  // Listen for incoming roll requests from other sub apps
  let unsubscribe: () => void;

  onMount(() => {
    unsubscribe = eventBus.subscribe("diceRoller", (msg: BusMessage) => {
      if (msg.action === "roll" && typeof msg.dice === "string") {
        doRoll(msg.dice, msg.source as string | undefined);
      }
    });
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });

  /** Format modifier for display */
  function fmtMod(mod: number): string {
    if (mod === 0) return "";
    return mod > 0 ? `+${mod}` : `${mod}`;
  }
</script>

<div class="dice-roller">
  <!-- Big result display -->
  {#if lastResult}
    {#key flashKey}
      <div class="result-display">
        <span class="result-total">{lastResult.total}</span>
        <span class="result-detail">
          {lastResult.roll.input} → [{lastResult.rolls.join(", ")}]{fmtMod(lastResult.roll.modifier)}
        </span>
      </div>
    {/key}
  {:else}
    <div class="result-display empty">
      <span class="result-total">—</span>
      <span class="result-detail">Pick a die or type a roll</span>
    </div>
  {/if}

  <!-- Quick-pick dice buttons -->
  <div class="dice-grid">
    {#each STANDARD_DICE as dice}
      <button class="dice-btn" on:click={() => rollStandard(dice)}>
        {dice}
      </button>
    {/each}
  </div>

  <!-- Custom input -->
  <div class="custom-row">
    <input
      type="text"
      bind:value={customInput}
      on:keydown={handleKeydown}
      placeholder="2D8+3"
      class="custom-input"
    />
    <button class="roll-btn" on:click={rollCustom}>Roll</button>
  </div>

  <!-- History -->
  {#if history.length > 0}
    <div class="history-header">
      <span class="history-title">History</span>
      <button class="clear-btn" on:click={clearHistory}>Clear</button>
    </div>
    <div class="history-list">
      {#each history as entry (entry.timestamp)}
        <div class="history-item">
          <span class="hist-dice">{entry.result.roll.input}</span>
          <span class="hist-rolls">[{entry.result.rolls.join(",")}]{fmtMod(entry.result.roll.modifier)}</span>
          <span class="hist-total">= {entry.result.total}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dice-roller {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ---- Result display ---- */
  .result-display {
    text-align: center;
    padding: 16px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .result-display.empty { opacity: 0.5; }

  .result-total {
    display: block;
    font-size: 48px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
    font-family: var(--font-heading);
  }

  .result-detail {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-dim);
  }

  /* ---- Dice grid ---- */
  .dice-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    gap: 4px;
  }

  .dice-btn {
    height: 36px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .dice-btn:hover {
    border-color: var(--accent-dim);
    color: var(--accent);
  }

  .dice-btn:active {
    background: var(--border);
  }

  /* ---- Custom input row ---- */
  .custom-row {
    display: flex;
    gap: 6px;
  }

  .custom-input {
    flex: 1;
    font-size: 14px;
    text-transform: uppercase;
  }

  .roll-btn {
    padding: 6px 16px;
    font-weight: 600;
    color: var(--accent);
    border-color: var(--accent-dim);
  }

  .roll-btn:hover {
    background: rgba(200, 169, 110, 0.12);
  }

  /* ---- History ---- */
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
  }

  .history-title {
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .clear-btn {
    font-size: 11px;
    padding: 2px 8px;
    border: none;
    background: transparent;
    color: var(--text-dim);
  }

  .clear-btn:hover {
    color: var(--danger);
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 160px;
    overflow-y: auto;
  }

  .history-item {
    display: flex;
    gap: 8px;
    align-items: baseline;
    padding: 3px 6px;
    font-size: 12px;
    border-radius: 2px;
    background: var(--bg);
  }

  .hist-dice {
    color: var(--text);
    font-weight: 600;
    min-width: 48px;
  }

  .hist-rolls {
    color: var(--text-dim);
    flex: 1;
  }

  .hist-total {
    color: var(--accent);
    font-weight: 600;
  }
</style>
