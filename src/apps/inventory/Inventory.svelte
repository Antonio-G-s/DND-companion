<!-- ============================================
     Inventory.svelte — Inventory v2
     
     Categories: Equipment, Items, Crafting Goods
     Equipment types: General, Weapon, Armor,
       Magic Weapon, Magic Armor, Magic Equipment
     Weapon stats: attack ability, damage, type
     Attunement counter with configurable max
     Magic item linking
     ============================================ -->
<script lang="ts">
  import { onMount } from "svelte";
  import { eventBus } from "../../lib/eventBus";

  type Category = "equipment" | "items" | "crafting";
  type EquipType = "general" | "weapon" | "armor" | "magicWeapon" | "magicArmor" | "magicEquipment";
  type AttackAbility = "str" | "dex" | "finesse";

  interface WeaponStats {
    attackAbility: AttackAbility;
    damageDice: string;
    damageType: string;
    properties: string;
    magicBonus: number;
    range: string;
  }

  interface InventoryItem {
    name: string;
    category: Category;
    equipmentType: EquipType;
    description: string;
    weight: number;
    valueGP: number;
    quantity: number;
    attuned: boolean;
    linkedMagicItem: string;
    weapon: WeaponStats | null;
  }

  interface InventoryData {
    items: InventoryItem[];
    maxAttunement: number;
  }

  const CATEGORIES: Category[] = ["equipment", "items", "crafting"];
  const CATEGORY_LABELS: Record<Category, string> = {
    equipment: "Equipment", items: "Items", crafting: "Crafting Goods",
  };

  const EQUIP_TYPES: EquipType[] = ["general", "weapon", "armor", "magicWeapon", "magicArmor", "magicEquipment"];
  const EQUIP_LABELS: Record<EquipType, string> = {
    general: "General", weapon: "Weapon", armor: "Armor",
    magicWeapon: "Magic Weapon", magicArmor: "Magic Armor", magicEquipment: "Magic Equipment",
  };

  const DAMAGE_TYPES = [
    "Slashing", "Piercing", "Bludgeoning", "Fire", "Cold", "Lightning",
    "Thunder", "Acid", "Poison", "Necrotic", "Radiant", "Force", "Psychic",
  ];

  // ---- State ----
  let inventory: InventoryItem[] = [];
  let maxAttunement = 3;
  let activeTab: Category = "equipment";
  let showForm = false;
  let editingIndex: number | null = null;
  let searchQuery = "";

  let form: InventoryItem = blankItem();

  onMount(() => { loadFromStorage(); });

  function blankItem(): InventoryItem {
    return {
      name: "", category: activeTab, equipmentType: "general",
      description: "", weight: 0, valueGP: 0, quantity: 1,
      attuned: false, linkedMagicItem: "",
      weapon: null,
    };
  }

  function blankWeapon(): WeaponStats {
    return {
      attackAbility: "str", damageDice: "1D8", damageType: "Slashing",
      properties: "", magicBonus: 0, range: "5 ft",
    };
  }

  // ============ SAVE / LOAD ============

  function saveToStorage() {
    try {
      const data: InventoryData = { items: inventory, maxAttunement };
      window.localStorage.setItem("dnd-inventory", JSON.stringify(data));
    } catch {}
  }

  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem("dnd-inventory");
      if (raw) {
        const parsed = JSON.parse(raw);
        // Support old format (plain array) and new format
        if (Array.isArray(parsed)) {
          inventory = parsed.map(migrateItem);
          maxAttunement = 3;
        } else {
          inventory = (parsed.items || []).map(migrateItem);
          maxAttunement = parsed.maxAttunement ?? 3;
        }
        return;
      }
    } catch {}
    inventory = getDefaults();
  }

  /** Migrate old items missing new fields */
  function migrateItem(item: any): InventoryItem {
    return {
      ...item,
      equipmentType: item.equipmentType || "general",
      attuned: item.attuned || false,
      linkedMagicItem: item.linkedMagicItem || "",
      weapon: item.weapon || null,
    };
  }

  function getDefaults(): InventoryItem[] {
    return [
      { name: "Longsword", category: "equipment", equipmentType: "weapon", description: "Versatile martial weapon.",
        weight: 3, valueGP: 15, quantity: 1, attuned: false, linkedMagicItem: "",
        weapon: { attackAbility: "str", damageDice: "1D8", damageType: "Slashing", properties: "Versatile (1D10)", magicBonus: 0, range: "5 ft" } },
      { name: "Longbow", category: "equipment", equipmentType: "weapon", description: "Ranged martial weapon.",
        weight: 2, valueGP: 50, quantity: 1, attuned: false, linkedMagicItem: "",
        weapon: { attackAbility: "dex", damageDice: "1D8", damageType: "Piercing", properties: "Ammunition, Heavy, Two-Handed", magicBonus: 0, range: "150/600 ft" } },
      { name: "Chain Mail", category: "equipment", equipmentType: "armor", description: "Heavy armor. AC 16. Str 13 required.", weight: 55, valueGP: 75, quantity: 1, attuned: false, linkedMagicItem: "", weapon: null },
      { name: "Shield", category: "equipment", equipmentType: "armor", description: "+2 bonus to AC.", weight: 6, valueGP: 10, quantity: 1, attuned: false, linkedMagicItem: "", weapon: null },
      { name: "Healing Potion", category: "items", equipmentType: "general", description: "Regain 2d4+2 hit points.", weight: 0.5, valueGP: 50, quantity: 3, attuned: false, linkedMagicItem: "", weapon: null },
      { name: "Torch", category: "items", equipmentType: "general", description: "Bright light 20 ft, dim light 20 ft beyond.", weight: 1, valueGP: 0.01, quantity: 5, attuned: false, linkedMagicItem: "", weapon: null },
      { name: "Iron Ingot", category: "crafting", equipmentType: "general", description: "A bar of refined iron.", weight: 5, valueGP: 1, quantity: 10, attuned: false, linkedMagicItem: "", weapon: null },
    ];
  }

  // ============ IMPORT / EXPORT ============

  function exportInventory() {
    const data: InventoryData = { items: inventory, maxAttunement };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventory.json"; a.click();
    URL.revokeObjectURL(url);
  }

  function importInventory() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          inventory = data.map(migrateItem);
        } else if (data.items) {
          inventory = data.items.map(migrateItem);
          maxAttunement = data.maxAttunement ?? 3;
        }
        saveToStorage();
      } catch { console.error("Invalid inventory JSON"); }
    };
    input.click();
  }

  // ============ CRUD ============

  function openAddForm() {
    form = blankItem(); form.category = activeTab;
    editingIndex = null; showForm = true;
  }

  function openEditForm(idx: number) {
    form = JSON.parse(JSON.stringify(inventory[idx]));
    editingIndex = idx; showForm = true;
  }

  function saveForm() {
    if (!form.name.trim()) return;
    if (form.quantity < 1) form.quantity = 1;
    // Ensure weapon stats exist for weapon types
    if (isWeaponType(form.equipmentType) && !form.weapon) {
      form.weapon = blankWeapon();
    }
    if (!isWeaponType(form.equipmentType)) {
      form.weapon = null;
    }
    if (editingIndex !== null) {
      inventory[editingIndex] = { ...form };
    } else {
      inventory = [...inventory, { ...form }];
    }
    showForm = false; inventory = inventory; saveToStorage();
  }

  function deleteItem(idx: number) {
    inventory = inventory.filter((_, i) => i !== idx); saveToStorage();
  }

  function cancelForm() { showForm = false; }

  function adjustQty(idx: number, delta: number) {
    inventory[idx].quantity = Math.max(0, inventory[idx].quantity + delta);
    if (inventory[idx].quantity === 0) inventory = inventory.filter((_, i) => i !== idx);
    inventory = inventory; saveToStorage();
  }

  function toggleAttune(idx: number) {
    const item = inventory[idx];
    if (item.attuned) {
      item.attuned = false;
    } else if (attunedCount < maxAttunement) {
      item.attuned = true;
    }
    inventory = inventory; saveToStorage();
  }

  function onEquipTypeChange() {
    if (isWeaponType(form.equipmentType) && !form.weapon) {
      form.weapon = blankWeapon();
    }
  }

  /** Open linked magic item */
  function openMagicItem(name: string) {
    eventBus.send({ target: "*", source: "inventory", action: "openApp", appId: "magicItems" });
  }

  // ============ HELPERS ============

  function isWeaponType(t: EquipType): boolean {
    return t === "weapon" || t === "magicWeapon";
  }

  function isMagicType(t: EquipType): boolean {
    return t === "magicWeapon" || t === "magicArmor" || t === "magicEquipment";
  }

  function needsAttunement(t: EquipType): boolean {
    return isMagicType(t);
  }

  function equipColor(t: EquipType): string {
    const m: Record<EquipType, string> = {
      general: "var(--text-dim)", weapon: "#cc8833", armor: "#6688bb",
      magicWeapon: "#cc44cc", magicArmor: "#44aacc", magicEquipment: "#aa66cc",
    };
    return m[t];
  }

  // ============ COMPUTED ============

  $: filteredItems = inventory.filter((item) => {
    if (item.category !== activeTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    }
    return true;
  });

  $: tabCounts = {
    equipment: inventory.filter((i) => i.category === "equipment").length,
    items: inventory.filter((i) => i.category === "items").length,
    crafting: inventory.filter((i) => i.category === "crafting").length,
  };

  $: totalWeight = inventory.reduce((sum, i) => sum + i.weight * i.quantity, 0);
  $: totalValue = inventory.reduce((sum, i) => sum + i.valueGP * i.quantity, 0);
  $: attunedCount = inventory.filter((i) => i.attuned).length;

  function fmtGP(gp: number): string {
    if (gp >= 1) return `${Math.round(gp * 100) / 100} gp`;
    if (gp >= 0.1) return `${Math.round(gp * 10)} sp`;
    return `${Math.round(gp * 100)} cp`;
  }

  function fmtWeight(w: number): string {
    return w % 1 === 0 ? `${w}` : `${w.toFixed(1)}`;
  }
