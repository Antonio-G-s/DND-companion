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
    display: flex; flex-direction: column; align-items: stretch;
    width: 180px; height: 100%;
    padding: 12px 8px; background: var(--bg-raised);
    border-right: 1px solid var(--border);
    flex-shrink: 0; gap: 10px;
  }

  .brand {
    font-family: var(--font-heading); font-size: 13px;
    color: var(--accent); letter-spacing: 1px; font-weight: 600;
    white-space: nowrap; max-width: 100%;
    overflow: hidden; text-overflow: ellipsis;
    padding: 2px 4px 8px;
    border-bottom: 1px solid var(--border);
  }

  .app-buttons {
    display: flex; flex-direction: column; gap: 4px;
    overflow-x: hidden; overflow-y: auto; flex: 1;
    padding-right: 2px;
  }

  .app-btn {
    width: 100%; min-height: 30px; padding: 0 10px; font-size: 12px;
    display: flex; align-items: center; justify-content: flex-start;
    border: 1px solid var(--border); background: transparent;
    color: var(--text-dim); border-radius: 2px; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
    transition: all var(--transition);
  }

  .app-btn:hover { color: var(--text); border-color: var(--border-focus); }
  .app-btn.active {
    color: var(--accent); border-color: var(--accent-dim);
    background: rgba(200, 169, 110, 0.08);
  }

  .toolbar-right {
    display: flex; gap: 4px; align-items: center; flex-shrink: 0;
    padding-top: 8px; border-top: 1px solid var(--border);
  }

  .zoom-badge {
    flex: 1; font-size: 10px; padding: 2px 6px; color: var(--text-dim);
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
