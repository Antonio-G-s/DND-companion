<!-- ============================================
     Traits.svelte — Traits & Feats
     
     Three categories:
       - Class Features (from class/subclass)
       - Species Traits (racial features)
       - Feats (chosen feats/boons)
     
     Each entry: title, description, source,
     level obtained, optional uses/recharge,
     future link stubs for skills & spells.
     
     Import/export JSON, auto-save.
     ============================================ -->
<script lang="ts">
  import { onMount } from "svelte";

  type TraitCategory = "classFeature" | "speciesTrait" | "feat";

  interface Trait {
    id: string;
    category: TraitCategory;
    title: string;
    description: string;
    source: string;          // e.g. "Fighter 3", "Half-Elf", "Alert"
    levelObtained: number;   // 0 = always had (species/feat)
    /** Optional limited uses */
    uses: {
      max: number;           // 0 = passive / unlimited
      current: number;
      recharge: string;      // e.g. "Long Rest", "Short Rest", ""
    };
    /** Future: link to skills by name */
    linkedSkills: string[];
    /** Future: link to spells by name */
    linkedSpells: string[];
    /** Is this an active ability or passive? */
    passive: boolean;
  }

  const CATEGORIES: TraitCategory[] = ["classFeature", "speciesTrait", "feat"];

  const CATEGORY_LABELS: Record<TraitCategory, string> = {
    classFeature: "Class Features",
    speciesTrait: "Species Traits",
    feat: "Feats",
  };

  const CATEGORY_COLORS: Record<TraitCategory, string> = {
    classFeature: "#cc8833",
    speciesTrait: "#44aa88",
    feat: "#8866cc",
  };

  // ---- State ----
  let traits: Trait[] = [];
  let activeTab: TraitCategory = "classFeature";
  let searchQuery = "";
  let showForm = false;
  let editingId: string | null = null;

  // ---- Form ----
  let form: Trait = blankTrait();

  onMount(() => { loadFromStorage(); });

  function genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function blankTrait(): Trait {
    return {
      id: genId(),
      category: activeTab,
      title: "",
      description: "",
      source: "",
      levelObtained: 1,
      uses: { max: 0, current: 0, recharge: "" },
      linkedSkills: [],
      linkedSpells: [],
      passive: true,
    };
  }

  // ============ SAVE / LOAD ============

  function saveToStorage() {
    try {
      window.localStorage.setItem("dnd-traits", JSON.stringify(traits));
    } catch {}
  }

  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem("dnd-traits");
      if (raw) {
        traits = JSON.parse(raw);
        return;
      }
    } catch {}
    traits = getDefaults();
  }

  function getDefaults(): Trait[] {
    return [
      {
        id: genId(), category: "classFeature", title: "Fighting Style",
        description: "You adopt a particular style of fighting as your specialty. Choose one: Defense, Dueling, Great Weapon Fighting, Protection, or Two-Weapon Fighting.",
        source: "Fighter 1", levelObtained: 1,
        uses: { max: 0, current: 0, recharge: "" },
        linkedSkills: [], linkedSpells: [], passive: true,
      },
      {
        id: genId(), category: "classFeature", title: "Second Wind",
        description: "You have a limited well of stamina. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.",
        source: "Fighter 1", levelObtained: 1,
        uses: { max: 1, current: 1, recharge: "Short Rest" },
        linkedSkills: [], linkedSpells: [], passive: false,
      },
      {
        id: genId(), category: "classFeature", title: "Action Surge",
        description: "You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action. Once you use this feature, you must finish a short or long rest before you can use it again.",
        source: "Fighter 2", levelObtained: 2,
        uses: { max: 1, current: 1, recharge: "Short Rest" },
        linkedSkills: [], linkedSpells: [], passive: false,
      },
      {
        id: genId(), category: "speciesTrait", title: "Darkvision",
        description: "You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.",
        source: "Half-Elf", levelObtained: 0,
        uses: { max: 0, current: 0, recharge: "" },
        linkedSkills: [], linkedSpells: [], passive: true,
      },
      {
        id: genId(), category: "speciesTrait", title: "Fey Ancestry",
        description: "You have advantage on saving throws against being charmed, and magic can't put you to sleep.",
        source: "Half-Elf", levelObtained: 0,
        uses: { max: 0, current: 0, recharge: "" },
        linkedSkills: [], linkedSpells: [], passive: true,
      },
      {
        id: genId(), category: "feat", title: "Alert",
        description: "+5 bonus to initiative. You can't be surprised while you are conscious. Other creatures don't gain advantage on attack rolls against you as a result of being unseen by you.",
        source: "Feat", levelObtained: 0,
        uses: { max: 0, current: 0, recharge: "" },
        linkedSkills: [], linkedSpells: [], passive: true,
      },
    ];
  }

  // ============ IMPORT / EXPORT ============

  function exportTraits() {
    const json = JSON.stringify(traits, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "traits-and-feats.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importTraits() {
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
          traits = data;
          saveToStorage();
        }
      } catch {
        console.error("Invalid traits JSON");
      }
    };
    input.click();
  }

  // ============ CRUD ============

  function openAddForm() {
    form = blankTrait();
    form.category = activeTab;
    editingId = null;
    showForm = true;
  }

  function openEditForm(trait: Trait) {
    form = JSON.parse(JSON.stringify(trait));
    editingId = trait.id;
    showForm = true;
  }

  function saveForm() {
    if (!form.title.trim()) return;
    if (editingId) {
      const idx = traits.findIndex((t) => t.id === editingId);
      if (idx !== -1) traits[idx] = { ...form };
    } else {
      form.id = genId();
      traits = [...traits, { ...form }];
    }
    showForm = false;
    traits = traits;
    saveToStorage();
  }

  function deleteTrait(id: string) {
    traits = traits.filter((t) => t.id !== id);
    saveToStorage();
  }

  function cancelForm() { showForm = false; }

  // ============ USES TRACKING ============

  function useCharge(trait: Trait) {
    if (trait.uses.current > 0) {
      trait.uses.current--;
      traits = traits;
      saveToStorage();
    }
  }

  function restoreCharge(trait: Trait) {
    if (trait.uses.current < trait.uses.max) {
      trait.uses.current++;
      traits = traits;
      saveToStorage();
    }
  }

  function restoreAll(rechargeType: string) {
    for (const t of traits) {
      if (t.uses.max > 0) {
        if (rechargeType === "Long Rest" || t.uses.recharge === rechargeType) {
          t.uses.current = t.uses.max;
        }
      }
    }
    traits = traits;
    saveToStorage();
  }

  // ============ COMPUTED ============

  $: filtered = (() => {
    let result = traits.filter((t) => t.category === activeTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.source.toLowerCase().includes(q)
      );
    }
    // Sort: class features by level, others by title
    if (activeTab === "classFeature") {
      result.sort((a, b) => a.levelObtained - b.levelObtained || a.title.localeCompare(b.title));
    } else {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }
    return result;
  })();

  $: tabCounts = {
    classFeature: traits.filter((t) => t.category === "classFeature").length,
    speciesTrait: traits.filter((t) => t.category === "speciesTrait").length,
    feat: traits.filter((t) => t.category === "feat").length,
  };
