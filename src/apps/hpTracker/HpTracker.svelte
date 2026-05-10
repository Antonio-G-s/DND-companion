<!-- ============================================
     HpTracker.svelte — HP / Temp HP / AC Tracker
     
     Red heart: Current HP / Max HP
     Blue heart: Temporary HP
     Shield: AC (sum of editable effect list)
     
     Event bus:
       { target: "hpTracker", action: "heal", amount: 5 }
       { target: "hpTracker", action: "damage", amount: 3 }
       { target: "hpTracker", action: "tempHp", amount: 8 }
     ============================================ -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { eventBus } from "../../lib/eventBus";
  import type { BusMessage } from "../../lib/types";

  // ---- Types ----
  interface AcEffect {
    name: string;
    value: number;
  }

  // ---- State ----
  let maxHp = 30;
  let currentHp = 30;
  let tempHp = 0;
  let acEffects: AcEffect[] = [
    { name: "Base", value: 10 },
  ];
  let showAcPanel = false;

  // ---- Quick adjust inputs ----
  let hpDelta = 0;
  let tempDelta = 0;

  // ---- Flash animation ----
  let hpFlash: "heal" | "damage" | "" = "";
  let tempFlash: "add" | "" = "";

  // ---- AC form ----
  let newEffectName = "";
  let newEffectValue = 0;

  // ---- Lifecycle ----
  let unsubscribe: () => void;

  onMount(() => {
    loadFromStorage();

    unsubscribe = eventBus.subscribe("hpTracker", (msg: BusMessage) => {
      if (msg.action === "heal" && typeof msg.amount === "number") {
        heal(msg.amount);
      }
      if (msg.action === "damage" && typeof msg.amount === "number") {
        takeDamage(msg.amount);
      }
      if (msg.action === "tempHp" && typeof msg.amount === "number") {
        addTempHp(msg.amount);
      }
    });
  });

  onDestroy(() => { if (unsubscribe) unsubscribe(); });

  // ============ HP LOGIC ============

  function heal(amount: number) {
    if (amount <= 0) return;
    currentHp = Math.min(maxHp, currentHp + amount);
    flashHp("heal");
    saveToStorage();
  }

  function takeDamage(amount: number) {
    if (amount <= 0) return;
    let remaining = amount;

    // Temp HP absorbs first
    if (tempHp > 0) {
      if (tempHp >= remaining) {
        tempHp -= remaining;
        remaining = 0;
      } else {
        remaining -= tempHp;
        tempHp = 0;
      }
    }

    // Remainder hits real HP
    currentHp = Math.max(0, currentHp - remaining);
    flashHp("damage");
    saveToStorage();
  }

  function addTempHp(amount: number) {
    if (amount <= 0) return;
    // Temp HP doesn't stack — take the higher value
    tempHp = Math.max(tempHp, amount);
    flashTemp();
    saveToStorage();
  }

  function applyHpDelta(positive: boolean) {
    if (hpDelta <= 0) return;
    if (positive) heal(hpDelta);
    else takeDamage(hpDelta);
    hpDelta = 0;
  }

  function applyTempDelta(positive: boolean) {
    if (tempDelta <= 0) return;
    if (positive) {
      addTempHp(tempDelta);
    } else {
      tempHp = Math.max(0, tempHp - tempDelta);
      saveToStorage();
    }
    tempDelta = 0;
  }

  function setMax() {
    if (maxHp < 1) maxHp = 1;
    if (currentHp > maxHp) currentHp = maxHp;
    saveToStorage();
  }

  function fullHeal() {
    currentHp = maxHp;
    flashHp("heal");
    saveToStorage();
  }

  function flashHp(type: "heal" | "damage") {
    hpFlash = type;
    setTimeout(() => { hpFlash = ""; }, 400);
  }

  function flashTemp() {
    tempFlash = "add";
    setTimeout(() => { tempFlash = ""; }, 400);
  }

  // ============ AC LOGIC ============

  $: totalAc = acEffects.reduce((sum, e) => sum + e.value, 0);

  function addAcEffect() {
    if (!newEffectName.trim()) return;
    acEffects = [...acEffects, { name: newEffectName.trim(), value: newEffectValue }];
    newEffectName = "";
    newEffectValue = 0;
    saveToStorage();
  }

  function removeAcEffect(idx: number) {
    acEffects = acEffects.filter((_, i) => i !== idx);
    saveToStorage();
  }

  function onAcChange() {
    acEffects = acEffects;
    saveToStorage();
  }

  // ============ SAVE / LOAD ============

  function saveToStorage() {
    try {
      window.localStorage.setItem("dnd-hptracker", JSON.stringify({
        maxHp, currentHp, tempHp, acEffects,
      }));
    } catch {}
  }

  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem("dnd-hptracker");
      if (raw) {
        const d = JSON.parse(raw);
        maxHp = d.maxHp ?? 30;
        currentHp = d.currentHp ?? 30;
        tempHp = d.tempHp ?? 0;
        acEffects = d.acEffects ?? [{ name: "Base", value: 10 }];
        return;
      }
    } catch {}
  }

  // ============ DISPLAY ============

  $: hpPercent = maxHp > 0 ? Math.round((currentHp / maxHp) * 100) : 0;
  $: hpColor = hpPercent > 60 ? "#cc3333" : hpPercent > 30 ? "#cc6633" : "#882222";
  $: hpGlow = hpPercent > 60 ? "0.4" : hpPercent > 30 ? "0.25" : "0.15";