</script>

<div class="inventory">
  <!-- Top controls -->
  <div class="controls-row">
    <button on:click={openAddForm}>+ Add</button>
    <button on:click={importInventory}>Import</button>
    <button on:click={exportInventory}>Export</button>
    <div class="top-stats">
      <span class="stat-badge">⚖ {fmtWeight(totalWeight)} lb</span>
      <span class="stat-badge gold">💰 {fmtGP(totalValue)}</span>
    </div>
  </div>

  <!-- Attunement counter -->
  <div class="attunement-bar">
    <span class="att-label">Attunement</span>
    <div class="att-dots">
      {#each Array(maxAttunement) as _, i}
        <span class="att-dot" class:filled={i < attunedCount}>◆</span>
      {/each}
    </div>
    <span class="att-count">{attunedCount}/{maxAttunement}</span>
    <label class="att-max-label">
      Max:
      <input type="number" min="1" max="10" bind:value={maxAttunement}
             on:change={saveToStorage} class="att-max-input" />
    </label>
  </div>

  <!-- Category tabs -->
  <div class="tabs">
    {#each CATEGORIES as cat}
      <button class="tab" class:active={activeTab === cat}
              on:click={() => { activeTab = cat; }}>
        {CATEGORY_LABELS[cat]}
        <span class="tab-count">{tabCounts[cat]}</span>
      </button>
    {/each}
  </div>

  <input type="text" class="search-input" bind:value={searchQuery}
         placeholder="Search..." />

  <!-- Add/Edit form -->
  {#if showForm}
    <div class="item-form">
      <div class="form-title">{editingIndex !== null ? "Edit" : "Add"} Item</div>

      <label class="fl">Name <input type="text" bind:value={form.name} /></label>

      <div class="form-row">
        <label class="fl">Category
          <select bind:value={form.category}>
            {#each CATEGORIES as cat}<option value={cat}>{CATEGORY_LABELS[cat]}</option>{/each}
          </select>
        </label>
        <label class="fl">Type
          <select bind:value={form.equipmentType} on:change={onEquipTypeChange}>
            {#each EQUIP_TYPES as t}<option value={t}>{EQUIP_LABELS[t]}</option>{/each}
          </select>
        </label>
      </div>

      <div class="form-row">
        <label class="fl narrow">Qty <input type="number" min="1" bind:value={form.quantity} /></label>
        <label class="fl narrow">Weight <input type="number" min="0" step="0.1" bind:value={form.weight} /></label>
        <label class="fl narrow">GP <input type="number" min="0" step="0.01" bind:value={form.valueGP} /></label>
      </div>

      <label class="fl">Description <textarea bind:value={form.description} rows="2"></textarea></label>

      {#if isMagicType(form.equipmentType)}
        <label class="fl">Linked Magic Item Name
          <input type="text" bind:value={form.linkedMagicItem} placeholder="Name from Magic Items app" />
        </label>
      {/if}

      <!-- Weapon stats -->
      {#if isWeaponType(form.equipmentType) && form.weapon}
        <div class="weapon-section">
          <span class="sub-title">Weapon Stats</span>
          <div class="form-row">
            <label class="fl">Attack Ability
              <select bind:value={form.weapon.attackAbility}>
                <option value="str">Strength</option>
                <option value="dex">Dexterity</option>
                <option value="finesse">Finesse (STR or DEX)</option>
              </select>
            </label>
            <label class="fl narrow">Range
              <input type="text" bind:value={form.weapon.range} placeholder="5 ft" />
            </label>
          </div>
          <div class="form-row">
            <label class="fl">Damage Dice
              <input type="text" bind:value={form.weapon.damageDice} placeholder="1D8" />
            </label>
            <label class="fl">Damage Type
              <select bind:value={form.weapon.damageType}>
                {#each DAMAGE_TYPES as dt}<option value={dt}>{dt}</option>{/each}
              </select>
            </label>
          </div>
          <div class="form-row">
            <label class="fl">Properties
              <input type="text" bind:value={form.weapon.properties} placeholder="Versatile, Heavy" />
            </label>
            {#if form.equipmentType === "magicWeapon"}
              <label class="fl narrow">Magic +
                <input type="number" min="0" max="5" bind:value={form.weapon.magicBonus} />
              </label>
            {/if}
          </div>
        </div>
      {/if}

      <div class="form-actions">
        <button class="action-btn primary" on:click={saveForm}>Save</button>
        <button class="action-btn" on:click={cancelForm}>Cancel</button>
      </div>
    </div>
  {/if}

  <!-- Item list -->
  <div class="item-list">
    {#each filteredItems as item, fi}
      {@const realIdx = inventory.indexOf(item)}
      <div class="inv-item" style="border-left-color:{equipColor(item.equipmentType)};">
        <div class="item-main">
          <div class="item-top">
            <span class="item-name">{item.name}</span>
            <span class="item-qty">×{item.quantity}</span>
            {#if item.equipmentType !== "general"}
              <span class="equip-tag" style="color:{equipColor(item.equipmentType)};">
                {EQUIP_LABELS[item.equipmentType]}
              </span>
            {/if}
          </div>

          {#if item.weapon}
            <div class="weapon-line">
              <span class="wpn-stat">{item.weapon.damageDice} {item.weapon.damageType}</span>
              {#if item.weapon.magicBonus > 0}
                <span class="wpn-magic">+{item.weapon.magicBonus}</span>
              {/if}
              <span class="wpn-range">{item.weapon.range}</span>
            </div>
          {/if}

          {#if item.description}<p class="item-desc">{item.description}</p>{/if}

          <div class="item-stats">
            <span class="stat">⚖ {fmtWeight(item.weight * item.quantity)} lb</span>
            <span class="stat gold">💰 {fmtGP(item.valueGP * item.quantity)}</span>
            {#if item.linkedMagicItem}
              <button class="magic-link" on:click={() => openMagicItem(item.linkedMagicItem)}>
                ✦ {item.linkedMagicItem}
              </button>
            {/if}
          </div>
        </div>

        <div class="item-actions">
          {#if needsAttunement(item.equipmentType)}
            <button
              class="att-btn"
              class:attuned={item.attuned}
              on:click={() => toggleAttune(realIdx)}
              title={item.attuned ? "Unattune" : (attunedCount >= maxAttunement ? "Max attunement reached" : "Attune")}
            >◆</button>
          {/if}
          <button class="qty-btn" on:click={() => adjustQty(realIdx, 1)}>+</button>
          <button class="qty-btn" on:click={() => adjustQty(realIdx, -1)}>−</button>
          <button class="small-btn" on:click={() => openEditForm(realIdx)}>Edit</button>
          <button class="small-btn danger" on:click={() => deleteItem(realIdx)}>Del</button>
        </div>
      </div>
    {/each}

    {#if filteredItems.length === 0}
      <div class="empty">{searchQuery ? "No matches." : "Empty. Click + Add."}</div>
    {/if}
  </div>
</div>

<style>
  .inventory { display: flex; flex-direction: column; gap: 8px; }

  .controls-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .controls-row button { font-size: 12px; padding: 4px 12px; }
  .top-stats { margin-left: auto; display: flex; gap: 8px; }
  .stat-badge { font-size: 11px; color: var(--text-dim); }
  .stat-badge.gold { color: var(--accent); }

  /* ---- Attunement ---- */
  .attunement-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 10px; background: var(--bg);
    border: 1px solid var(--border); border-radius: var(--radius);
  }
  .att-label { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.3px; }
  .att-dots { display: flex; gap: 3px; }
  .att-dot { font-size: 12px; color: var(--border); transition: color 150ms; }
  .att-dot.filled { color: #aa66cc; text-shadow: 0 0 4px rgba(170,102,204,0.4); }
  .att-count { font-size: 11px; color: var(--text-dim); margin-left: auto; }
  .att-max-label {
    display: flex; align-items: center; gap: 4px;
    font-size: 10px; color: var(--text-dim);
  }
  .att-max-input { width: 36px; text-align: center; font-size: 11px; padding: 2px; }

  /* ---- Tabs ---- */
  .tabs { display: flex; gap: 2px; }
  .tab {
    flex: 1; padding: 6px 8px; font-size: 12px;
    color: var(--text-dim); background: var(--bg);
    border: 1px solid var(--border); border-radius: var(--radius);
    text-align: center; cursor: pointer; transition: all var(--transition);
  }
  .tab:hover { color: var(--text); border-color: var(--border-focus); }
  .tab.active { color: var(--accent); border-color: var(--accent-dim); background: rgba(200,169,110,0.06); }
  .tab-count { font-size: 10px; opacity: 0.6; margin-left: 3px; }

  .search-input { font-size: 12px; padding: 5px 10px; }

  /* ---- Form ---- */
  .item-form {
    display: flex; flex-direction: column; gap: 8px;
    padding: 12px; background: var(--bg);
    border: 1px solid var(--border); border-radius: var(--radius);
  }
  .form-title { font-family: var(--font-heading); font-size: 12px; color: var(--text-dim); text-transform: uppercase; }
  .fl {
    display: flex; flex-direction: column; gap: 3px;
    font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.3px;
  }
  .fl input, .fl select, .fl textarea { font-size: 13px; text-transform: none; }
  .fl.narrow { flex: 0 0 80px; }
  .form-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .form-row .fl { flex: 1; }
  .form-actions { display: flex; gap: 6px; margin-top: 4px; }
  .action-btn { padding: 6px 14px; font-size: 12px; color: var(--text); border: 1px solid var(--border); background: var(--bg-input); }
  .action-btn.primary { color: var(--accent); border-color: var(--accent-dim); }

  .weapon-section {
    display: flex; flex-direction: column; gap: 6px;
    padding: 8px; background: var(--bg-panel);
    border: 1px solid var(--border); border-radius: var(--radius);
  }
  .sub-title { font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.4px; }

  /* ---- Item list ---- */
  .item-list { display: flex; flex-direction: column; gap: 4px; }
  .inv-item {
    display: flex; gap: 8px; padding: 8px 10px;
    background: var(--bg); border: 1px solid var(--border);
    border-left: 3px solid var(--text-dim);
    border-radius: var(--radius); align-items: flex-start;
  }
  .item-main { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .item-top { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
  .item-name { font-size: 13px; font-weight: 600; color: var(--text-bright); }
  .item-qty { font-size: 12px; color: var(--accent); font-weight: 600; }
  .equip-tag { font-size: 10px; font-weight: 600; }

  .weapon-line { display: flex; gap: 8px; font-size: 11px; color: var(--text-dim); }
  .wpn-magic { color: #cc44cc; font-weight: 700; }
  .wpn-range { opacity: 0.6; }

  .item-desc { font-size: 12px; color: var(--text-dim); line-height: 1.4; }
  .item-stats { display: flex; gap: 10px; font-size: 11px; align-items: center; flex-wrap: wrap; }
  .stat { color: var(--text-dim); }
  .stat.gold { color: var(--accent); }

  .magic-link {
    font-size: 10px; padding: 1px 6px;
    color: #aa66cc; background: rgba(170,102,204,0.08);
    border: 1px solid rgba(170,102,204,0.3);
    border-radius: 2px; cursor: pointer;
  }
  .magic-link:hover { background: rgba(170,102,204,0.15); }

  .item-actions { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
  .att-btn {
    width: 24px; height: 20px; padding: 0; font-size: 12px;
    color: var(--border); background: var(--bg-input);
    border: 1px solid var(--border); border-radius: 2px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  .att-btn.attuned { color: #aa66cc; border-color: rgba(170,102,204,0.5); text-shadow: 0 0 4px rgba(170,102,204,0.4); }
  .att-btn:hover { border-color: #aa66cc; }

  .qty-btn {
    width: 24px; height: 20px; padding: 0; font-size: 14px; font-weight: 700;
    color: var(--text-dim); background: var(--bg-input);
    border: 1px solid var(--border); border-radius: 2px;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .qty-btn:hover { color: var(--accent); border-color: var(--accent-dim); }

  .small-btn {
    font-size: 10px; padding: 1px 6px; border: none;
    background: transparent; color: var(--text-dim); cursor: pointer; text-align: center;
  }
  .small-btn:hover { color: var(--text); }
  .small-btn.danger:hover { color: var(--danger); }

  .empty { text-align: center; padding: 20px; font-size: 12px; color: var(--text-dim); opacity: 0.4; }
</style>
