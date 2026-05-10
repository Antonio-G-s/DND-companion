<!-- ============================================
     Proficiencies.svelte — Training & Proficiencies
     
     Sections: Languages, Tools, Armor, Weapons
     Each section is a list of strings with
     add/remove. Common presets for quick-add.
     Import/export JSON, auto-save.
     ============================================ -->
<script lang="ts">
  import { onMount } from "svelte";

  type ProfSection = "languages" | "tools" | "armor" | "weapons";

  interface ProficiencyData {
    languages: string[];
    tools: string[];
    armor: string[];
    weapons: string[];
  }

  const SECTIONS: ProfSection[] = ["languages", "tools", "armor", "weapons"];

  const SECTION_LABELS: Record<ProfSection, string> = {
    languages: "Languages",
    tools: "Tools",
    armor: "Armor",
    weapons: "Weapons",
  };

  const SECTION_ICONS: Record<ProfSection, string> = {
    languages: "🗣",
    tools: "🔧",
    armor: "🛡",
    weapons: "⚔",
  };

  // ---- Common presets ----
  const PRESETS: Record<ProfSection, string[]> = {
    languages: [
      "Common", "Elvish", "Dwarvish", "Giant", "Gnomish", "Goblin",
      "Halfling", "Orc", "Abyssal", "Celestial", "Draconic",
      "Deep Speech", "Infernal", "Primordial", "Sylvan", "Undercommon",
      "Thieves' Cant", "Druidic",
    ],
    tools: [
      "Thieves' Tools", "Herbalism Kit", "Alchemist's Supplies",
      "Brewer's Supplies", "Calligrapher's Supplies", "Carpenter's Tools",
      "Cartographer's Tools", "Cobbler's Tools", "Cook's Utensils",
      "Glassblower's Tools", "Jeweler's Tools", "Leatherworker's Tools",
      "Mason's Tools", "Painter's Supplies", "Potter's Tools",
      "Smith's Tools", "Tinker's Tools", "Weaver's Tools",
      "Woodcarver's Tools", "Disguise Kit", "Forgery Kit",
      "Navigator's Tools", "Poisoner's Kit",
      "Bagpipes", "Drum", "Dulcimer", "Flute", "Lute", "Lyre",
      "Horn", "Pan Flute", "Shawm", "Viol",
      "Dice Set", "Dragonchess Set", "Playing Card Set",
      "Three-Dragon Ante Set",
    ],
    armor: [
      "Light Armor", "Medium Armor", "Heavy Armor", "Shields",
    ],
    weapons: [
      "Simple Weapons", "Martial Weapons",
      "Club", "Dagger", "Greatclub", "Handaxe", "Javelin",
      "Light Hammer", "Mace", "Quarterstaff", "Sickle", "Spear",
      "Light Crossbow", "Dart", "Shortbow", "Sling",
      "Battleaxe", "Flail", "Glaive", "Greataxe", "Greatsword",
      "Halberd", "Lance", "Longsword", "Maul", "Morningstar",
      "Pike", "Rapier", "Scimitar", "Shortsword", "Trident",
      "War Pick", "Warhammer", "Whip",
      "Blowgun", "Hand Crossbow", "Heavy Crossbow", "Longbow", "Net",
    ],
  };

  // ---- State ----
  let data: ProficiencyData = {
    languages: [],
    tools: [],
    armor: [],
    weapons: [],
  };

  let expandedSection: ProfSection | null = null;
  let addInputs: Record<ProfSection, string> = {
    languages: "", tools: "", armor: "", weapons: "",
  };
  let showPresets: Record<ProfSection, boolean> = {
    languages: false, tools: false, armor: false, weapons: false,
  };

  onMount(() => { loadFromStorage(); });

  // ============ SAVE / LOAD ============

  function saveToStorage() {
    try {
      window.localStorage.setItem("dnd-proficiencies", JSON.stringify(data));
    } catch {}
  }

  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem("dnd-proficiencies");
      if (raw) {
        data = JSON.parse(raw);
        return;
      }
    } catch {}
    data = getDefaults();
  }

  function getDefaults(): ProficiencyData {
    return {
      languages: ["Common", "Elvish"],
      tools: [],
      armor: ["Light Armor", "Medium Armor", "Heavy Armor", "Shields"],
      weapons: ["Simple Weapons", "Martial Weapons"],
    };
  }

  // ============ IMPORT / EXPORT ============

  function exportData() {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "proficiencies.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed.languages || parsed.tools || parsed.armor || parsed.weapons) {
          data = {
            languages: parsed.languages || [],
            tools: parsed.tools || [],
            armor: parsed.armor || [],
            weapons: parsed.weapons || [],
          };
          saveToStorage();
        }
      } catch {
        console.error("Invalid proficiencies JSON");
      }
    };
    input.click();
  }

  // ============ CRUD ============

  function addItem(section: ProfSection) {
    const val = addInputs[section].trim();
    if (!val) return;
    if (!data[section].includes(val)) {
      data[section] = [...data[section], val];
      saveToStorage();
    }
    addInputs[section] = "";
  }

  function addPreset(section: ProfSection, item: string) {
    if (!data[section].includes(item)) {
      data[section] = [...data[section], item];
      saveToStorage();
    }
  }

  function removeItem(section: ProfSection, idx: number) {
    data[section] = data[section].filter((_, i) => i !== idx);
    saveToStorage();
  }

  function toggleSection(section: ProfSection) {
    expandedSection = expandedSection === section ? null : section;
  }

  function togglePresets(section: ProfSection) {
    showPresets[section] = !showPresets[section];
    showPresets = showPresets;
  }

  // ============ COMPUTED ============

  function availablePresets(section: ProfSection): string[] {
    return PRESETS[section].filter((p) => !data[section].includes(p));
  }

  $: totalCount = data.languages.length + data.tools.length +
                   data.armor.length + data.weapons.length;
