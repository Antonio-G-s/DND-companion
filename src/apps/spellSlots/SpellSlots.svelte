<!-- ============================================
     SpellSlots.svelte — Spell Slot Tracker v2
     
     Features:
     - Standard spell slot groups (long rest)
     - Warlock / Pact Magic slots (short rest)
     - Custom ability trackers with color picker
       (e.g. Channel Divinity, Ki Points, etc.)
     - Multiclass support
     ============================================ -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { eventBus } from "../../lib/eventBus";
  import type { BusMessage } from "../../lib/types";

  /** Recovery type determines when slots reset */
  type Recovery = "longRest" | "shortRest";

  /** A spell slot group (one class). */
  interface SlotGroup {
    name: string;
    recovery: Recovery;
    levels: number[];        // slots per level (index 0 = lvl 1)
    used: boolean[][];       // used[levelIdx][slotIdx]
  }

  /** A custom ability tracker (Ki, Channel Divinity, etc.) */
  interface CustomTracker {
    name: string;
    total: number;
    used: boolean[];
    color: string;           // hex color for the glow
    recovery: Recovery;
  }

  // ---- State ----
  let mode: "config" | "tracker" = "config";
  let groups: SlotGroup[] = [];
  let customTrackers: CustomTracker[] = [];
  let multiclass = false;

  // ---- Config form: slot group ----
  let configName = "";
  let configRecovery: Recovery = "longRest";
  let configLevels: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  // ---- Config form: custom tracker ----
  let customName = "";
  let customTotal = 1;
  let customColor = "#c8a96e";
  let customRecovery: Recovery = "longRest";
  let showCustomForm = false;

  // ---- Lifecycle ----
  let unsubscribe: () => void;
  let saveStatus = "";

  onMount(() => {
    // Try to load saved config
    loadFromStorage();

    unsubscribe = eventBus.subscribe("spellSlots", (msg: BusMessage) => {
      if (msg.action === "shortRest") shortRest();
      if (msg.action === "longRest") longRest();
    });
  });
  onDestroy(() => { if (unsubscribe) unsubscribe(); });

  // ============ SAVE / LOAD / EXPORT ============

  /** Serializable save format */
  interface SaveData {
    groups: Array<{
      name: string;
      recovery: Recovery;
      levels: number[];
      used: boolean[][];
    }>;
    customTrackers: Array<{
      name: string;
      total: number;
      used: boolean[];
      color: string;
      recovery: Recovery;
    }>;
    multiclass: boolean;
  }

  function buildSaveData(): SaveData {
    return {
      groups: groups.map((g) => ({
        name: g.name,
        recovery: g.recovery,
        levels: g.levels,
        used: g.used,
      })),
      customTrackers: customTrackers.map((t) => ({
        name: t.name,
        total: t.total,
        used: t.used,
        color: t.color,
        recovery: t.recovery,
      })),
      multiclass,
    };
  }

  function applySaveData(data: SaveData) {
    groups = data.groups || [];
    customTrackers = data.customTrackers || [];
    multiclass = data.multiclass || false;
    if (groups.length > 0 || customTrackers.length > 0) {
      mode = "tracker";
    }
  }

  /** Save to browser storage */
  function saveToStorage() {
    try {
      const json = JSON.stringify(buildSaveData());
      window.localStorage.setItem("dnd-spellslots", json);
      saveStatus = "Saved!";
      setTimeout(() => { saveStatus = ""; }, 1500);
    } catch {
      saveStatus = "Save failed";
    }
  }

  /** Load from browser storage */
  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem("dnd-spellslots");
      if (raw) {
        const data = JSON.parse(raw) as SaveData;
        applySaveData(data);
      }
    } catch {
      // No saved data or parse error — start fresh
    }
  }

  /** Export config as a downloadable JSON file */
  function exportConfig() {
    const json = JSON.stringify(buildSaveData(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spellslots-config.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Import config from a JSON file */
  function importConfig() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as SaveData;
        applySaveData(data);
        saveToStorage();
      } catch {
        console.error("Invalid spell slots config file");
      }
    };
    input.click();
  }

  // ============ CONFIG HELPERS ============

  function resetSlotForm() {
    configName = "";
    configRecovery = "longRest";
    configLevels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  function addGroup() {
    const name = multiclass
      ? (configName.trim() || `Class ${groups.length + 1}`)
      : (configRecovery === "shortRest" ? "Pact Magic" : "Spell Slots");

    groups = [...groups, {
      name,
      recovery: configRecovery,
      levels: [...configLevels],
      used: configLevels.map((c) => new Array(c).fill(false)),
    }];
    resetSlotForm();
  }

  function removeGroup(idx: number) {
    groups = groups.filter((_, i) => i !== idx);
  }

  function addCustomTracker() {
    if (!customName.trim() || customTotal < 1) return;
    customTrackers = [...customTrackers, {
      name: customName.trim(),
      total: customTotal,
      used: new Array(customTotal).fill(false),
      color: customColor,
      recovery: customRecovery,
    }];
    customName = "";
    customTotal = 1;
    customColor = "#c8a96e";
    customRecovery = "longRest";
    showCustomForm = false;
  }

  function removeCustom(idx: number) {
    customTrackers = customTrackers.filter((_, i) => i !== idx);
  }

  function finishConfig() {
    if (configLevels.some((c) => c > 0)) addGroup();
    if (groups.length === 0 && customTrackers.length === 0) return;
    mode = "tracker";
  }

  function editConfig() { mode = "config"; }

  function clearAll() {
    groups = [];
    customTrackers = [];
    mode = "config";
    resetSlotForm();
  }

  // ============ PRESETS ============

  function presetFullCaster() {
    configRecovery = "longRest";
    configLevels = [4, 3, 3, 3, 3, 2, 2, 1, 1, 0];
  }

  function presetHalfCaster() {
    configRecovery = "longRest";
    configLevels = [4, 3, 3, 2, 1, 0, 0, 0, 0, 0];
  }

  function presetWarlock(level: number) {
    configRecovery = "shortRest";
    configName = "Warlock";
    // Warlock slot progression (simplified)
    const slotLevel = level <= 2 ? 1 : level <= 4 ? 2 : level <= 6 ? 3 : level <= 8 ? 4 : 5;
    const slotCount = level === 1 ? 1 : level <= 10 ? 2 : level <= 16 ? 3 : 4;
    configLevels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    configLevels[slotLevel - 1] = slotCount;
  }

  // ============ TRACKER ACTIONS ============

  function toggleSlot(gi: number, li: number, si: number) {
    groups[gi].used[li][si] = !groups[gi].used[li][si];
    groups = groups;
    saveToStorage();
  }

  function toggleCustom(ci: number, si: number) {
    customTrackers[ci].used[si] = !customTrackers[ci].used[si];
    customTrackers = customTrackers;
    saveToStorage();
  }

  /** Short rest: restore only shortRest groups and custom trackers */
  function shortRest() {
    for (const g of groups) {
      if (g.recovery === "shortRest") {
        g.used = g.levels.map((c) => new Array(c).fill(false));
      }
    }
    for (const t of customTrackers) {
      if (t.recovery === "shortRest") {
        t.used = new Array(t.total).fill(false);
      }
    }
    groups = groups;
    customTrackers = customTrackers;
    saveToStorage();
  }

  /** Long rest: restore everything */
  function longRest() {
    for (const g of groups) {
      g.used = g.levels.map((c) => new Array(c).fill(false));
    }
    for (const t of customTrackers) {
      t.used = new Array(t.total).fill(false);
    }
    groups = groups;
    customTrackers = customTrackers;
    saveToStorage();
  }

  // ============ DISPLAY HELPERS ============

  function availableCount(g: SlotGroup): number {
    let n = 0;
    for (let l = 0; l < g.levels.length; l++)
      for (let s = 0; s < g.levels[l]; s++)
        if (!g.used[l][s]) n++;
    return n;
  }

  function totalCount(g: SlotGroup): number {
    return g.levels.reduce((s, c) => s + c, 0);
  }

  function customAvailable(t: CustomTracker): number {
    return t.used.filter((u) => !u).length;
  }

  function recoveryLabel(r: Recovery): string {
    return r === "shortRest" ? "Short Rest" : "Long Rest";
  }

  /** Convert hex to rgba for glow effects */
  function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
</script>

<div class="spell-slots">
  {#if mode === "config"}
    <!-- ==================== CONFIG MODE ==================== -->
    <div class="config-section">
      <div class="config-header">
        <span class="section-title">Spell Slots</span>
        <div class="header-btns">
          <button class="small-action" on:click={importConfig}>Import</button>
          <button class="small-action" on:click={exportConfig}>Export</button>
          <label class="multi-toggle">
            <input type="checkbox" bind:checked={multiclass} />
            Multiclass
          </label>
        </div>
      </div>

      <!-- Already-added groups -->
      {#if groups.length > 0}
        <div class="added-groups">
          {#each groups as group, gi (gi)}
            <div class="added-group">
              <span class="group-tag">{group.name}</span>
              <span class="recovery-badge" class:short={group.recovery === "shortRest"}>
                {group.recovery === "shortRest" ? "SR" : "LR"}
              </span>
              <span class="group-summary">
                {group.levels.map((c, i) => c > 0 ? `L${i+1}:${c}` : "").filter(Boolean).join(" ")}
              </span>
              <button class="remove-btn" on:click={() => removeGroup(gi)}>✕</button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Slot input form -->
      <div class="slot-form">
        {#if multiclass}
          <label class="field-label">
            Class Name
            <input type="text" bind:value={configName} placeholder="e.g. Wizard" />
          </label>
        {/if}

        <div class="recovery-row">
          <span class="field-hint">Recovery:</span>
          <label class="radio-label">
            <input type="radio" bind:group={configRecovery} value="longRest" /> Long Rest
          </label>
          <label class="radio-label">
            <input type="radio" bind:group={configRecovery} value="shortRest" /> Short Rest (Warlock)
          </label>
        </div>

        <!-- Presets -->
        <div class="presets-row">
          <span class="field-hint">Presets:</span>
          <button class="preset-btn" on:click={presetFullCaster}>Full Caster</button>
          <button class="preset-btn" on:click={presetHalfCaster}>Half Caster</button>
          <button class="preset-btn warlock" on:click={() => presetWarlock(5)}>Warlock 5</button>
          <button class="preset-btn warlock" on:click={() => presetWarlock(10)}>Warlock 10</button>
        </div>

        <!-- Level inputs -->
        <div class="level-grid">
          {#each configLevels as _, i}
            <div class="level-input">
              <label class="level-label">Lvl {i + 1}</label>
              <input type="number" min="0" max="20" bind:value={configLevels[i]} class="level-num" />
            </div>
          {/each}
        </div>

        <div class="form-actions">
          {#if multiclass}
            <button class="action-btn" on:click={addGroup}>Add Class</button>
          {/if}
        </div>
      </div>

      <!-- ---- Custom Trackers Config ---- -->
      <div class="custom-section">
        <div class="config-header">
          <span class="section-title">Custom Abilities</span>
          <button class="add-custom-btn" on:click={() => showCustomForm = !showCustomForm}>
            {showCustomForm ? "Cancel" : "+ Add"}
          </button>
        </div>

        {#if showCustomForm}
          <div class="custom-form">
            <label class="field-label">
              Name
              <input type="text" bind:value={customName} placeholder="e.g. Channel Divinity" />
            </label>

            <div class="custom-form-row">
              <label class="field-label narrow">
                Uses
                <input type="number" min="1" max="30" bind:value={customTotal} class="level-num" />
              </label>

              <label class="field-label narrow">
                Color
                <div class="color-picker-wrap">
                  <input type="color" bind:value={customColor} class="color-input" />
                  <span class="color-hex">{customColor}</span>
                </div>
              </label>
            </div>

            <div class="recovery-row">
              <span class="field-hint">Recovery:</span>
              <label class="radio-label">
                <input type="radio" bind:group={customRecovery} value="longRest" /> Long Rest
              </label>
              <label class="radio-label">
                <input type="radio" bind:group={customRecovery} value="shortRest" /> Short Rest
              </label>
            </div>

            <button class="action-btn primary" on:click={addCustomTracker} disabled={!customName.trim()}>
              Add Tracker
            </button>
          </div>
        {/if}

        {#if customTrackers.length > 0}
          <div class="added-groups">
            {#each customTrackers as ct, ci (ci)}
              <div class="added-group">
                <span class="custom-dot" style="background:{ct.color};"></span>
                <span class="group-tag">{ct.name}</span>
                <span class="recovery-badge" class:short={ct.recovery === "shortRest"}>
                  {ct.recovery === "shortRest" ? "SR" : "LR"}
                </span>
                <span class="group-summary">×{ct.total}</span>
                <button class="remove-btn" on:click={() => removeCustom(ci)}>✕</button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Start button -->
      <button
        class="action-btn primary start-btn"
        on:click={finishConfig}
        disabled={(groups.length === 0 && !configLevels.some((c) => c > 0)) && customTrackers.length === 0}
      >
        Start Tracking
      </button>
    </div>

  {:else}
    <!-- ==================== TRACKER MODE ==================== -->
    <div class="tracker-section">
      <div class="tracker-controls">
        <button class="action-btn short-rest-btn" on:click={shortRest}>Short Rest</button>
        <button class="action-btn" on:click={longRest}>Long Rest</button>
        <button class="action-btn" on:click={saveToStorage}>Save</button>
        <button class="action-btn" on:click={exportConfig}>Export</button>
        <button class="action-btn" on:click={editConfig}>Edit</button>
        <button class="action-btn danger-btn" on:click={clearAll}>Clear</button>
        {#if saveStatus}
          <span class="save-status">{saveStatus}</span>
        {/if}
      </div>

      <!-- Spell slot groups -->
      {#each groups as group, gi (gi)}
        <div class="slot-group">
          <div class="group-header">
            <span class="group-name">
              {group.name}
              {#if group.recovery === "shortRest"}
                <span class="sr-tag">SR</span>
              {/if}
            </span>
            <span class="group-count">{availableCount(group)}/{totalCount(group)}</span>
          </div>

          <div class="levels-container">
            {#each group.levels as slotCount, li}
              {#if slotCount > 0}
                <div class="level-row">
                  <span class="level-tag">Lvl {li + 1}</span>
                  <div class="slot-buttons">
                    {#each group.used[li] as isUsed, si}
                      <button
                        class="slot-btn"
                        class:used={isUsed}
                        class:available={!isUsed}
                        class:pact={group.recovery === "shortRest"}
                        on:click={() => toggleSlot(gi, li, si)}
                        title={isUsed ? "Click to restore" : `Level ${li+1} slot — click to use`}
                      >
                        <span class="slot-inner"></span>
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/each}

      <!-- Custom ability trackers -->
      {#each customTrackers as tracker, ci (ci)}
        <div class="slot-group custom-group">
          <div class="group-header">
            <span class="group-name">
              <span class="custom-dot-sm" style="background:{tracker.color};"></span>
              {tracker.name}
              {#if tracker.recovery === "shortRest"}
                <span class="sr-tag">SR</span>
              {/if}
            </span>
            <span class="group-count">{customAvailable(tracker)}/{tracker.total}</span>
          </div>

          <div class="slot-buttons custom-buttons">
            {#each tracker.used as isUsed, si}
              <button
                class="slot-btn custom-slot"
                class:used={isUsed}
                class:available={!isUsed}
                style="
                  {!isUsed ? `
                    border-color: ${hexToRgba(tracker.color, 0.5)};
                    box-shadow: 0 0 8px ${hexToRgba(tracker.color, 0.3)}, inset 0 0 6px ${hexToRgba(tracker.color, 0.1)};
                  ` : ''}
                "
                on:click={() => toggleCustom(ci, si)}
                title={isUsed ? "Click to restore" : `${tracker.name} — click to use`}
              >
                <span
                  class="slot-inner"
                  style="{!isUsed ? `background:${tracker.color}; box-shadow: 0 0 6px ${hexToRgba(tracker.color, 0.6)};` : ''}"
                ></span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .spell-slots {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    font-family: var(--font-heading);
    font-size: 12px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* ======== SHARED ======== */
  .config-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-btns {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .small-action {
    font-size: 11px;
    padding: 2px 8px;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
  }
  .small-action:hover { color: var(--accent); border-color: var(--accent-dim); }

  .save-status {
    font-size: 11px;
    color: var(--success);
    margin-left: 4px;
  }

  .multi-toggle, .radio-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-dim);
    cursor: pointer;
  }

  .recovery-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .field-hint {
    font-size: 11px;
    color: var(--text-dim);
  }

  .field-label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .field-label input[type="text"],
  .field-label input[type="number"] {
    font-size: 13px;
    text-transform: none;
  }

  .field-label.narrow { flex: 0 0 auto; }

  .added-groups {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  .added-group {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 12px;
  }

  .group-tag {
    color: var(--accent);
    font-weight: 600;
  }

  .group-summary {
    color: var(--text-dim);
    flex: 1;
  }

  .recovery-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 2px;
    background: rgba(200, 169, 110, 0.15);
    color: var(--accent);
  }

  .recovery-badge.short {
    background: rgba(100, 180, 255, 0.15);
    color: #64b4ff;
  }

  .remove-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 11px;
    padding: 0 4px;
    cursor: pointer;
  }
  .remove-btn:hover { color: var(--danger); }

  .custom-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .custom-dot-sm {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 4px;
    vertical-align: middle;
  }

  /* ======== CONFIG: SLOT FORM ======== */
  .slot-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
  }

  .presets-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .preset-btn {
    font-size: 11px;
    padding: 3px 8px;
    color: var(--text-dim);
    background: var(--bg);
    border: 1px solid var(--border);
  }
  .preset-btn:hover {
    color: var(--accent);
    border-color: var(--accent-dim);
  }
  .preset-btn.warlock:hover {
    color: #64b4ff;
    border-color: rgba(100, 180, 255, 0.4);
  }

  .level-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
  }

  .level-input {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .level-label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
  }

  .level-num {
    width: 48px;
    text-align: center;
    padding: 4px;
    font-size: 14px;
    font-weight: 600;
  }

  .form-actions {
    display: flex;
    gap: 6px;
  }

  .action-btn {
    padding: 6px 14px;
    font-size: 12px;
    color: var(--text);
    border: 1px solid var(--border);
    background: var(--bg-input);
  }
  .action-btn:hover { border-color: var(--border-focus); }
  .action-btn.primary {
    color: var(--accent);
    border-color: var(--accent-dim);
  }
  .action-btn.primary:hover { background: rgba(200, 169, 110, 0.1); }
  .action-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .danger-btn:hover { color: var(--danger); border-color: var(--danger); }

  .short-rest-btn {
    color: #64b4ff;
    border-color: rgba(100, 180, 255, 0.3);
  }
  .short-rest-btn:hover {
    background: rgba(100, 180, 255, 0.08);
    border-color: rgba(100, 180, 255, 0.5);
  }

  .start-btn { margin-top: 6px; }

  /* ======== CONFIG: CUSTOM TRACKERS ======== */
  .custom-section {
    margin-top: 8px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }

  .add-custom-btn {
    font-size: 11px;
    padding: 3px 10px;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border);
  }
  .add-custom-btn:hover { color: var(--accent); border-color: var(--accent-dim); }

  .custom-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    padding: 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .custom-form-row {
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }

  .color-picker-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .color-input {
    width: 32px;
    height: 28px;
    padding: 1px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-input);
    cursor: pointer;
  }
  .color-input::-webkit-color-swatch-wrapper { padding: 2px; }
  .color-input::-webkit-color-swatch { border: none; border-radius: 2px; }

  .color-hex {
    font-size: 11px;
    color: var(--text-dim);
    font-family: var(--font-body);
  }

  /* ======== TRACKER MODE ======== */
  .tracker-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tracker-controls {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .slot-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
  }

  .group-name {
    font-family: var(--font-heading);
    font-size: 13px;
    color: var(--accent);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .sr-tag {
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 2px;
    background: rgba(100, 180, 255, 0.15);
    color: #64b4ff;
    font-weight: 700;
    vertical-align: middle;
  }

  .group-count {
    font-size: 11px;
    color: var(--text-dim);
  }

  .levels-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .level-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .level-tag {
    font-size: 11px;
    color: var(--text-dim);
    min-width: 36px;
    text-align: right;
    font-weight: 600;
  }

  .slot-buttons, .custom-buttons {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }

  /* ---- Glowing slot buttons ---- */
  .slot-btn {
    width: 32px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 3px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 200ms ease;
    position: relative;
    overflow: hidden;
  }

  .slot-inner {
    width: 20px;
    height: 12px;
    border-radius: 2px;
    transition: all 200ms ease;
  }

  /* Standard available — gold glow */
  .slot-btn.available {
    border-color: var(--accent-dim);
    background: rgba(200, 169, 110, 0.08);
    box-shadow: 0 0 8px rgba(200, 169, 110, 0.3),
                inset 0 0 6px rgba(200, 169, 110, 0.1);
  }
  .slot-btn.available .slot-inner {
    background: var(--accent);
    box-shadow: 0 0 6px rgba(200, 169, 110, 0.6);
  }
  .slot-btn.available:hover {
    box-shadow: 0 0 12px rgba(200, 169, 110, 0.5),
                inset 0 0 8px rgba(200, 169, 110, 0.15);
    transform: scale(1.08);
  }

  /* Pact Magic available — blue glow */
  .slot-btn.pact.available {
    border-color: rgba(100, 180, 255, 0.4);
    background: rgba(100, 180, 255, 0.06);
    box-shadow: 0 0 8px rgba(100, 180, 255, 0.3),
                inset 0 0 6px rgba(100, 180, 255, 0.1);
  }
  .slot-btn.pact.available .slot-inner {
    background: #64b4ff;
    box-shadow: 0 0 6px rgba(100, 180, 255, 0.6);
  }
  .slot-btn.pact.available:hover {
    box-shadow: 0 0 12px rgba(100, 180, 255, 0.5),
                inset 0 0 8px rgba(100, 180, 255, 0.15);
    transform: scale(1.08);
  }

  /* Custom slot — color set via inline style */
  .slot-btn.custom-slot.available {
    background: rgba(255, 255, 255, 0.04);
  }
  .slot-btn.custom-slot.available:hover {
    transform: scale(1.08);
  }

  /* Used — dim/dark (all types) */
  .slot-btn.used {
    border-color: var(--border) !important;
    background: var(--bg) !important;
    box-shadow: none !important;
  }
  .slot-btn.used .slot-inner {
    background: var(--bg-input) !important;
    box-shadow: none !important;
  }
  .slot-btn.used:hover {
    border-color: var(--border-focus) !important;
    transform: scale(1.05);
  }
</style>