</script>

<div class="traits-app">
  <!-- Controls -->
  <div class="controls-row">
    <button class="action-btn primary" on:click={openAddForm}>+ Add</button>
    <button class="action-btn" on:click={importTraits}>Import</button>
    <button class="action-btn" on:click={exportTraits}>Export</button>
    <button class="action-btn sr-btn" on:click={() => restoreAll("Short Rest")}>Short Rest</button>
    <button class="action-btn" on:click={() => restoreAll("Long Rest")}>Long Rest</button>
  </div>

  <!-- Category tabs -->
  <div class="tabs">
    {#each CATEGORIES as cat}
      <button
        class="tab"
        class:active={activeTab === cat}
        style="{activeTab === cat ? `border-color:${CATEGORY_COLORS[cat]}; color:${CATEGORY_COLORS[cat]};` : ''}"
        on:click={() => { activeTab = cat; }}
      >
        {CATEGORY_LABELS[cat]}
        <span class="tab-count">{tabCounts[cat]}</span>
      </button>
    {/each}
  </div>

  <!-- Search -->
  <input type="text" class="search-input" bind:value={searchQuery}
         placeholder="Search {CATEGORY_LABELS[activeTab].toLowerCase()}..." />

  <!-- Add/Edit form -->
  {#if showForm}
    <div class="trait-form">
      <div class="form-title">{editingId ? "Edit" : "Add"} {CATEGORY_LABELS[form.category].slice(0, -1)}</div>

      <label class="fl">
        Title
        <input type="text" bind:value={form.title} placeholder="Feature name" />
      </label>

      <div class="form-row">
        <label class="fl">
          Category
          <select bind:value={form.category}>
            {#each CATEGORIES as cat}
              <option value={cat}>{CATEGORY_LABELS[cat]}</option>
            {/each}
          </select>
        </label>
        <label class="fl">
          Source
          <input type="text" bind:value={form.source} placeholder="e.g. Fighter 2, Elf" />
        </label>
      </div>

      {#if form.category === "classFeature"}
        <label class="fl narrow">
          Level Obtained
          <input type="number" min="1" max="20" bind:value={form.levelObtained} />
        </label>
      {/if}

      <label class="fl">
        Description
        <textarea bind:value={form.description} rows="3" placeholder="What does this do?"></textarea>
      </label>

      <div class="form-row">
        <label class="fl check-label">
          <input type="checkbox" bind:checked={form.passive} /> Passive (always active)
        </label>
      </div>

      {#if !form.passive}
        <div class="form-row">
          <label class="fl narrow">
            Max Uses
            <input type="number" min="0" max="20" bind:value={form.uses.max}
                   on:change={() => { form.uses.current = form.uses.max; }} />
          </label>
          <label class="fl">
            Recharge
            <select bind:value={form.uses.recharge}>
              <option value="">None</option>
              <option value="Short Rest">Short Rest</option>
              <option value="Long Rest">Long Rest</option>
              <option value="Dawn">Dawn</option>
            </select>
          </label>
        </div>
      {/if}

      <div class="form-actions">
        <button class="action-btn primary" on:click={saveForm}>Save</button>
        <button class="action-btn" on:click={cancelForm}>Cancel</button>
      </div>
    </div>
  {/if}

  <!-- Trait cards -->
  <div class="trait-list">
    {#each filtered as trait (trait.id)}
      {@const catColor = CATEGORY_COLORS[trait.category]}
      <div class="trait-card" style="border-left-color:{catColor};">
        <div class="card-top">
          <div class="card-header">
            <span class="trait-title">{trait.title}</span>
            {#if trait.source}
              <span class="trait-source">{trait.source}</span>
            {/if}
          </div>
          <div class="card-badges">
            {#if trait.passive}
              <span class="badge passive-badge">Passive</span>
            {/if}
            {#if trait.category === "classFeature" && trait.levelObtained > 0}
              <span class="badge level-badge">Lvl {trait.levelObtained}</span>
            {/if}
          </div>
        </div>

        <p class="trait-desc">{trait.description}</p>

        <!-- Uses tracker -->
        {#if !trait.passive && trait.uses.max > 0}
          <div class="uses-row">
            <span class="uses-label">
              Uses: {trait.uses.current}/{trait.uses.max}
              {#if trait.uses.recharge}
                <span class="recharge-tag">{trait.uses.recharge}</span>
              {/if}
            </span>
            <div class="uses-buttons">
              {#each Array(trait.uses.max) as _, i}
                <button
                  class="use-dot"
                  class:available={i < trait.uses.current}
                  class:spent={i >= trait.uses.current}
                  style="{i < trait.uses.current ? `background:${catColor}; box-shadow:0 0 4px ${catColor};` : ''}"
                  on:click={() => {
                    if (i < trait.uses.current) useCharge(trait);
                    else restoreCharge(trait);
                  }}
                  title={i < trait.uses.current ? "Click to use" : "Click to restore"}
                ></button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Future link stubs -->
        {#if trait.linkedSpells.length > 0}
          <div class="link-row">
            <span class="link-label">Spells:</span>
            {#each trait.linkedSpells as sp}
              <span class="link-tag spell-link">{sp}</span>
            {/each}
          </div>
        {/if}
        {#if trait.linkedSkills.length > 0}
          <div class="link-row">
            <span class="link-label">Skills:</span>
            {#each trait.linkedSkills as sk}
              <span class="link-tag skill-link">{sk}</span>
            {/each}
          </div>
        {/if}

        <div class="card-actions">
          <button class="small-btn" on:click={() => openEditForm(trait)}>Edit</button>
          <button class="small-btn danger" on:click={() => deleteTrait(trait.id)}>Del</button>
        </div>
      </div>
    {/each}

    {#if filtered.length === 0}
      <div class="empty">{searchQuery ? "No matches." : "None added yet."}</div>
    {/if}
  </div>
</div>

<style>
  .traits-app {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .controls-row {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }

  .action-btn {
    font-size: 11px;
    padding: 4px 10px;
    color: var(--text);
    border: 1px solid var(--border);
    background: var(--bg-input);
    cursor: pointer;
  }
  .action-btn.primary { color: var(--accent); border-color: var(--accent-dim); }
  .action-btn.primary:hover { background: rgba(200,169,110,0.1); }
  .sr-btn { color: #64b4ff !important; border-color: rgba(100,180,255,0.3) !important; }
  .sr-btn:hover { background: rgba(100,180,255,0.06) !important; }

  /* ---- Tabs ---- */
  .tabs { display: flex; gap: 2px; }

  .tab {
    flex: 1;
    padding: 6px 6px;
    font-size: 11px;
    color: var(--text-dim);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    text-align: center;
    cursor: pointer;
    transition: all var(--transition);
  }
  .tab:hover { color: var(--text); border-color: var(--border-focus); }
  .tab.active { background: rgba(255,255,255,0.02); }
  .tab-count { font-size: 9px; opacity: 0.5; margin-left: 2px; }

  .search-input { font-size: 12px; padding: 5px 10px; }

  /* ---- Form ---- */
  .trait-form {
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
    font-size: 12px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .fl {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .fl input, .fl select, .fl textarea { font-size: 13px; text-transform: none; }
  .fl.narrow { flex: 0 0 100px; }

  .check-label {
    flex-direction: row !important;
    align-items: center;
    gap: 5px !important;
    font-size: 12px !important;
    color: var(--text) !important;
    text-transform: none !important;
    cursor: pointer;
  }

  .form-row { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
  .form-row .fl { flex: 1; }

  .form-actions { display: flex; gap: 6px; margin-top: 4px; }

  /* ---- Trait cards ---- */
  .trait-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .trait-card {
    padding: 10px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-left: 3px solid var(--text-dim);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }

  .card-header {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .trait-title {
    font-family: var(--font-heading);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-bright);
  }

  .trait-source {
    font-size: 11px;
    color: var(--text-dim);
    font-style: italic;
  }

  .card-badges {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 2px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .passive-badge {
    background: rgba(255,255,255,0.06);
    color: var(--text-dim);
  }

  .level-badge {
    background: rgba(200,169,110,0.12);
    color: var(--accent);
  }

  .trait-desc {
    font-size: 12px;
    color: var(--text);
    line-height: 1.5;
  }

  /* ---- Uses ---- */
  .uses-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .uses-label {
    font-size: 11px;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .recharge-tag {
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 2px;
    background: rgba(100,180,255,0.12);
    color: #64b4ff;
    font-weight: 600;
  }

  .uses-buttons {
    display: flex;
    gap: 4px;
  }

  .use-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid var(--border);
    cursor: pointer;
    padding: 0;
    transition: all 150ms ease;
  }

  .use-dot.available:hover {
    transform: scale(1.2);
    opacity: 0.7;
  }

  .use-dot.spent {
    background: var(--bg-input);
  }

  .use-dot.spent:hover {
    border-color: var(--border-focus);
    transform: scale(1.15);
  }

  /* ---- Links (future) ---- */
  .link-row {
    display: flex;
    gap: 4px;
    align-items: center;
    flex-wrap: wrap;
  }

  .link-label {
    font-size: 10px;
    color: var(--text-dim);
  }

  .link-tag {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 2px;
    cursor: pointer;
  }

  .spell-link {
    background: rgba(200,169,110,0.1);
    color: var(--accent);
    border: 1px solid var(--accent-dim);
  }

  .skill-link {
    background: rgba(100,180,255,0.08);
    color: #64b4ff;
    border: 1px solid rgba(100,180,255,0.3);
  }

  .card-actions {
    display: flex;
    gap: 4px;
    margin-top: 2px;
  }

  .small-btn {
    font-size: 10px;
    padding: 2px 8px;
    border: none;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }
  .small-btn:hover { color: var(--text); }
  .small-btn.danger:hover { color: var(--danger); }

  .empty {
    text-align: center;
    padding: 20px;
    font-size: 12px;
    color: var(--text-dim);
    opacity: 0.4;
  }
</style>
