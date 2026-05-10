<!-- ============================================
     CharacterProfile.svelte — Character Hub
     
     Central identity + data management.
     Profile picture, identity, backstory.
     Full character export/import across all apps.
     Quick-launch links to every sub-app.
     ============================================ -->
<script lang="ts">
  import { onMount } from "svelte";
  import { eventBus } from "../../lib/eventBus";
  import { getEnabledApps } from "../../lib/appRegistry";

  // ============ TYPES ============

  interface CharacterProfile {
    name: string;
    subtitle: string;
    alignment: string;
    species: string;
    classes: string;
    level: number;
    description: string;
    backstory: string;
    profileImage: string;
    partyLogo: string;
    partyName: string;
    tags: string[];
    version: string;
    lastSaved: number;
  }

  interface ImportPreview {
    profile: boolean;
    skills: boolean;
    hpTracker: boolean;
    inventory: boolean;
    goldPurse: boolean;
    spellcasting: boolean;
    magicItems: boolean;
    traits: boolean;
    proficiencies: boolean;
    notes: boolean;
    spellList: boolean;
    spellSlots: boolean;
  }

  const ALIGNMENTS = [
    "Lawful Good", "Neutral Good", "Chaotic Good",
    "Lawful Neutral", "True Neutral", "Chaotic Neutral",
    "Lawful Evil", "Neutral Evil", "Chaotic Evil", "Unaligned",
  ];

  /** All localStorage keys mapped to export field names */
  const STORAGE_MAP: Record<string, string> = {
    "dnd-skills": "skills",
    "dnd-hptracker": "hpTracker",
    "dnd-inventory": "inventory",
    "dnd-goldpurse": "goldPurse",
    "dnd-spellcasting": "spellcasting",
    "dnd-magicitems": "magicItems",
    "dnd-traits": "traits",
    "dnd-proficiencies": "proficiencies",
    "dnd-notes": "notes",
    "dnd-spelllist": "spellList",
    "dnd-spellslots": "spellSlots",
    "dnd-weaponscantrips-pref": "weaponsCantripsPref",
  };

  const SECTION_LABELS: Record<string, string> = {
    profile: "Character Profile",
    skills: "Skills & Abilities",
    hpTracker: "HP Tracker",
    inventory: "Inventory",
    goldPurse: "Gold Purse",
    spellcasting: "Spellcasting",
    magicItems: "Magic Items",
    traits: "Traits & Feats",
    proficiencies: "Proficiencies",
    notes: "Session Notes",
    spellList: "Spell List (legacy)",
    spellSlots: "Spell Slots (legacy)",
  };

  // ============ STATE ============

  let profile: CharacterProfile = blankProfile();
  let editMode = false;

  // Import state
  let showImport = false;
  let importData: Record<string, any> | null = null;
  let importPreview: ImportPreview | null = null;
  let importMode: "overwrite" | "merge" = "overwrite";
  let importError = "";
  let importFileName = "";

  // Export feedback
  let exportStatus = "";

  // Stats pulled from other apps
  let charLevel = 0;
  let charHp = "";
  let charAc = 0;

  onMount(() => {
    loadProfile();
    loadQuickStats();
  });

  function blankProfile(): CharacterProfile {
    return {
      name: "New Character",
      subtitle: "",
      alignment: "True Neutral",
      species: "",
      classes: "",
      level: 1,
      description: "",
      backstory: "",
      profileImage: "",
      partyLogo: "",
      partyName: "",
      tags: [],
      version: "1.0.0",
      lastSaved: Date.now(),
    };
  }

  // ============ SAVE / LOAD ============

  function saveProfile() {
    profile.lastSaved = Date.now();
    try {
      window.localStorage.setItem("dnd-profile", JSON.stringify(profile));
    } catch {}
  }

  function loadProfile() {
    try {
      const raw = window.localStorage.getItem("dnd-profile");
      if (raw) {
        const p = JSON.parse(raw);
        profile = { ...blankProfile(), ...p };
        return;
      }
    } catch {}
    // Pull level from skills if available
    try {
      const sk = window.localStorage.getItem("dnd-skills");
      if (sk) {
        const d = JSON.parse(sk);
        profile.level = d.level || 1;
      }
    } catch {}
  }

  function loadQuickStats() {
    try {
      const sk = window.localStorage.getItem("dnd-skills");
      if (sk) { charLevel = JSON.parse(sk).level || 0; }
    } catch {}
    try {
      const hp = window.localStorage.getItem("dnd-hptracker");
      if (hp) {
        const d = JSON.parse(hp);
        charHp = `${d.currentHp}/${d.maxHp}`;
        charAc = (d.acEffects || []).reduce((s: number, e: any) => s + (e.value || 0), 0);
      }
    } catch {}
  }

  function autoSave() {
    saveProfile();
  }

  // ============ IMAGE HANDLING ============

  function uploadImage(target: "profile" | "party") {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      if (file.size > 3 * 1024 * 1024) { alert("Image too large (max 3MB)"); return; }
      const reader = new FileReader();
      reader.onload = () => {
        if (target === "profile") profile.profileImage = reader.result as string;
        else profile.partyLogo = reader.result as string;
        profile = profile; saveProfile();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function removeImage(target: "profile" | "party") {
    if (target === "profile") profile.profileImage = "";
    else profile.partyLogo = "";
    profile = profile; saveProfile();
  }

  // ============ EXPORT ============

  function exportCharacter() {
    const exportObj: Record<string, any> = {
      _meta: {
        version: "1.0.0",
        exportDate: new Date().toISOString(),
        appName: "D&D Companion",
        characterName: profile.name,
      },
      profile: profile,
    };

    // Gather all sub-app data
    for (const [storageKey, fieldName] of Object.entries(STORAGE_MAP)) {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) exportObj[fieldName] = JSON.parse(raw);
      } catch {}
    }

    const json = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = profile.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    a.href = url;
    a.download = `${safeName}_character.json`;
    a.click();
    URL.revokeObjectURL(url);

    exportStatus = "Exported!";
    setTimeout(() => { exportStatus = ""; }, 2000);
  }

  // ============ IMPORT ============

  function openImportDialog() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      importFileName = file.name;
      importError = "";
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        validateImport(data);
      } catch (e) {
        importError = "Invalid JSON file. Please check the file format.";
        importData = null;
        importPreview = null;
        showImport = true;
      }
    };
    input.click();
  }

  function validateImport(data: Record<string, any>) {
    importData = data;

    // Build preview of what's included
    const preview: ImportPreview = {
      profile: !!data.profile,
      skills: !!data.skills,
      hpTracker: !!data.hpTracker,
      inventory: !!data.inventory,
      goldPurse: !!data.goldPurse,
      spellcasting: !!data.spellcasting,
      magicItems: !!data.magicItems,
      traits: !!data.traits,
      proficiencies: !!data.proficiencies,
      notes: !!data.notes,
      spellList: !!data.spellList,
      spellSlots: !!data.spellSlots,
    };

    const hasAnything = Object.values(preview).some(v => v);
    if (!hasAnything) {
      importError = "No recognized character data found in this file.";
    }

    importPreview = preview;
    showImport = true;
  }

  function confirmImport() {
    if (!importData || !importPreview) return;
    const d = importData;

    // Profile
    if (importPreview.profile && d.profile) {
      if (importMode === "overwrite") {
        profile = { ...blankProfile(), ...d.profile };
      } else {
        // Merge: only overwrite non-empty fields
        for (const [k, v] of Object.entries(d.profile)) {
          if (v !== "" && v !== null && v !== undefined) {
            (profile as any)[k] = v;
          }
        }
      }
      saveProfile();
    }

    // All sub-app data
    const reverseMap: Record<string, string> = {};
    for (const [storageKey, fieldName] of Object.entries(STORAGE_MAP)) {
      reverseMap[fieldName] = storageKey;
    }

    for (const [fieldName, storageKey] of Object.entries(reverseMap)) {
      if (d[fieldName] !== undefined) {
        try {
          if (importMode === "overwrite") {
            window.localStorage.setItem(storageKey, JSON.stringify(d[fieldName]));
          } else {
            // Merge: keep existing if target has data, overwrite if empty
            const existing = window.localStorage.getItem(storageKey);
            if (!existing || existing === "[]" || existing === "{}" || existing === "null") {
              window.localStorage.setItem(storageKey, JSON.stringify(d[fieldName]));
            }
          }
        } catch {}
      }
    }

    // Refresh
    loadProfile();
    loadQuickStats();
    showImport = false;
    importData = null;
    importPreview = null;
    exportStatus = "Imported!";
    setTimeout(() => { exportStatus = ""; }, 2000);
  }

  function cancelImport() {
    showImport = false; importData = null; importPreview = null; importError = "";
  }

  // ============ APP LAUNCHING ============

  function openApp(appId: string) {
    eventBus.send({ target: "*", source: "characterProfile", action: "openApp", appId });
  }

  $: appLinks = getEnabledApps().filter(a => a.id !== "characterProfile");

  // Count data per section for quick stats
  function countItems(key: string): number {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return 0;
      const d = JSON.parse(raw);
      if (Array.isArray(d)) return d.length;
      if (d.items && Array.isArray(d.items)) return d.items.length;
      if (d.spells && Array.isArray(d.spells)) return d.spells.length;
      return 1;
    } catch { return 0; }
  }

  const APP_ICONS: Record<string, string> = {
    diceRoller: "🎲", spellList: "📖", spellSlots: "✦", magicItems: "✦",
    inventory: "🎒", goldPurse: "💰", notes: "📝", skills: "📊",
    hpTracker: "❤", traits: "⚔", proficiencies: "🛡", weaponsCantrips: "🗡",
    spellcasting: "🔮",
  };
