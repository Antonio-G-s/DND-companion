<!-- ============================================
     MagicItems.svelte — Magic Items Tracker
     
     Features:
     - Items loaded from JSON with import/export
     - Charge tracking with glowing buttons
     - Recovery text (e.g. "1d6 at dawn")
     - Item image display
     - isArtificerInfusion → red border
     - Spell references → click to open spell list
     - Auto-save to localStorage
     ============================================ -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { eventBus } from "../../lib/eventBus";
  import type { BusMessage } from "../../lib/types";

  /** A spell that a magic item can cast */
  interface ItemSpell {
    name: string;
    chargesUsed: number;
  }

  /** Magic item definition (loaded from JSON) */
  interface MagicItem {
    name: string;
    description: string;
    rarity: string;
    attunement: boolean;
    charges: {
      max: number;
      recovery: string;   // e.g. "1d6+1 at dawn", "all at dawn", "1 per short rest"
    };
    isArtificerInfusion: boolean;
    image: string;         // URL or data URI
    spells: ItemSpell[];
  }

  /** Runtime state for a magic item (charges used) */
  interface ItemState {
    item: MagicItem;
    chargesUsed: boolean[];   // which charge slots are spent
  }

  const RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"];

  // ---- State ----
  let items: ItemState[] = [];
  let showForm = false;
  let editingIndex: number | null = null;

  // ---- Form state ----
  let formItem: MagicItem = blankItem();

  // ---- Lifecycle ----
  let unsubscribe: () => void;

  onMount(() => {
    loadFromStorage();

    unsubscribe = eventBus.subscribe("magicItems", (msg: BusMessage) => {
      if (msg.action === "longRest") longRest();
      if (msg.action === "shortRest") shortRest();
    });
  });
  onDestroy(() => { if (unsubscribe) unsubscribe(); });

  // ============ BLANK / DEFAULT ============

  function blankItem(): MagicItem {
    return {
      name: "",
      description: "",
      rarity: "Common",
      attunement: false,
      charges: { max: 0, recovery: "" },
      isArtificerInfusion: false,
      image: "",
      spells: [],
    };
  }

  function getDefaultItems(): MagicItem[] {
    return [
      {
        name: "Wand of Fireballs",
        description: "This wand has 7 charges. While holding it, you can use an action to expend 1 or more of its charges to cast the Fireball spell from it. The wand regains 1d6+1 expended charges daily at dawn. If you expend the last charge, roll a d20. On a 1, the wand crumbles into ashes.",
        rarity: "Rare",
        attunement: true,
        charges: { max: 7, recovery: "1d6+1 at dawn" },
        isArtificerInfusion: false,
        image: "",
        spells: [{ name: "Fireball", chargesUsed: 1 }],
      },
      {
        name: "Bag of Holding",
        description: "This bag has an interior space considerably larger than its outside dimensions. The bag can hold up to 500 pounds, not exceeding a volume of 64 cubic feet.",
        rarity: "Uncommon",
        attunement: false,
        charges: { max: 0, recovery: "" },
        isArtificerInfusion: false,
        image: "",
        spells: [],
      },
      {
        name: "Cloak of Protection",
        description: "You gain a +1 bonus to AC and saving throws while you wear this cloak.",
        rarity: "Uncommon",
        attunement: true,
        charges: { max: 0, recovery: "" },
        isArtificerInfusion: true,
        image: "",
        spells: [],
      },
    ];
  }

  // ============ SAVE / LOAD ============

  function saveToStorage() {
    try {
      const data = items.map((s) => ({
        item: s.item,
        chargesUsed: s.chargesUsed,
      }));
      window.localStorage.setItem("dnd-magicitems", JSON.stringify(data));
    } catch {}
  }

  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem("dnd-magicitems");
      if (raw) {
        const data = JSON.parse(raw);
        items = data.map((d: any) => ({
          item: d.item,
          chargesUsed: d.chargesUsed || new Array(d.item.charges?.max || 0).fill(false),
        }));
        return;
      }
    } catch {}
    // Load defaults if nothing saved
    items = getDefaultItems().map(itemToState);
  }

  function itemToState(item: MagicItem): ItemState {
    return {
      item,
      chargesUsed: new Array(item.charges?.max || 0).fill(false),
    };
  }

  // ============ IMPORT / EXPORT ============

  function exportItems() {
    const data = items.map((s) => s.item);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "magic-items.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importItems() {
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
          items = data.map((d: MagicItem) => itemToState(d));
          saveToStorage();
        }
      } catch {
        console.error("Invalid magic items JSON");
      }
    };
    input.click();
  }

  // ============ ITEM ACTIONS ============

  function openAddForm() {
    formItem = blankItem();
    editingIndex = null;
    showForm = true;
  }

  function openEditForm(idx: number) {
    formItem = JSON.parse(JSON.stringify(items[idx].item));
    editingIndex = idx;
    showForm = true;
  }

  function saveItem() {
    if (!formItem.name.trim()) return;
    if (editingIndex !== null) {
      items[editingIndex].item = { ...formItem };
      // Resize charges array if max changed
      const max = formItem.charges?.max || 0;
      items[editingIndex].chargesUsed = new Array(max).fill(false);
    } else {
      items = [...items, itemToState({ ...formItem })];
    }
    showForm = false;
    items = items;
    saveToStorage();
  }

  function deleteItem(idx: number) {
    items = items.filter((_, i) => i !== idx);
    saveToStorage();
  }

  function cancelForm() {
    showForm = false;
  }

  // ---- Spell list for form ----
  let formSpellName = "";
  let formSpellCharges = 1;

  function addFormSpell() {
    if (!formSpellName.trim()) return;
    formItem.spells = [...formItem.spells, {
      name: formSpellName.trim(),
      chargesUsed: formSpellCharges,
    }];
    formSpellName = "";
    formSpellCharges = 1;
  }

  function removeFormSpell(idx: number) {
    formItem.spells = formItem.spells.filter((_, i) => i !== idx);
  }

  // ---- Image handling ----
  function handleImageUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      formItem.image = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // ============ CHARGE TRACKING ============

  function toggleCharge(itemIdx: number, chargeIdx: number) {
    items[itemIdx].chargesUsed[chargeIdx] = !items[itemIdx].chargesUsed[chargeIdx];
    items = items;
    saveToStorage();
  }

  function availableCharges(state: ItemState): number {
    return state.chargesUsed.filter((u) => !u).length;
  }

  // ============ REST ============

  function longRest() {
    for (const s of items) {
      s.chargesUsed = new Array(s.item.charges?.max || 0).fill(false);
    }
    items = items;
    saveToStorage();
  }

  function shortRest() {
    // Short rest: only reset items whose recovery mentions "short rest"
    for (const s of items) {
      if (s.item.charges.recovery.toLowerCase().includes("short rest")) {
        s.chargesUsed = new Array(s.item.charges?.max || 0).fill(false);
      }
    }
    items = items;
    saveToStorage();
  }

  // ============ SPELL CROSS-REFERENCE ============

  /** Click a spell name → open Spell List and highlight it */
  function openSpellInList(spellName: string) {
    // Tell App.svelte to open the spell list window
    eventBus.send({
      target: "*",
      source: "magicItems",
      action: "openApp",
      appId: "spellList",
    });
    // Tell SpellList to highlight the spell
    setTimeout(() => {
      eventBus.send({
        target: "spellList",
        source: "magicItems",
        action: "showSpell",
        spellName,
      });
    }, 200);
  }

  // ============ DISPLAY HELPERS ============

  function rarityColor(rarity: string): string {
    const map: Record<string, string> = {
      Common: "#888888",
      Uncommon: "#44aa44",
      Rare: "#4488cc",
      "Very Rare": "#9944cc",
      Legendary: "#cc8800",
      Artifact: "#cc4444",
    };
    return map[rarity] || "#888888";
  }

  function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
