<!-- ============================================
     Toolbar.svelte — Desktop top bar
     Hidden on mobile (MobileNav replaces it).
     ============================================ -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { SubAppEntry } from "../lib/types";

  export let apps: SubAppEntry[] = [];
  export let openAppIds: string[] = [];
  export let zoom: number = 1;
  export let characterName: string = "";

  const dispatch = createEventDispatcher();

  function toggleApp(appId: string) { dispatch("toggle", { appId }); }
  function openSettings() { dispatch("settings"); }
  function resetView() { dispatch("resetView"); }
</script>

<div class="toolbar">
  <span class="brand">⚔ {characterName || "D&D"}</span>

  <div class="app-buttons">
    {#each apps as app (app.id)}
      <button class="app-btn" class:active={openAppIds.includes(app.id)}
              on:click={() => toggleApp(app.id)}>
        {app.name}
      </button>
    {/each}
  </div>

  <div class="toolbar-right">
    {#if zoom !== 1}
      <button class="zoom-badge" on:click={resetView} title="Reset view">
        {Math.round(zoom * 100)}%
      </button>
    {/if}
    <button class="gear-btn" on:click={openSettings} title="Settings">⚙</button>
  </div>
</div>

<style>
  .toolbar {
    display: flex; align-items: center; height: 36px;
    padding: 0 12px; background: var(--bg-raised);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0; gap: 12px;
  }

  .brand {
    font-family: var(--font-heading); font-size: 13px;
    color: var(--accent); letter-spacing: 1px; font-weight: 600;
    white-space: nowrap; max-width: 140px;
    overflow: hidden; text-overflow: ellipsis;
  }

  .app-buttons { display: flex; gap: 4px; overflow-x: auto; flex: 1; }

  .app-btn {
    height: 26px; padding: 0 12px; font-size: 12px;
    border: 1px solid var(--border); background: transparent;
    color: var(--text-dim); border-radius: 2px; white-space: nowrap;
    min-height: 0; transition: all var(--transition);
  }

  .app-btn:hover { color: var(--text); border-color: var(--border-focus); }
  .app-btn.active {
    color: var(--accent); border-color: var(--accent-dim);
    background: rgba(200, 169, 110, 0.08);
  }

  .toolbar-right { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }

  .zoom-badge {
    font-size: 10px; padding: 2px 6px; color: var(--text-dim);
    background: var(--bg-input); border: 1px solid var(--border);
    border-radius: 2px; min-height: 0;
  }
  .zoom-badge:hover { color: var(--accent); border-color: var(--accent-dim); }

  .gear-btn {
    width: 28px; height: 28px; padding: 0; font-size: 15px;
    color: var(--text-dim); background: transparent;
    border: 1px solid var(--border); border-radius: 3px;
    display: flex; align-items: center; justify-content: center;
    min-height: 0; transition: all var(--transition);
  }
  .gear-btn:hover { color: var(--accent); border-color: var(--accent-dim); transform: rotate(30deg); }

  /* Hide on mobile */
  @media (max-width: 768px) {
    .toolbar { display: none; }
  }
</style>