</script>

<div class="prof-app">
  <!-- Top bar -->
  <div class="top-bar">
    <span class="total-count">{totalCount} proficiencies</span>
    <div class="top-actions">
      <button class="sm-btn" on:click={importData}>Import</button>
      <button class="sm-btn" on:click={exportData}>Export</button>
    </div>
  </div>

  <!-- Sections -->
  {#each SECTIONS as section}
    {@const items = data[section]}
    {@const isExpanded = expandedSection === section}

    <div class="section" class:expanded={isExpanded}>
      <!-- Section header -->
      <button class="section-header" on:click={() => toggleSection(section)}>
        <span class="section-icon">{SECTION_ICONS[section]}</span>
        <span class="section-label">{SECTION_LABELS[section]}</span>
        <span class="section-count">{items.length}</span>
        <span class="expand-arrow">{isExpanded ? "▾" : "▸"}</span>
      </button>

      <!-- Compact view: tags on one line -->
      {#if !isExpanded && items.length > 0}
        <div class="compact-tags">
          {#each items as item}
            <span class="compact-tag">{item}</span>
          {/each}
        </div>
      {/if}

      <!-- Expanded view: full edit -->
      {#if isExpanded}
        <div class="section-body">
          <!-- Items list -->
          <div class="item-list">
            {#each items as item, i}
              <div class="item-row">
                <span class="item-name">{item}</span>
                <button class="remove-btn" on:click={() => removeItem(section, i)}>✕</button>
              </div>
            {/each}
            {#if items.length === 0}
              <div class="empty-hint">None added</div>
            {/if}
          </div>

          <!-- Add input -->
          <div class="add-row">
            <input
              type="text"
              bind:value={addInputs[section]}
              placeholder="Add custom..."
              class="add-input"
              on:keydown={(e) => { if (e.key === "Enter") addItem(section); }}
            />
            <button class="add-btn" on:click={() => addItem(section)}>+</button>
            <button
              class="preset-toggle"
              on:click={() => togglePresets(section)}
              title="Show common options"
            >
              {showPresets[section] ? "Hide" : "Common"}
            </button>
          </div>

          <!-- Presets grid -->
          {#if showPresets[section]}
            <div class="presets-grid">
              {#each availablePresets(section) as preset}
                <button class="preset-chip" on:click={() => addPreset(section, preset)}>
                  + {preset}
                </button>
              {/each}
              {#if availablePresets(section).length === 0}
                <span class="all-added">All common options added</span>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .prof-app {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .total-count {
    font-size: 11px;
    color: var(--text-dim);
  }

  .top-actions {
    display: flex;
    gap: 4px;
  }

  .sm-btn {
    font-size: 11px;
    padding: 3px 10px;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
  }
  .sm-btn:hover { color: var(--text); border-color: var(--border-focus); }

  /* ======== SECTIONS ======== */
  .section {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .section.expanded {
    border-color: var(--border-focus);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: var(--text);
    transition: background var(--transition);
  }

  .section-header:hover { background: rgba(255,255,255,0.02); }

  .section-icon { font-size: 14px; }

  .section-label {
    font-family: var(--font-heading);
    font-weight: 600;
    flex: 1;
    text-align: left;
  }

  .section-count {
    font-size: 11px;
    color: var(--text-dim);
    background: var(--bg-input);
    padding: 0 6px;
    border-radius: 8px;
    min-width: 20px;
    text-align: center;
  }

  .expand-arrow {
    font-size: 11px;
    color: var(--text-dim);
  }

  /* ---- Compact tags ---- */
  .compact-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 0 10px 8px 10px;
  }

  .compact-tag {
    font-size: 11px;
    padding: 1px 7px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 2px;
    color: var(--text-dim);
  }

  /* ---- Expanded body ---- */
  .section-body {
    padding: 4px 10px 10px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid var(--border);
  }

  .item-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 6px;
    border-radius: 2px;
  }

  .item-row:hover { background: rgba(255,255,255,0.02); }

  .item-name {
    font-size: 13px;
    color: var(--text);
  }

  .remove-btn {
    width: 18px;
    height: 18px;
    padding: 0;
    font-size: 10px;
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    opacity: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 100ms;
  }

  .item-row:hover .remove-btn { opacity: 0.6; }
  .remove-btn:hover { color: var(--danger); opacity: 1 !important; }

  .empty-hint {
    font-size: 11px;
    color: var(--text-dim);
    opacity: 0.4;
    padding: 4px 6px;
    font-style: italic;
  }

  /* ---- Add row ---- */
  .add-row {
    display: flex;
    gap: 4px;
  }

  .add-input {
    flex: 1;
    font-size: 12px;
    padding: 4px 8px;
  }

  .add-btn {
    width: 28px;
    font-size: 14px;
    font-weight: 700;
    padding: 0;
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--accent-dim);
    border-radius: var(--radius);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .add-btn:hover { background: rgba(200,169,110,0.1); }

  .preset-toggle {
    font-size: 10px;
    padding: 3px 8px;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
    white-space: nowrap;
  }

  .preset-toggle:hover { color: var(--text); border-color: var(--border-focus); }

  /* ---- Presets grid ---- */
  .presets-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    max-height: 160px;
    overflow-y: auto;
    padding: 4px 0;
  }

  .preset-chip {
    font-size: 10px;
    padding: 2px 7px;
    color: var(--text-dim);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 2px;
    cursor: pointer;
    transition: all var(--transition);
    white-space: nowrap;
  }

  .preset-chip:hover {
    color: var(--accent);
    border-color: var(--accent-dim);
  }

  .all-added {
    font-size: 10px;
    color: var(--text-dim);
    opacity: 0.4;
    font-style: italic;
  }
</style>