</script>

<div class="profile-app">
  <!-- ======== PROFILE CARD ======== -->
  <div class="profile-card">
    <!-- Party logo (top-right) -->
    {#if profile.partyLogo || editMode}
      <div class="party-section">
        {#if profile.partyLogo}
          <img src={profile.partyLogo} alt="Party" class="party-logo" />
        {/if}
        {#if editMode}
          <div class="img-actions small">
            <button class="img-btn" on:click={() => uploadImage("party")}>
              {profile.partyLogo ? "Change" : "Add Logo"}
            </button>
            {#if profile.partyLogo}
              <button class="img-btn danger" on:click={() => removeImage("party")}>✕</button>
            {/if}
          </div>
        {/if}
        {#if editMode}
          <input type="text" bind:value={profile.partyName} on:change={autoSave}
                 placeholder="Party name" class="party-name-input" />
        {:else if profile.partyName}
          <span class="party-name">{profile.partyName}</span>
        {/if}
      </div>
    {/if}

    <!-- Profile image -->
    <div class="portrait-area">
      {#if profile.profileImage}
        <img src={profile.profileImage} alt={profile.name} class="portrait" />
      {:else}
        <div class="portrait-placeholder">
          <span class="portrait-initial">{profile.name.charAt(0).toUpperCase()}</span>
        </div>
      {/if}
      {#if editMode}
        <div class="img-actions">
          <button class="img-btn" on:click={() => uploadImage("profile")}>
            {profile.profileImage ? "Change" : "Upload"}
          </button>
          {#if profile.profileImage}
            <button class="img-btn danger" on:click={() => removeImage("profile")}>Remove</button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Name & subtitle -->
    {#if editMode}
      <input type="text" bind:value={profile.name} on:change={autoSave}
             class="name-input" placeholder="Character Name" />
      <input type="text" bind:value={profile.subtitle} on:change={autoSave}
             class="subtitle-input" placeholder="Title, nickname, or tagline" />
    {:else}
      <h1 class="char-name">{profile.name}</h1>
      {#if profile.subtitle}
        <p class="char-subtitle">{profile.subtitle}</p>
      {/if}
    {/if}

    <!-- Quick stats row -->
    <div class="quick-stats">
      {#if charLevel}
        <span class="qs">Lvl {charLevel}</span>
      {/if}
      {#if charHp}
        <span class="qs hp">❤ {charHp}</span>
      {/if}
      {#if charAc}
        <span class="qs ac">🛡 {charAc}</span>
      {/if}
    </div>

    <!-- Core info -->
    <div class="core-info">
      {#if editMode}
        <div class="ci-row">
          <label class="ci-label">Species <input type="text" bind:value={profile.species} on:change={autoSave} /></label>
          <label class="ci-label">Class(es) <input type="text" bind:value={profile.classes} on:change={autoSave} placeholder="Fighter 5 / Wizard 2" /></label>
        </div>
        <div class="ci-row">
          <label class="ci-label">Level <input type="number" min="1" max="20" bind:value={profile.level} on:change={autoSave} class="level-inp" /></label>
          <label class="ci-label">Alignment
            <select bind:value={profile.alignment} on:change={autoSave}>
              {#each ALIGNMENTS as a}<option>{a}</option>{/each}
            </select>
          </label>
        </div>
      {:else}
        <div class="info-tags">
          {#if profile.species}<span class="info-tag">{profile.species}</span>{/if}
          {#if profile.classes}<span class="info-tag">{profile.classes}</span>{/if}
          <span class="info-tag">{profile.alignment}</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Edit toggle -->
  <div class="edit-bar">
    <button class="edit-toggle" on:click={() => { editMode = !editMode; if (!editMode) saveProfile(); }}>
      {editMode ? "✓ Done Editing" : "✎ Edit Profile"}
    </button>
    {#if exportStatus}
      <span class="export-status">{exportStatus}</span>
    {/if}
  </div>

  <!-- ======== DESCRIPTION ======== -->
  {#if editMode || profile.description}
    <div class="text-section">
      <span class="section-label">Description</span>
      {#if editMode}
        <textarea bind:value={profile.description} on:change={autoSave} rows="4"
                  placeholder="Appearance, personality, mannerisms..." class="big-textarea"></textarea>
      {:else}
        <p class="text-body">{profile.description}</p>
      {/if}
    </div>
  {/if}

  <!-- ======== BACKSTORY ======== -->
  {#if editMode || profile.backstory}
    <div class="text-section">
      <span class="section-label">Backstory</span>
      {#if editMode}
        <textarea bind:value={profile.backstory} on:change={autoSave} rows="6"
                  placeholder="Character history, motivations, key events..." class="big-textarea"></textarea>
      {:else}
        <p class="text-body backstory">{profile.backstory}</p>
      {/if}
    </div>
  {/if}

  <!-- ======== QUICK LINKS ======== -->
  <div class="app-links">
    <span class="section-label">Sub Apps</span>
    <div class="link-grid">
      {#each appLinks as app}
        <button class="app-link" on:click={() => openApp(app.id)}>
          <span class="al-icon">{APP_ICONS[app.id] || "◆"}</span>
          <span class="al-name">{app.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- ======== DATA MANAGEMENT ======== -->
  <div class="data-section">
    <span class="section-label">Data Management</span>
    <div class="data-actions">
      <button class="data-btn export" on:click={exportCharacter}>
        ↓ Export Character
      </button>
      <button class="data-btn import" on:click={openImportDialog}>
        ↑ Import Character
      </button>
    </div>
    <p class="data-hint">
      Export saves everything — profile, inventory, spells, skills, notes, and all sub-app data — into a single JSON file.
    </p>
  </div>

  <!-- ======== IMPORT DIALOG ======== -->
  {#if showImport}
    <div class="import-overlay">
      <div class="import-dialog">
        <div class="id-header">
          <span class="id-title">Import Character</span>
          <button class="id-close" on:click={cancelImport}>✕</button>
        </div>

        {#if importError}
          <div class="id-error">{importError}</div>
        {/if}

        {#if importPreview && importData}
          <div class="id-file">📄 {importFileName}</div>

          {#if importData.profile?.name}
            <div class="id-char-name">Character: <strong>{importData.profile.name}</strong></div>
          {/if}

          {#if importData._meta}
            <div class="id-meta">
              Exported: {new Date(importData._meta.exportDate).toLocaleString()}
              · v{importData._meta.version}
            </div>
          {/if}

          <!-- Preview sections -->
          <div class="id-preview">
            <span class="id-label">Data found:</span>
            <div class="id-sections">
              {#each Object.entries(importPreview) as [key, present]}
                {#if present}
                  <span class="id-section found">✓ {SECTION_LABELS[key] || key}</span>
                {/if}
              {/each}
              {#each Object.entries(importPreview) as [key, present]}
                {#if !present}
                  <span class="id-section missing">— {SECTION_LABELS[key] || key}</span>
                {/if}
              {/each}
            </div>
          </div>

          <!-- Import mode -->
          <div class="id-mode">
            <span class="id-label">Import mode:</span>
            <label class="id-radio">
              <input type="radio" bind:group={importMode} value="overwrite" />
              Full overwrite (replace all data)
            </label>
            <label class="id-radio">
              <input type="radio" bind:group={importMode} value="merge" />
              Merge (keep existing, fill empty)
            </label>
          </div>

          <div class="id-actions">
            <button class="data-btn export" on:click={confirmImport}>
              Confirm Import
            </button>
            <button class="data-btn" on:click={cancelImport}>Cancel</button>
          </div>
        {:else if !importError}
          <div class="id-loading">Processing file...</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-app {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ======== PROFILE CARD ======== */
  .profile-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 16px 16px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    position: relative;
  }

  /* Party section */
  .party-section {
    position: absolute;
    top: 8px;
    right: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }

  .party-logo {
    width: 36px;
    height: 36px;
    border-radius: 4px;
    border: 1px solid var(--border);
    object-fit: cover;
  }

  .party-name {
    font-size: 9px;
    color: var(--text-dim);
    text-align: center;
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .party-name-input {
    font-size: 9px;
    width: 70px;
    padding: 1px 4px;
    text-align: center;
  }

  /* Portrait */
  .portrait-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .portrait {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 3px solid var(--border);
    object-fit: cover;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.4);
  }

  .portrait-placeholder {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 3px solid var(--border);
    background: var(--bg-panel);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .portrait-initial {
    font-size: 40px;
    font-family: var(--font-heading);
    color: var(--accent);
    font-weight: 700;
  }

  .img-actions {
    display: flex;
    gap: 4px;
  }

  .img-actions.small { margin-top: 2px; }

  .img-btn {
    font-size: 10px;
    padding: 2px 8px;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
    border-radius: 2px;
  }

  .img-btn:hover { color: var(--text); border-color: var(--border-focus); }
  .img-btn.danger:hover { color: var(--danger); border-color: var(--danger); }

  /* Name */
  .char-name {
    font-family: var(--font-heading);
    font-size: 24px;
    font-weight: 700;
    color: var(--text-bright);
    text-align: center;
    margin: 0;
    line-height: 1.2;
  }

  .char-subtitle {
    font-size: 13px;
    color: var(--text-dim);
    font-style: italic;
    text-align: center;
    margin: 0;
  }

  .name-input {
    font-size: 20px;
    font-weight: 700;
    font-family: var(--font-heading);
    text-align: center;
    padding: 4px 12px;
    color: var(--text-bright);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    width: 100%;
    max-width: 280px;
  }

  .subtitle-input {
    font-size: 12px;
    text-align: center;
    padding: 3px 12px;
    font-style: italic;
    width: 100%;
    max-width: 280px;
  }

  /* Quick stats */
  .quick-stats {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .qs {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 8px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 2px;
    color: var(--text-dim);
  }

  .qs.hp { color: #cc3333; border-color: rgba(204, 51, 51, 0.3); }
  .qs.ac { color: #6688bb; border-color: rgba(102, 136, 187, 0.3); }

  /* Core info */
  .core-info { width: 100%; }

  .ci-row {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
  }

  .ci-label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .ci-label input, .ci-label select {
    font-size: 12px;
    text-transform: none;
  }

  .level-inp { width: 56px; }

  .info-tags {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .info-tag {
    font-size: 11px;
    padding: 2px 10px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 2px;
    color: var(--text-dim);
  }

  /* ======== EDIT BAR ======== */
  .edit-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .edit-toggle {
    font-size: 12px;
    padding: 5px 14px;
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--accent-dim);
    cursor: pointer;
    border-radius: var(--radius);
    transition: all var(--transition);
  }

  .edit-toggle:hover { background: rgba(200, 169, 110, 0.1); }

  .export-status {
    font-size: 11px;
    color: var(--success);
    font-weight: 600;
  }

  /* ======== TEXT SECTIONS ======== */
  .text-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .section-label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .big-textarea {
    font-size: 13px;
    font-family: var(--font-body);
    line-height: 1.6;
    padding: 8px;
    resize: vertical;
    min-height: 60px;
  }

  .text-body {
    font-size: 13px;
    color: var(--text);
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
  }

  .backstory { color: var(--text-dim); }

  /* ======== APP LINKS ======== */
  .app-links {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .link-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 4px;
  }

  .app-link {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 11px;
    color: var(--text-dim);
    transition: all var(--transition);
  }

  .app-link:hover {
    color: var(--accent);
    border-color: var(--accent-dim);
    background: rgba(200, 169, 110, 0.04);
  }

  .al-icon { font-size: 13px; }
  .al-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ======== DATA MANAGEMENT ======== */
  .data-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .data-actions {
    display: flex;
    gap: 6px;
  }

  .data-btn {
    flex: 1;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid var(--border);
    background: var(--bg-input);
    color: var(--text);
    cursor: pointer;
    border-radius: var(--radius);
    transition: all var(--transition);
    text-align: center;
  }

  .data-btn.export {
    color: var(--accent);
    border-color: var(--accent-dim);
  }

  .data-btn.export:hover { background: rgba(200, 169, 110, 0.1); }

  .data-btn.import {
    color: #64b4ff;
    border-color: rgba(100, 180, 255, 0.3);
  }

  .data-btn.import:hover { background: rgba(100, 180, 255, 0.06); }

  .data-hint {
    font-size: 10px;
    color: var(--text-dim);
    opacity: 0.5;
    margin: 0;
    line-height: 1.4;
  }

  /* ======== IMPORT DIALOG ======== */
  .import-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  }

  .import-dialog {
    width: 100%;
    max-width: 420px;
    max-height: 80vh;
    overflow-y: auto;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  }

  .id-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .id-title {
    font-family: var(--font-heading);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-bright);
  }

  .id-close {
    width: 24px;
    height: 24px;
    padding: 0;
    font-size: 12px;
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .id-close:hover { color: var(--danger); }

  .id-error {
    padding: 8px;
    background: rgba(204, 68, 68, 0.1);
    border: 1px solid rgba(204, 68, 68, 0.3);
    border-radius: var(--radius);
    font-size: 12px;
    color: #cc4444;
  }

  .id-file { font-size: 12px; color: var(--text-dim); }
  .id-char-name { font-size: 14px; color: var(--text); }
  .id-meta { font-size: 10px; color: var(--text-dim); opacity: 0.6; }

  .id-preview {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .id-label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .id-sections {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .id-section {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 2px;
  }

  .id-section.found {
    color: var(--success);
    background: rgba(68, 170, 68, 0.06);
  }

  .id-section.missing {
    color: var(--text-dim);
    opacity: 0.4;
  }

  .id-mode {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .id-radio {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text);
    cursor: pointer;
  }

  .id-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  .id-loading {
    font-size: 12px;
    color: var(--text-dim);
    text-align: center;
    padding: 20px;
  }
</style>