</script>

<div class="hp-tracker">
  <!-- ======== MAIN DISPLAY ======== -->
  <div class="display-row">
    <!-- RED HEART — HP -->
    <div class="stat-block hp-block" class:flash-heal={hpFlash === "heal"} class:flash-damage={hpFlash === "damage"}>
      <svg class="heart-icon" viewBox="0 0 24 24" style="filter: drop-shadow(0 0 4px rgba(204,51,51,{hpGlow}));">
        <!-- Full heart background (gray) -->
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="#331111" stroke="#552222" stroke-width="0.5"/>
        <!-- Filled portion (clip from bottom) -->
        <clipPath id="hp-clip">
          <rect x="0" y="{24 - (hpPercent / 100) * 24}" width="24" height="{(hpPercent / 100) * 24}" />
        </clipPath>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="{hpColor}" clip-path="url(#hp-clip)"/>
      </svg>
      <div class="stat-values">
        <span class="stat-current hp-num">{currentHp}</span>
        <span class="stat-sep">/</span>
        <span class="stat-max">{maxHp}</span>
      </div>
      <span class="stat-label">HP</span>
    </div>

    <!-- BLUE HEART — Temp HP -->
    <div class="stat-block temp-block" class:flash-temp={tempFlash === "add"}>
      <svg class="heart-icon temp-heart" viewBox="0 0 24 24"
           style="filter: drop-shadow(0 0 4px rgba(80,140,220,{tempHp > 0 ? '0.4' : '0.1'}));">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="{tempHp > 0 ? '#3366aa' : '#1a2233'}"
              stroke="{tempHp > 0 ? '#5588cc' : '#223344'}" stroke-width="0.5"/>
      </svg>
      <div class="stat-values">
        <span class="stat-current temp-num">{tempHp}</span>
      </div>
      <span class="stat-label">Temp</span>
    </div>

    <!-- SHIELD — AC -->
    <button class="stat-block shield-block" on:click={() => { showAcPanel = !showAcPanel; }}>
      <svg class="shield-icon" viewBox="0 0 24 24"
           style="filter: drop-shadow(0 0 3px rgba(170,170,170,0.2));">
        <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
              fill="#222222" stroke="#555555" stroke-width="0.8"/>
        <text x="12" y="15" text-anchor="middle" font-size="8" font-weight="700"
              fill="#cccccc" font-family="sans-serif">{totalAc}</text>
      </svg>
      <span class="stat-label">AC</span>
    </button>
  </div>

  <!-- ======== HP CONTROLS ======== -->
  <div class="control-section">
    <div class="control-row">
      <span class="control-label" style="color:#cc3333;">HP</span>
      <button class="ctrl-btn damage" on:click={() => applyHpDelta(false)} title="Take damage">−</button>
      <input type="number" min="0" bind:value={hpDelta} class="delta-input" placeholder="0"
             on:keydown={(e) => { if (e.key === "Enter") applyHpDelta(true); }} />
      <button class="ctrl-btn heal" on:click={() => applyHpDelta(true)} title="Heal">+</button>
      <button class="ctrl-btn full-heal" on:click={fullHeal} title="Full heal">♥</button>
    </div>

    <div class="control-row">
      <span class="control-label" style="color:#5588cc;">Temp</span>
      <button class="ctrl-btn damage" on:click={() => applyTempDelta(false)}>−</button>
      <input type="number" min="0" bind:value={tempDelta} class="delta-input" placeholder="0"
             on:keydown={(e) => { if (e.key === "Enter") applyTempDelta(true); }} />
      <button class="ctrl-btn heal temp-heal" on:click={() => applyTempDelta(true)}>+</button>
    </div>

    <div class="control-row max-row">
      <span class="control-label dim">Max HP</span>
      <input type="number" min="1" max="999" bind:value={maxHp} on:change={setMax} class="max-input" />
    </div>
  </div>

  <!-- ======== AC EFFECTS PANEL ======== -->
  {#if showAcPanel}
    <div class="ac-panel">
      <div class="ac-header">
        <span class="panel-title">AC Breakdown</span>
        <span class="ac-total">Total: {totalAc}</span>
      </div>

      <div class="ac-effects">
        {#each acEffects as effect, i}
          <div class="ac-effect-row">
            <input type="text" bind:value={effect.name} on:change={onAcChange}
                   class="effect-name" placeholder="Effect name" />
            <input type="number" bind:value={effect.value} on:change={onAcChange}
                   class="effect-value" />
            <button class="remove-effect" on:click={() => removeAcEffect(i)} title="Remove">✕</button>
          </div>
        {/each}
      </div>

      <div class="ac-add-row">
        <input type="text" bind:value={newEffectName} placeholder="e.g. Shield"
               class="effect-name"
               on:keydown={(e) => { if (e.key === "Enter") addAcEffect(); }} />
        <input type="number" bind:value={newEffectValue} class="effect-value" />
        <button class="add-effect-btn" on:click={addAcEffect}>+</button>
      </div>

      <div class="ac-hint">
        Common: Base 10, DEX mod, Armor, Shield +2, Magic +1
      </div>
    </div>
  {/if}

  <!-- ======== STATUS BAR ======== -->
  <div class="hp-bar-wrap">
    <div class="hp-bar" style="width:{hpPercent}%; background:{hpColor};"></div>
    {#if tempHp > 0}
      <div class="temp-bar"
           style="left:{hpPercent}%; width:{Math.min(100 - hpPercent, (tempHp / maxHp) * 100)}%;">
      </div>
    {/if}
  </div>

  {#if currentHp === 0}
    <div class="death-warning">💀 Unconscious — Death Saves!</div>
  {/if}
</div>

<style>
  .hp-tracker {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* ======== MAIN DISPLAY ======== */
  .display-row {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding: 8px 0;
  }

  .stat-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 0;
    background: none;
    border: none;
    cursor: default;
  }

  .heart-icon {
    width: 52px;
    height: 52px;
    transition: transform 150ms ease;
  }

  .temp-heart { width: 44px; height: 44px; }

  .shield-icon {
    width: 48px;
    height: 48px;
    transition: transform 150ms ease;
  }

  .shield-block {
    cursor: pointer;
  }

  .shield-block:hover .shield-icon {
    transform: scale(1.08);
  }

  .stat-values {
    display: flex;
    align-items: baseline;
    gap: 2px;
  }

  .stat-current {
    font-size: 22px;
    font-weight: 700;
    font-family: var(--font-heading);
  }

  .hp-num { color: #cc3333; }
  .temp-num { color: #5588cc; }

  .stat-sep {
    font-size: 14px;
    color: var(--text-dim);
  }

  .stat-max {
    font-size: 14px;
    color: var(--text-dim);
  }

  .stat-label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Flash animations */
  .flash-heal .heart-icon { animation: pulseHeal 400ms ease; }
  .flash-damage .heart-icon { animation: pulseDamage 400ms ease; }
  .flash-temp .temp-heart { animation: pulseTemp 400ms ease; }

  @keyframes pulseHeal {
    0% { transform: scale(1); }
    30% { transform: scale(1.2); filter: drop-shadow(0 0 10px rgba(80,200,80,0.6)); }
    100% { transform: scale(1); }
  }

  @keyframes pulseDamage {
    0% { transform: scale(1); }
    15% { transform: scale(0.85); }
    40% { transform: scale(1.1); filter: drop-shadow(0 0 8px rgba(255,50,50,0.5)); }
    100% { transform: scale(1); }
  }

  @keyframes pulseTemp {
    0% { transform: scale(1); }
    30% { transform: scale(1.15); filter: drop-shadow(0 0 8px rgba(80,140,220,0.5)); }
    100% { transform: scale(1); }
  }

  /* ======== CONTROLS ======== */
  .control-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .control-label {
    font-size: 11px;
    font-weight: 700;
    min-width: 34px;
    text-align: right;
  }

  .control-label.dim { color: var(--text-dim); }

  .delta-input {
    width: 56px;
    text-align: center;
    font-size: 14px;
    font-weight: 600;
    padding: 4px;
  }

  .max-input {
    width: 64px;
    text-align: center;
    font-size: 13px;
    padding: 4px;
  }

  .ctrl-btn {
    width: 30px;
    height: 28px;
    padding: 0;
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    background: var(--bg-input);
    color: var(--text-dim);
    transition: all 120ms ease;
  }

  .ctrl-btn.damage:hover {
    color: #cc3333;
    border-color: #cc3333;
    background: rgba(204, 51, 51, 0.08);
  }

  .ctrl-btn.heal:hover {
    color: #44aa44;
    border-color: #44aa44;
    background: rgba(68, 170, 68, 0.08);
  }

  .ctrl-btn.temp-heal:hover {
    color: #5588cc;
    border-color: #5588cc;
    background: rgba(80, 140, 220, 0.08);
  }

  .ctrl-btn.full-heal {
    font-size: 13px;
  }

  .ctrl-btn.full-heal:hover {
    color: #44aa44;
    border-color: #44aa44;
  }

  .max-row {
    margin-top: 2px;
    padding-top: 4px;
    border-top: 1px solid var(--border);
  }

  /* ======== AC PANEL ======== */
  .ac-panel {
    padding: 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ac-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-title {
    font-family: var(--font-heading);
    font-size: 12px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .ac-total {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
  }

  .ac-effects {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .ac-effect-row, .ac-add-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .effect-name {
    flex: 1;
    font-size: 12px;
    padding: 3px 8px;
  }

  .effect-value {
    width: 52px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    padding: 3px 4px;
  }

  .remove-effect {
    width: 22px;
    height: 22px;
    padding: 0;
    font-size: 10px;
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-effect:hover { color: var(--danger); }

  .add-effect-btn {
    width: 22px;
    height: 22px;
    padding: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--accent-dim);
    border-radius: 2px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .add-effect-btn:hover { background: rgba(200, 169, 110, 0.1); }

  .ac-hint {
    font-size: 10px;
    color: var(--text-dim);
    opacity: 0.5;
    font-style: italic;
  }

  /* ======== HP BAR ======== */
  .hp-bar-wrap {
    position: relative;
    height: 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }

  .hp-bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    border-radius: 3px;
    transition: width 300ms ease, background 300ms ease;
  }

  .temp-bar {
    position: absolute;
    top: 0;
    height: 100%;
    background: #3366aa;
    opacity: 0.6;
    border-radius: 0 3px 3px 0;
    transition: width 300ms ease, left 300ms ease;
  }

  /* ======== DEATH WARNING ======== */
  .death-warning {
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    color: #cc3333;
    padding: 6px;
    background: rgba(204, 51, 51, 0.08);
    border: 1px solid rgba(204, 51, 51, 0.3);
    border-radius: var(--radius);
    animation: deathPulse 2s ease-in-out infinite;
  }

  @keyframes deathPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
