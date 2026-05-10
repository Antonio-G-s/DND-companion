<!-- ============================================
     SpellList.svelte — Spell List sub app
     
     Renders spell cards from JSON config.
     Spell damage dice are clickable and send
     roll requests to the Dice Roller via the bus.
     Supports add/edit/delete/import/export.
     ============================================ -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { eventBus } from "../../lib/eventBus";
  import type { Spell, BusMessage } from "../../lib/types";

  /** ---- Constants ---- */
  const SCHOOLS = [
    "Abjuration", "Conjuration", "Divination", "Enchantment",
    "Evocation", "Illusion", "Necromancy", "Transmutation",
  ];

  const DAMAGE_TYPES = [
    "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning",
    "Necrotic", "Piercing", "Poison", "Psychic", "Radiant",
    "Slashing", "Thunder",
  ];

  /** ---- State ---- */
  let spells: Spell[] = [];
  let editingIndex: number | null = null;
  let showForm = false;
  let lastRollResult: { dice: string; result: number } | null = null;

  /** Blank spell template */
  function blankSpell(): Spell {
    return {
      name: "",
      level: 0,
      castingTime: "Action",
      school: "Evocation",
      range: "30 ft",
      components: { verbal: true, somatic: false, material: false, materialText: "" },
      damage: { dice: "1D6", type: "Fire" },
      description: "",
      cantripUpgrade: "",
      backgroundImage: "",
      textColor: "#FFFFFF",
    };
  }

  let formSpell: Spell = blankSpell();

  /** Load spells — from storage first, then defaults */
  onMount(() => {
    const saved = loadSpellsFromStorage();
    spells = saved.length > 0 ? saved : getDefaultSpells();

    // Listen for roll results + showSpell requests from Magic Items
    unsubscribe = eventBus.subscribe("spellList", (msg: BusMessage) => {
      if (msg.action === "rollResult") {
        lastRollResult = { dice: msg.dice as string, result: msg.result as number };
        setTimeout(() => { lastRollResult = null; }, 3000);
      }
      if (msg.action === "showSpell" && typeof msg.spellName === "string") {
        highlightSpell(msg.spellName);
      }
    });
  });

  let unsubscribe: () => void;
  let highlightedSpell: string = "";
  onDestroy(() => { if (unsubscribe) unsubscribe(); });

  // ============ SAVE / LOAD ============

  function saveSpellsToStorage() {
    try {
      window.localStorage.setItem("dnd-spelllist", JSON.stringify(spells));
    } catch {}
  }

  function loadSpellsFromStorage(): Spell[] {
    try {
      const raw = window.localStorage.getItem("dnd-spelllist");
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  /** Highlight and scroll to a spell by name */
  function highlightSpell(name: string) {
    highlightedSpell = name;
    // Scroll the spell card into view
    setTimeout(() => {
      const el = document.querySelector(`[data-spell="${name}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    setTimeout(() => { highlightedSpell = ""; }, 3000);
  }

  /** ---- Actions ---- */
  function rollSpellDamage(dice: string) {
    eventBus.send({
      target: "diceRoller",
      source: "spellList",
      action: "roll",
      dice,
    });
  }

  function openAddForm() {
    formSpell = blankSpell();
    editingIndex = null;
    showForm = true;
  }

  function openEditForm(index: number) {
    formSpell = JSON.parse(JSON.stringify(spells[index]));
    editingIndex = index;
    showForm = true;
  }

  function saveSpell() {
    if (!formSpell.name.trim()) return;
    if (editingIndex !== null) {
      spells[editingIndex] = { ...formSpell };
    } else {
      spells = [...spells, { ...formSpell }];
    }
    showForm = false;
    spells = spells;
    saveSpellsToStorage();
  }

  function deleteSpell(index: number) {
    spells = spells.filter((_, i) => i !== index);
    saveSpellsToStorage();
  }

  function cancelForm() {
    showForm = false;
  }

  /** Export spells to a JSON string (user can copy/paste) */
  function exportSpells() {
    const json = JSON.stringify(spells, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spells.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Import spells from a JSON file */
  function importSpells() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          spells = data;
          saveSpellsToStorage();
        }
      } catch {
        console.error("Invalid spell JSON file");
      }
    };
    input.click();
  }

  function getDefaultSpells(): Spell[] {
    return [
      {
        name: "Fire Bolt",
        level: 0,
        castingTime: "Action",
        school: "Evocation",
        range: "120 ft",
        components: { verbal: true, somatic: true, material: false, materialText: "" },
        damage: { dice: "1D10", type: "Fire" },
        description: "You hurl a mote of fire at a creature or object within range.",
        cantripUpgrade: "Damage increases by 1D10 at levels 5, 11, and 17.",
        backgroundImage: "",
        textColor: "#FFFFFF",
      },
      {
        name: "Magic Missile",
        level: 1,
        castingTime: "Action",
        school: "Evocation",
        range: "120 ft",
        components: { verbal: true, somatic: true, material: false, materialText: "" },
        damage: { dice: "1D4+1", type: "Force" },
        description: "You create three glowing darts of magical force. Each dart hits automatically and deals 1D4+1 force damage.",
        cantripUpgrade: "",
        backgroundImage: "",
        textColor: "#FFFFFF",
      },
      {
        name: "Shield",
        level: 1,
        castingTime: "Reaction",
        school: "Abjuration",
        range: "Self",
        components: { verbal: true, somatic: true, material: false, materialText: "" },
        damage: { dice: "", type: "" },
        description: "An invisible barrier of magical force appears and protects you. +5 bonus to AC until the start of your next turn.",
        cantripUpgrade: "",
        backgroundImage: "",
        textColor: "#FFFFFF",
      },
    ];
  }

  /** School color hint for card accent */
  function schoolColor(school: string): string {
    const map: Record<string, string> = {
      Abjuration: "#6699cc",
      Conjuration: "#cc9933",
      Divination: "#9966cc",
      Enchantment: "#cc6699",
      Evocation: "#cc4444",
      Illusion: "#6699ff",
      Necromancy: "#669966",
      Transmutation: "#cc9966",
    };
    return map[school] || "#888888";
  }
</script>

<div class="spell-list">
  <!-- Top controls -->
  <div class="controls-row">
    <button on:click={openAddForm}>+ Add Spell</button>
    <button on:click={importSpells}>Import</button>
    <button on:click={exportSpells}>Export</button>
  </div>

  <!-- Roll result toast -->
  {#if lastRollResult}
    <div class="roll-toast">
      🎲 {lastRollResult.dice} → <strong>{lastRollResult.result}</strong>
    </div>
  {/if}

  <!-- Spell form (add/edit) -->
  {#if showForm}
    <div class="spell-form">
      <div class="form-title">{editingIndex !== null ? "Edit Spell" : "New Spell"}</div>

      <label>
        Name
        <input type="text" bind:value={formSpell.name} placeholder="Spell name" />
      </label>

      <div class="form-row">
        <label class="narrow">
          Level (0–10)
          <input type="number" bind:value={formSpell.level} min="0" max="10" />
        </label>
        <label>
          Casting Time
          <input type="text" bind:value={formSpell.castingTime} placeholder="Action" />
        </label>
      </div>

      <div class="form-row">
        <label>
          School
          <select bind:value={formSpell.school}>
            {#each SCHOOLS as s}<option value={s}>{s}</option>{/each}
          </select>
        </label>
        <label>
          Range
          <input type="text" bind:value={formSpell.range} placeholder="30 ft" />
        </label>
      </div>

      <div class="form-row components-row">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={formSpell.components.verbal} /> V
        </label>
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={formSpell.components.somatic} /> S
        </label>
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={formSpell.components.material} /> M
        </label>
        {#if formSpell.components.material}
          <input type="text" bind:value={formSpell.components.materialText} placeholder="Material description" class="material-input" />
        {/if}
      </div>

      <div class="form-row">
        <label>
          Damage Dice
          <input type="text" bind:value={formSpell.damage.dice} placeholder="1D6" />
        </label>
        <label>
          Damage Type
          <select bind:value={formSpell.damage.type}>
            <option value="">None</option>
            {#each DAMAGE_TYPES as t}<option value={t}>{t}</option>{/each}
          </select>
        </label>
      </div>

      <label>
        Description
        <textarea bind:value={formSpell.description} rows="3" placeholder="What does this spell do?"></textarea>
      </label>

      {#if formSpell.level === 0}
        <label>
          Cantrip Upgrade
          <input type="text" bind:value={formSpell.cantripUpgrade} placeholder="Damage increases at..." />
        </label>
      {/if}

      <div class="form-actions">
        <button class="save-btn" on:click={saveSpell}>Save</button>
        <button on:click={cancelForm}>Cancel</button>
      </div>
    </div>
  {/if}

  <!-- Spell cards -->
  <div class="cards">
    {#each spells as spell, i (spell.name + i)}
      <div
        class="spell-card"
        class:highlighted={highlightedSpell === spell.name}
        data-spell={spell.name}
        style="border-left-color: {schoolColor(spell.school)}; color: {spell.textColor};"
      >
        <div class="card-header">
          <span class="spell-name">{spell.name}</span>
          <span class="spell-level">
            {spell.level === 0 ? "Cantrip" : `Lvl ${spell.level}`}
          </span>
        </div>

        <div class="card-meta">
          <span>{spell.school}</span>
          <span>·</span>
          <span>{spell.castingTime}</span>
          <span>·</span>
          <span>{spell.range}</span>
        </div>

        <div class="card-components">
          {#if spell.components.verbal}<span class="comp-tag">V</span>{/if}
          {#if spell.components.somatic}<span class="comp-tag">S</span>{/if}
          {#if spell.components.material}
            <span class="comp-tag" title={spell.components.materialText}>M</span>
          {/if}
        </div>

        {#if spell.damage.dice}
          <div class="card-damage">
            <button
              class="dice-link"
              on:click={() => rollSpellDamage(spell.damage.dice)}
              title="Click to roll {spell.damage.dice}"
            >
              🎲 {spell.damage.dice}
            </button>
            {#if spell.damage.type}
              <span class="damage-type">{spell.damage.type}</span>
            {/if}
          </div>
        {/if}

        <p class="card-desc">{spell.description}</p>

        {#if spell.level === 0 && spell.cantripUpgrade}
          <p class="card-upgrade">{spell.cantripUpgrade}</p>
        {/if}

        <div class="card-actions">
          <button class="small-btn" on:click={() => openEditForm(i)}>Edit</button>
          <button class="small-btn danger" on:click={() => deleteSpell(i)}>Del</button>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .spell-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .controls-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .controls-row button {
    font-size: 12px;
    padding: 4px 12px;
  }

  /* ---- Roll toast ---- */
  .roll-toast {
    padding: 6px 12px;
    background: rgba(200, 169, 110, 0.12);
    border: 1px solid var(--accent-dim);
    border-radius: var(--radius);
    font-size: 13px;
    color: var(--accent);
    text-align: center;
  }

  /* ---- Spell form ---- */
  .spell-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .form-title {
    font-family: var(--font-heading);
    font-size: 13px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .spell-form label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .spell-form input,
  .spell-form select,
  .spell-form textarea {
    font-size: 13px;
    text-transform: none;
  }

  .form-row {
    display: flex;
    gap: 8px;
  }

  .form-row label { flex: 1; }
  .form-row label.narrow { flex: 0 0 90px; }

  .components-row {
    align-items: center;
    flex-wrap: wrap;
  }

  .checkbox-label {
    flex-direction: row !important;
    align-items: center;
    gap: 4px !important;
    flex: 0 0 auto !important;
    font-size: 13px !important;
    color: var(--text) !important;
  }

  .material-input {
    flex: 1;
    min-width: 120px;
  }

  .form-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .save-btn {
    color: var(--accent);
    border-color: var(--accent-dim);
  }

  /* ---- Spell cards ---- */
  .cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .spell-card {
    padding: 10px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: box-shadow 300ms ease, border-color 300ms ease;
  }

  .spell-card.highlighted {
    border-color: var(--accent);
    box-shadow: 0 0 12px rgba(200, 169, 110, 0.4), inset 0 0 8px rgba(200, 169, 110, 0.08);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .spell-name {
    font-family: var(--font-heading);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-bright);
  }

  .spell-level {
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .card-meta {
    display: flex;
    gap: 6px;
    font-size: 12px;
    color: var(--text-dim);
  }

  .card-components {
    display: flex;
    gap: 4px;
  }

  .comp-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 2px;
  }

  .card-damage {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dice-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    background: rgba(200, 169, 110, 0.08);
    border: 1px solid var(--accent-dim);
    border-radius: var(--radius);
    cursor: pointer;
    transition: background var(--transition);
  }

  .dice-link:hover {
    background: rgba(200, 169, 110, 0.18);
  }

  .damage-type {
    font-size: 12px;
    color: var(--text-dim);
  }

  .card-desc {
    font-size: 13px;
    color: var(--text);
    line-height: 1.5;
  }

  .card-upgrade {
    font-size: 12px;
    color: var(--accent);
    font-style: italic;
  }

  .card-actions {
    display: flex;
    gap: 4px;
    margin-top: 2px;
  }

  .small-btn {
    font-size: 11px;
    padding: 2px 8px;
    border: none;
    background: transparent;
    color: var(--text-dim);
  }

  .small-btn:hover { color: var(--text); }
  .small-btn.danger:hover { color: var(--danger); }
</style>