</script>

<div class="magic-items">
  <!-- Controls -->
  <div class="controls-row">
    <button on:click={openAddForm}>+ Add Item</button>
    <button on:click={importItems}>Import</button>
    <button on:click={exportItems}>Export</button>
    <button on:click={longRest}>Long Rest</button>
    <button class="sr-btn" on:click={shortRest}>Short Rest</button>
  </div>

  <!-- Add/Edit form -->
  {#if showForm}
    <div class="item-form">
      <div class="form-title">{editingIndex !== null ? "Edit Item" : "New Magic Item"}</div>

      <label class="fl">
        Name
        <input type="text" bind:value={formItem.name} placeholder="Wand of Fireballs" />
      </label>

      <div class="form-row">
        <label class="fl">
          Rarity
          <select bind:value={formItem.rarity}>
            {#each RARITIES as r}<option value={r}>{r}</option>{/each}
          </select>
        </label>
        <label class="fl check-row">
          <input type="checkbox" bind:checked={formItem.attunement} /> Attunement
        </label>
        <label class="fl check-row infusion-check">
          <input type="checkbox" bind:checked={formItem.isArtificerInfusion} /> Artificer Infusion
        </label>
      </div>

      <div class="form-row">
        <label class="fl narrow">
          Max Charges
          <input type="number" min="0" max="50" bind:value={formItem.charges.max} />
        </label>
        <label class="fl">
          Recovery
          <input type="text" bind:value={formItem.charges.recovery} placeholder="1d6+1 at dawn" />
        </label>
      </div>

      <label class="fl">
        Description
        <textarea bind:value={formItem.description} rows="3" placeholder="Item description..."></textarea>
      </label>

      <label class="fl">
        Image
        <input type="file" accept="image/*" on:change={handleImageUpload} class="file-input" />
        {#if formItem.image}
          <img src={formItem.image} alt="preview" class="img-preview" />
        {/if}
      </label>

      <!-- Spells this item can cast -->
      <div class="spells-section">
        <span class="sub-title">Spells</span>
        {#if formItem.spells.length > 0}
          <div class="spell-tags">
            {#each formItem.spells as sp, si}
              <span class="spell-tag">
                {sp.name} ({sp.chargesUsed})
                <button class="tag-remove" on:click={() => removeFormSpell(si)}>✕</button>
              </span>
            {/each}
          </div>
        {/if}
        <div class="add-spell-row">
          <input type="text" bind:value={formSpellName} placeholder="Spell name" class="spell-name-input" />
          <input type="number" min="1" max="20" bind:value={formSpellCharges} class="charge-cost-input" title="Charges used" />
          <button class="add-spell-btn" on:click={addFormSpell}>+</button>
        </div>
      </div>

      <div class="form-actions">
        <button class="action-btn primary" on:click={saveItem}>Save</button>
        <button class="action-btn" on:click={cancelForm}>Cancel</button>
      </div>
    </div>
  {/if}

  <!-- Item cards -->
  <div class="item-cards">
    {#each items as state, idx (state.item.name + idx)}
      {@const item = state.item}
      {@const isInfusion = item.isArtificerInfusion}
      <div
        class="item-card"
        class:infusion={isInfusion}
        style="border-left-color: {isInfusion ? '#cc4444' : rarityColor(item.rarity)};"
      >
        <!-- Header -->
        <div class="card-top">
          {#if item.image}
            <img src={item.image} alt={item.name} class="item-img" />
          {/if}
          <div class="card-header">
            <span class="item-name">{item.name}</span>
            <div class="item-tags">
              <span class="rarity-tag" style="color:{rarityColor(item.rarity)}">{item.rarity}</span>
              {#if item.attunement}
                <span class="att-tag">Attunement</span>
              {/if}
              {#if isInfusion}
                <span class="infusion-tag">Infusion</span>
              {/if}
            </div>
          </div>
        </div>

        <!-- Charges -->
        {#if item.charges.max > 0}
          <div class="charges-section">
            <div class="charges-header">
              <span class="charges-label">
                Charges: {availableCharges(state)}/{item.charges.max}
              </span>
              {#if item.charges.recovery}
                <span class="recovery-text">⟲ {item.charges.recovery}</span>
              {/if}
            </div>
            <div class="charge-buttons">
              {#each state.chargesUsed as isUsed, ci}
                <button
                  class="charge-btn"
                  class:used={isUsed}
                  class:available={!isUsed}
                  class:infusion-glow={isInfusion && !isUsed}
                  on:click={() => toggleCharge(idx, ci)}
                  title={isUsed ? "Click to restore" : "Click to use"}
                >
                  <span class="charge-inner"></span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Spells this item can cast -->
        {#if item.spells.length > 0}
          <div class="item-spells">
            {#each item.spells as sp}
              <button
                class="spell-link"
                on:click={() => openSpellInList(sp.name)}
                title="Open in Spell List"
              >
                ✦ {sp.name}
                {#if sp.chargesUsed > 0}
                  <span class="spell-cost">({sp.chargesUsed} charge{sp.chargesUsed > 1 ? "s" : ""})</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}

        <!-- Description -->
        <p class="item-desc">{item.description}</p>

        <!-- Card actions -->
        <div class="card-actions">
          <button class="small-btn" on:click={() => openEditForm(idx)}>Edit</button>
          <button class="small-btn danger" on:click={() => deleteItem(idx)}>Del</button>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .magic-items {
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

  .sr-btn {
    color: #64b4ff !important;
    border-color: rgba(100, 180, 255, 0.3) !important;
  }
  .sr-btn:hover {
    background: rgba(100, 180, 255, 0.08) !important;
  }

  /* ======== FORM ======== */
  .item-form {
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

  .fl input[type="text"],
  .fl input[type="number"],
  .fl select,
  .fl textarea {
    font-size: 13px;
    text-transform: none;
  }

  .fl.narrow { flex: 0 0 100px; }

  .check-row {
    flex-direction: row !important;
    align-items: center;
    gap: 5px !important;
    font-size: 12px !important;
    color: var(--text) !important;
    text-transform: none !important;
  }

  .infusion-check input:checked + * {
    color: #cc4444;
  }

  .form-row {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .form-row .fl { flex: 1; }

  .file-input {
    font-size: 12px !important;
    padding: 4px !important;
  }

  .img-preview {
    max-width: 120px;
    max-height: 80px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    margin-top: 4px;
    object-fit: cover;
  }

  .form-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .action-btn {
    padding: 6px 14px;
    font-size: 12px;
    color: var(--text);
    border: 1px solid var(--border);
    background: var(--bg-input);
  }

  .action-btn.primary {
    color: var(--accent);
    border-color: var(--accent-dim);
  }

  /* ---- Spells sub-form ---- */
  .spells-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sub-title {
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .spell-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .spell-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 12px;
    background: rgba(200, 169, 110, 0.1);
    border: 1px solid var(--accent-dim);
    border-radius: 2px;
    color: var(--accent);
  }

  .tag-remove {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 10px;
    padding: 0 2px;
    cursor: pointer;
  }
  .tag-remove:hover { color: var(--danger); }

  .add-spell-row {
    display: flex;
    gap: 4px;
  }

  .spell-name-input { flex: 1; font-size: 12px; }
  .charge-cost-input { width: 48px; text-align: center; font-size: 12px; }
  .add-spell-btn {
    width: 28px;
    font-size: 14px;
    padding: 0;
    color: var(--accent);
    border-color: var(--accent-dim);
  }

  /* ======== ITEM CARDS ======== */
  .item-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .item-card {
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-left: 3px solid var(--text-dim);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color 200ms ease;
  }

  /* Artificer infusion → red border */
  .item-card.infusion {
    border-color: rgba(204, 68, 68, 0.4);
    border-left-color: #cc4444 !important;
    box-shadow: inset 0 0 12px rgba(204, 68, 68, 0.05);
  }

  .card-top {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .item-img {
    width: 56px;
    height: 56px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    object-fit: cover;
    flex-shrink: 0;
  }

  .card-header {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .item-name {
    font-family: var(--font-heading);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-bright);
  }

  .item-tags {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }

  .rarity-tag {
    font-size: 11px;
    font-weight: 600;
  }

  .att-tag {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 2px;
    background: rgba(200, 169, 110, 0.12);
    color: var(--accent);
  }

  .infusion-tag {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 2px;
    background: rgba(204, 68, 68, 0.15);
    color: #cc4444;
    font-weight: 600;
  }

  /* ---- Charges ---- */
  .charges-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .charges-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .charges-label {
    font-size: 12px;
    color: var(--text);
    font-weight: 600;
  }

  .recovery-text {
    font-size: 11px;
    color: var(--text-dim);
    font-style: italic;
  }

  .charge-buttons {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .charge-btn {
    width: 28px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 3px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 200ms ease;
  }

  .charge-inner {
    width: 16px;
    height: 10px;
    border-radius: 2px;
    transition: all 200ms ease;
  }

  /* Available charge — gold glow */
  .charge-btn.available {
    border-color: var(--accent-dim);
    background: rgba(200, 169, 110, 0.08);
    box-shadow: 0 0 6px rgba(200, 169, 110, 0.25);
  }
  .charge-btn.available .charge-inner {
    background: var(--accent);
    box-shadow: 0 0 4px rgba(200, 169, 110, 0.5);
  }
  .charge-btn.available:hover {
    box-shadow: 0 0 10px rgba(200, 169, 110, 0.4);
    transform: scale(1.1);
  }

  /* Infusion charge — red glow */
  .charge-btn.infusion-glow {
    border-color: rgba(204, 68, 68, 0.4) !important;
    background: rgba(204, 68, 68, 0.06) !important;
    box-shadow: 0 0 6px rgba(204, 68, 68, 0.25) !important;
  }
  .charge-btn.infusion-glow .charge-inner {
    background: #cc4444 !important;
    box-shadow: 0 0 4px rgba(204, 68, 68, 0.5) !important;
  }
  .charge-btn.infusion-glow:hover {
    box-shadow: 0 0 10px rgba(204, 68, 68, 0.4) !important;
  }

  /* Used charge — dark */
  .charge-btn.used {
    border-color: var(--border);
    background: var(--bg);
    box-shadow: none;
  }
  .charge-btn.used .charge-inner {
    background: var(--bg-input);
    box-shadow: none;
  }
  .charge-btn.used:hover {
    border-color: var(--border-focus);
    transform: scale(1.05);
  }

  /* ---- Spells the item can cast ---- */
  .item-spells {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .spell-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    font-size: 12px;
    color: var(--accent);
    background: rgba(200, 169, 110, 0.06);
    border: 1px solid var(--accent-dim);
    border-radius: var(--radius);
    cursor: pointer;
    transition: background 150ms ease;
  }
  .spell-link:hover {
    background: rgba(200, 169, 110, 0.15);
  }

  .spell-cost {
    font-size: 10px;
    color: var(--text-dim);
  }

  /* ---- Description ---- */
  .item-desc {
    font-size: 13px;
    color: var(--text);
    line-height: 1.5;
  }

  .card-actions {
    display: flex;
    gap: 4px;
  }

  .small-btn {
    font-size: 11px;
    padding: 2px 8px;
    border: none;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }
  .small-btn:hover { color: var(--text); }
  .small-btn.danger:hover { color: var(--danger); }
</style>
