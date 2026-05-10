<!-- ============================================
     WeaponsCantrips.svelte — Attack Panel
     
     Pulls weapons from Inventory and damage
     cantrips from Spell List. Calculates attack
     and damage using ability scores from Skills.
     
     Spellcasting modifier is user-selectable
     (INT / WIS / CHA).
     ============================================ -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { eventBus } from "../../lib/eventBus";
  import type { BusMessage } from "../../lib/types";

  // ---- Types (matching other apps' storage format) ----

  type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

  interface WeaponEntry {
    name: string;
    attackAbility: "str" | "dex" | "finesse";
    damageDice: string;
    damageType: string;
    magicBonus: number;
    range: string;
    properties: string;
    isMagic: boolean;
  }

  interface CantripEntry {
    name: string;
    damageDice: string;
    damageType: string;
    range: string;
    description: string;
    cantripUpgrade: string;
  }

  interface RollResult {
    label: string;
    type: "attack" | "damage";
    total: number;
    d20?: number;
    mod?: number;
  }

  // ---- State ----
  let weapons: WeaponEntry[] = [];
  let cantrips: CantripEntry[] = [];

  let spellcastingAbility: AbilityKey = "int";
  let characterLevel = 1;
  let profBonus = 2;
  let abilityMods: Record<AbilityKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };

  let lastRoll: RollResult | null = null;
  let activeView: "weapons" | "cantrips" = "weapons";

  let unsubscribe: () => void;

  onMount(() => {
    loadAll();

    unsubscribe = eventBus.subscribe("weaponsCantrips", (msg: BusMessage) => {
      if (msg.action === "refresh") loadAll();
    });

    // Refresh when other apps save
    const interval = setInterval(loadAll, 3000);
    return () => clearInterval(interval);
  });

  onDestroy(() => { if (unsubscribe) unsubscribe(); });

  // ============ LOAD FROM OTHER APPS ============

  function loadAll() {
    loadWeapons();
    loadCantrips();
    loadSkills();
    loadSpellcastingPref();
  }

  function loadWeapons() {
    try {
      const raw = window.localStorage.getItem("dnd-inventory");
      if (!raw) { weapons = []; return; }
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
      weapons = items
        .filter((i: any) => i.weapon && (i.equipmentType === "weapon" || i.equipmentType === "magicWeapon"))
        .map((i: any) => ({
          name: i.name,
          attackAbility: i.weapon.attackAbility || "str",
          damageDice: i.weapon.damageDice || "1D4",
          damageType: i.weapon.damageType || "Bludgeoning",
          magicBonus: i.weapon.magicBonus || 0,
          range: i.weapon.range || "5 ft",
          properties: i.weapon.properties || "",
          isMagic: i.equipmentType === "magicWeapon",
        }));
    } catch { weapons = []; }
  }

  function loadCantrips() {
    cantrips = [];
    // Try new Spellcasting app first
    try {
      const raw = window.localStorage.getItem("dnd-spellcasting");
      if (raw) {
        const data = JSON.parse(raw);
        if (data.spells) {
          cantrips = data.spells
            .filter((s: any) => s.level === 0 && s.damageDice && s.damageDice.trim() !== "")
            .map((s: any) => ({
              name: s.name,
              damageDice: s.damageDice,
              damageType: s.damageType || "",
              range: s.range || "30 ft",
              description: s.description || "",
              cantripUpgrade: s.cantripUpgrade || "",
            }));
          if (cantrips.length > 0) return;
        }
      }
    } catch {}
    // Fallback to old Spell List
    try {
      const raw = window.localStorage.getItem("dnd-spelllist");
      if (!raw) return;
      const spells = JSON.parse(raw);
      cantrips = spells
        .filter((s: any) => s.level === 0 && s.damage && s.damage.dice && s.damage.dice.trim() !== "")
        .map((s: any) => ({
          name: s.name,
          damageDice: s.damage.dice,
          damageType: s.damage.type || "",
          range: s.range || "30 ft",
          description: s.description || "",
          cantripUpgrade: s.cantripUpgrade || "",
        }));
    } catch {}
  }

  function loadSkills() {
    try {
      const raw = window.localStorage.getItem("dnd-skills");
      if (!raw) return;
      const data = JSON.parse(raw);
      characterLevel = data.level || 1;
      profBonus = calcProfBonus(characterLevel);
      if (data.abilities) {
        for (const ab of data.abilities) {
          const key = ab.key as AbilityKey;
          if (key in abilityMods) {
            abilityMods[key] = Math.floor((ab.value - 10) / 2);
          }
        }
      }
    } catch {}
  }

  function loadSpellcastingPref() {
    try {
      const raw = window.localStorage.getItem("dnd-weaponscantrips-pref");
      if (raw) {
        const pref = JSON.parse(raw);
        spellcastingAbility = pref.spellcastingAbility || "int";
      }
    } catch {}
  }

  function savePref() {
    try {
      window.localStorage.setItem("dnd-weaponscantrips-pref",
        JSON.stringify({ spellcastingAbility }));
    } catch {}
  }

  // ============ CALCULATIONS ============

  function calcProfBonus(lvl: number): number {
    if (lvl <= 4) return 2;
    if (lvl <= 8) return 3;
    if (lvl <= 12) return 4;
    if (lvl <= 16) return 5;
    return 6;
  }

  /** Weapon attack bonus */
  function weaponAttackBonus(w: WeaponEntry): number {
    let abilMod: number;
    if (w.attackAbility === "finesse") {
      abilMod = Math.max(abilityMods.str, abilityMods.dex);
    } else {
      abilMod = abilityMods[w.attackAbility];
    }
    return abilMod + profBonus + w.magicBonus;
  }

  /** Weapon damage modifier (ability mod + magic bonus) */
  function weaponDamageMod(w: WeaponEntry): number {
    let abilMod: number;
    if (w.attackAbility === "finesse") {
      abilMod = Math.max(abilityMods.str, abilityMods.dex);
    } else {
      abilMod = abilityMods[w.attackAbility];
    }
    return abilMod + w.magicBonus;
  }

  /** Spell attack bonus */
  $: spellAttackBonus = abilityMods[spellcastingAbility] + profBonus;

  /** Spell save DC */
  $: spellSaveDC = 8 + abilityMods[spellcastingAbility] + profBonus;

  /** Cantrip damage dice scaled by level */
  function scaledCantripDice(baseDice: string): string {
    // Standard 5e scaling: 1 die at 1, 2 at 5, 3 at 11, 4 at 17
    const match = baseDice.match(/^(\d*)D(\d+)(.*)$/i);
    if (!match) return baseDice;
    const sides = match[2];
    const suffix = match[3] || "";
    let count = 1;
    if (characterLevel >= 17) count = 4;
    else if (characterLevel >= 11) count = 3;
    else if (characterLevel >= 5) count = 2;
    return `${count}D${sides}${suffix}`;
  }

  function fmtMod(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  // ============ ROLLING ============

  function rollAttack(label: string, bonus: number) {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + bonus;
    lastRoll = { label: `${label} Attack`, type: "attack", total, d20, mod: bonus };

    const diceStr = bonus >= 0 ? `1D20+${bonus}` : `1D20${bonus}`;
    eventBus.send({ target: "diceRoller", source: "weaponsCantrips", action: "roll", dice: diceStr });

    setTimeout(() => { lastRoll = null; }, 4000);
  }

  function rollDamage(label: string, dice: string, extraMod: number) {
    // Build dice string with modifier
    let diceStr = dice;
    if (extraMod !== 0) {
      diceStr = extraMod > 0 ? `${dice}+${extraMod}` : `${dice}${extraMod}`;
    }

    eventBus.send({ target: "diceRoller", source: "weaponsCantrips", action: "roll", dice: diceStr });

    lastRoll = { label: `${label} Damage`, type: "damage", total: 0 };
    setTimeout(() => { lastRoll = null; }, 4000);
  }

  function rollWeaponAttack(w: WeaponEntry) {
    rollAttack(w.name, weaponAttackBonus(w));
  }

  function rollWeaponDamage(w: WeaponEntry) {
    rollDamage(w.name, w.damageDice, weaponDamageMod(w));
  }

  function rollCantripAttack(c: CantripEntry) {
    rollAttack(c.name, spellAttackBonus);
  }

  function rollCantripDamage(c: CantripEntry) {
    const scaled = scaledCantripDice(c.damageDice);
    // Cantrips don't add ability mod to damage (usually)
    eventBus.send({ target: "diceRoller", source: "weaponsCantrips", action: "roll", dice: scaled });
    lastRoll = { label: `${c.name} Damage`, type: "damage", total: 0 };
    setTimeout(() => { lastRoll = null; }, 4000);
  }

  // ============ ABILITY LABELS ============

  const ABILITY_LABELS: Record<AbilityKey, string> = {
    str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
  };

  const CASTING_ABILITIES: AbilityKey[] = ["int", "wis", "cha"];
  const CASTING_FULL: Record<string, string> = {
    int: "Intelligence", wis: "Wisdom", cha: "Charisma",
  };
</script>

<div class="wc-app">
  <!-- Header with spellcasting config -->
  <div class="header-row">
    <div class="casting-config">
      <span class="config-label">Spellcasting</span>
      <select bind:value={spellcastingAbility} on:change={savePref} class="cast-select">
        {#each CASTING_ABILITIES as ab}
          <option value={ab}>{CASTING_FULL[ab]}</option>
        {/each}
      </select>
    </div>
    <div class="stat-pills">
      <span class="pill">Lvl {characterLevel}</span>
      <span class="pill">Prof {fmtMod(profBonus)}</span>
      <span class="pill atk">Spell Atk {fmtMod(spellAttackBonus)}</span>
      <span class="pill dc">DC {spellSaveDC}</span>
    </div>
  </div>

  <!-- Roll toast -->
  {#if lastRoll}
    <div class="roll-toast" class:atk-toast={lastRoll.type === "attack"} class:dmg-toast={lastRoll.type === "damage"}>
      <span class="toast-label">{lastRoll.label}</span>
      {#if lastRoll.d20 !== undefined}
        <span class="toast-detail">d20: {lastRoll.d20} {fmtMod(lastRoll.mod || 0)}</span>
        <span class="toast-total">= {lastRoll.total}</span>
      {:else}
        <span class="toast-detail">→ Dice Roller</span>
      {/if}
    </div>
  {/if}

  <!-- View tabs -->
  <div class="view-tabs">
    <button class="vtab" class:active={activeView === "weapons"} on:click={() => activeView = "weapons"}>
      ⚔ Weapons <span class="vtab-count">{weapons.length}</span>
    </button>
    <button class="vtab" class:active={activeView === "cantrips"} on:click={() => activeView = "cantrips"}>
      ✦ Cantrips <span class="vtab-count">{cantrips.length}</span>
    </button>
  </div>

  <!-- ======== WEAPONS ======== -->
  {#if activeView === "weapons"}
    <div class="attack-list">
      {#each weapons as w (w.name)}
        {@const atkBonus = weaponAttackBonus(w)}
        {@const dmgMod = weaponDamageMod(w)}
        <div class="attack-card" class:magic-card={w.isMagic}>
          <div class="atk-header">
            <span class="atk-name">{w.name}</span>
            {#if w.isMagic && w.magicBonus > 0}
              <span class="magic-badge">+{w.magicBonus}</span>
            {/if}
          </div>

          <div class="atk-stats">
            <span class="atk-ability">{w.attackAbility === "finesse" ? "FIN" : ABILITY_LABELS[w.attackAbility]}</span>
            <span class="atk-range">{w.range}</span>
            {#if w.properties}
              <span class="atk-props">{w.properties}</span>
            {/if}
          </div>

          <div class="atk-rolls">
            <button class="roll-btn atk-roll" on:click={() => rollWeaponAttack(w)}
                    title="Roll attack">
              🎯 {fmtMod(atkBonus)} to hit
            </button>
            <button class="roll-btn dmg-roll" on:click={() => rollWeaponDamage(w)}
                    title="Roll damage">
              💥 {w.damageDice}{dmgMod !== 0 ? fmtMod(dmgMod) : ""} {w.damageType}
            </button>
          </div>
        </div>
      {/each}

      {#if weapons.length === 0}
        <div class="empty">No weapons in inventory. Add weapons with type "Weapon" in the Inventory app.</div>
      {/if}
    </div>
  {/if}

  <!-- ======== CANTRIPS ======== -->
  {#if activeView === "cantrips"}
    <div class="attack-list">
      {#each cantrips as c (c.name)}
        {@const scaled = scaledCantripDice(c.damageDice)}
        <div class="attack-card cantrip-card">
          <div class="atk-header">
            <span class="atk-name">{c.name}</span>
            <span class="cantrip-badge">Cantrip</span>
          </div>

          <div class="atk-stats">
            <span class="atk-ability">{ABILITY_LABELS[spellcastingAbility]}</span>
            <span class="atk-range">{c.range}</span>
            <span class="atk-dmg-type">{c.damageType}</span>
          </div>

          {#if scaled !== c.damageDice}
            <div class="scaling-note">
              Scaled: {c.damageDice} → {scaled} (level {characterLevel})
            </div>
          {/if}

          <div class="atk-rolls">
            <button class="roll-btn atk-roll" on:click={() => rollCantripAttack(c)}
                    title="Roll spell attack">
              🎯 {fmtMod(spellAttackBonus)} to hit
            </button>
            <button class="roll-btn dmg-roll" on:click={() => rollCantripDamage(c)}
                    title="Roll damage">
              💥 {scaled} {c.damageType}
            </button>
          </div>

          {#if c.cantripUpgrade}
            <p class="cantrip-upgrade">{c.cantripUpgrade}</p>
          {/if}
        </div>
      {/each}

      {#if cantrips.length === 0}
        <div class="empty">No damage cantrips found. Add level 0 spells with damage dice in the Spell List app.</div>
      {/if}
    </div>
  {/if}

  <!-- Ability scores reference -->
  <div class="ability-ref">
    {#each ["str", "dex", "con", "int", "wis", "cha"] as ab}
      <span class="ab-chip" class:highlighted={ab === spellcastingAbility}>
        {ABILITY_LABELS[ab]} {fmtMod(abilityMods[ab])}
      </span>
    {/each}
  </div>
</div>

<style>
  .wc-app { display: flex; flex-direction: column; gap: 8px; }

  /* ---- Header ---- */
  .header-row {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 8px; flex-wrap: wrap;
  }

  .casting-config { display: flex; align-items: center; gap: 6px; }
  .config-label { font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.3px; }
  .cast-select { font-size: 12px; padding: 3px 6px; }

  .stat-pills { display: flex; gap: 4px; flex-wrap: wrap; }
  .pill {
    font-size: 10px; font-weight: 600; padding: 2px 7px;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 2px; color: var(--text-dim);
  }
  .pill.atk { color: #44aa88; border-color: rgba(68,170,136,0.3); }
  .pill.dc { color: #cc8833; border-color: rgba(204,136,51,0.3); }

  /* ---- Roll toast ---- */
  .roll-toast {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 6px 12px; border-radius: var(--radius);
    animation: toastIn 200ms ease;
  }
  .atk-toast { background: rgba(68,170,136,0.08); border: 1px solid rgba(68,170,136,0.3); }
  .dmg-toast { background: rgba(204,68,68,0.08); border: 1px solid rgba(204,68,68,0.3); }

  @keyframes toastIn {
    from { opacity: 0; transform: translateY(-3px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .toast-label { font-size: 12px; font-weight: 600; color: var(--text); }
  .toast-detail { font-size: 11px; color: var(--text-dim); }
  .toast-total { font-size: 18px; font-weight: 700; color: var(--accent); font-family: var(--font-heading); }

  /* ---- View tabs ---- */
  .view-tabs { display: flex; gap: 2px; }
  .vtab {
    flex: 1; padding: 7px 8px; font-size: 12px;
    color: var(--text-dim); background: var(--bg);
    border: 1px solid var(--border); border-radius: var(--radius);
    text-align: center; cursor: pointer; transition: all var(--transition);
  }
  .vtab:hover { color: var(--text); border-color: var(--border-focus); }
  .vtab.active { color: var(--accent); border-color: var(--accent-dim); background: rgba(200,169,110,0.05); }
  .vtab-count { font-size: 10px; opacity: 0.5; }

  /* ---- Attack cards ---- */
  .attack-list { display: flex; flex-direction: column; gap: 6px; }

  .attack-card {
    padding: 10px 12px; background: var(--bg);
    border: 1px solid var(--border); border-left: 3px solid #cc8833;
    border-radius: var(--radius);
    display: flex; flex-direction: column; gap: 5px;
  }

  .magic-card { border-left-color: #cc44cc; }
  .cantrip-card { border-left-color: #44aa88; }

  .atk-header { display: flex; justify-content: space-between; align-items: center; }
  .atk-name { font-size: 14px; font-weight: 600; color: var(--text-bright); font-family: var(--font-heading); }

  .magic-badge {
    font-size: 11px; font-weight: 700; color: #cc44cc;
    padding: 0 5px; background: rgba(204,68,204,0.1);
    border: 1px solid rgba(204,68,204,0.3); border-radius: 2px;
  }

  .cantrip-badge {
    font-size: 9px; font-weight: 600; color: #44aa88;
    padding: 1px 5px; background: rgba(68,170,136,0.1);
    border: 1px solid rgba(68,170,136,0.3); border-radius: 2px;
    text-transform: uppercase; letter-spacing: 0.3px;
  }

  .atk-stats { display: flex; gap: 8px; font-size: 11px; color: var(--text-dim); flex-wrap: wrap; }
  .atk-ability { font-weight: 600; color: var(--text); }
  .atk-props { opacity: 0.7; font-style: italic; }

  .scaling-note {
    font-size: 10px; color: #44aa88; font-style: italic;
    padding: 2px 6px; background: rgba(68,170,136,0.06);
    border-radius: 2px;
  }

  .atk-rolls { display: flex; gap: 4px; }

  .roll-btn {
    flex: 1; padding: 6px 10px; font-size: 12px; font-weight: 600;
    border: 1px solid var(--border); border-radius: var(--radius);
    cursor: pointer; transition: all 120ms ease;
    display: flex; align-items: center; justify-content: center; gap: 4px;
  }

  .atk-roll {
    color: #44aa88; background: rgba(68,170,136,0.04);
    border-color: rgba(68,170,136,0.25);
  }
  .atk-roll:hover { background: rgba(68,170,136,0.12); border-color: rgba(68,170,136,0.4); }

  .dmg-roll {
    color: #cc6633; background: rgba(204,102,51,0.04);
    border-color: rgba(204,102,51,0.25);
  }
  .dmg-roll:hover { background: rgba(204,102,51,0.12); border-color: rgba(204,102,51,0.4); }

  .cantrip-upgrade {
    font-size: 11px; color: #44aa88; font-style: italic; line-height: 1.4;
  }

  /* ---- Ability reference ---- */
  .ability-ref {
    display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;
    padding: 6px 0;
  }

  .ab-chip {
    font-size: 10px; font-weight: 600; padding: 2px 6px;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 2px; color: var(--text-dim);
  }

  .ab-chip.highlighted {
    color: var(--accent); border-color: var(--accent-dim);
    background: rgba(200,169,110,0.06);
  }

  .empty {
    text-align: center; padding: 20px; font-size: 12px;
    color: var(--text-dim); opacity: 0.5; line-height: 1.5;
  }
</style>
