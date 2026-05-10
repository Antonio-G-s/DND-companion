<!-- ============================================
     MobileNav.svelte — Bottom navigation for mobile
     
     Bottom bar with quick-access icons.
     Tap the grid icon for full app drawer.
     ============================================ -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { SubAppEntry } from "../lib/types";

  export let apps: SubAppEntry[] = [];
  export let activeAppId: string = "";
  export let characterName: string = "";

  let showDrawer = false;

  const dispatch = createEventDispatcher();

  function openApp(appId: string) {
    dispatch("open", { appId });
    showDrawer = false;
  }

  function openSettings() {
    dispatch("settings");
    showDrawer = false;
  }

  const ICONS: Record<string, string> = {
    characterProfile: "👤", diceRoller: "🎲", spellList: "📖",
    spellSlots: "✦", magicItems: "✦", inventory: "🎒",
    goldPurse: "💰", notes: "📝", skills: "📊",
    hpTracker: "❤", traits: "⚔", proficiencies: "🛡",
    weaponsCantrips: "🗡", spellcasting: "🔮",
  };

  // Quick bar: most-used apps
  const QUICK_IDS = ["characterProfile", "diceRoller", "hpTracker", "spellcasting", "inventory"];

  $: quickApps = QUICK_IDS.map(id => apps.find(a => a.id === id)).filter(Boolean) as SubAppEntry[];
</script>

<!-- App drawer overlay -->
{#if showDrawer}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="drawer-overlay" on:click={() => { showDrawer = false; }}></div>

  <div class="drawer">
    <div class="drawer-handle"></div>
    <div class="drawer-title">{characterName || "Sub Apps"}</div>
    <div class="drawer-grid">
      {#each apps as app (app.id)}
        <button
          class="drawer-item"
          class:active={activeAppId === app.id}
          on:click={() => openApp(app.id)}
        >
          <span class="di-icon">{ICONS[app.id] || "◆"}</span>
          <span class="di-name">{app.name}</span>
        </button>
      {/each}
      <button class="drawer-item settings-item" on:click={openSettings}>
        <span class="di-icon">⚙</span>
        <span class="di-name">Settings</span>
      </button>
    </div>
  </div>
{/if}

<!-- Bottom nav bar -->
<nav class="bottom-nav">
  {#each quickApps as app (app.id)}
    <button
      class="nav-btn"
      class:active={activeAppId === app.id}
      on:click={() => openApp(app.id)}
    >
      <span class="nav-icon">{ICONS[app.id] || "◆"}</span>
      <span class="nav-label">{app.name}</span>
    </button>
  {/each}
  <button class="nav-btn grid-btn" on:click={() => { showDrawer = !showDrawer; }}>
    <span class="nav-icon">⊞</span>
    <span class="nav-label">More</span>
  </button>
</nav>

<style>
  /* ---- Bottom nav ---- */
  .bottom-nav {
    display: flex;
    height: var(--nav-height);
    padding-bottom: var(--safe-bottom);
    background: var(--bg-raised);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    z-index: 100;
  }

  .nav-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px 2px;
    background: transparent;
    border: none;
    border-radius: 0;
    color: var(--text-dim);
    min-height: 0;
    transition: color var(--transition);
  }

  .nav-btn:active { background: rgba(255,255,255,0.03); }
  .nav-btn.active { color: var(--accent); }

  .nav-icon { font-size: 18px; line-height: 1; }
  .nav-label { font-size: 9px; line-height: 1; letter-spacing: 0.2px; }

  .grid-btn { color: var(--text-dim); }

  /* ---- Drawer ---- */
  .drawer-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 998;
  }

  .drawer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    max-height: 70vh;
    background: var(--bg-panel);
    border-top: 1px solid var(--border);
    border-radius: 12px 12px 0 0;
    z-index: 999;
    padding: 8px 16px calc(var(--nav-height) + var(--safe-bottom) + 8px);
    overflow-y: auto;
    animation: slideUp 200ms ease;
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .drawer-handle {
    width: 36px; height: 4px;
    background: var(--border);
    border-radius: 2px;
    margin: 0 auto 10px;
  }

  .drawer-title {
    font-family: var(--font-heading);
    font-size: 14px; font-weight: 600;
    color: var(--text); text-align: center;
    margin-bottom: 12px;
  }

  .drawer-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .drawer-item {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 4px; padding: 12px 4px;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 8px; min-height: 0;
    color: var(--text-dim);
    transition: all var(--transition);
  }

  .drawer-item:active { background: var(--bg-input); }
  .drawer-item.active { color: var(--accent); border-color: var(--accent-dim); }

  .di-icon { font-size: 20px; }
  .di-name { font-size: 10px; text-align: center; line-height: 1.2; }

  .settings-item { border-style: dashed; }
</style>
