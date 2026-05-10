<!-- ============================================
     Notes.svelte — Session Notes
     
     Notes organized by day/session.
     Search across all notes.
     Embed images via upload or paste.
     Auto-save to localStorage.
     ============================================ -->
<script lang="ts">
  import { onMount } from "svelte";

  interface NoteImage {
    data: string;    // base64 data URI
    name: string;
  }

  interface Note {
    id: string;
    date: string;          // YYYY-MM-DD
    title: string;
    content: string;
    images: NoteImage[];
    createdAt: number;
    updatedAt: number;
  }

  // ---- State ----
  let notes: Note[] = [];
  let view: "list" | "edit" = "list";
  let activeNote: Note | null = null;
  let searchQuery = "";
  let sortOrder: "newest" | "oldest" = "newest";

  // ---- Image upload ----
  let fileInputEl: HTMLInputElement;

  onMount(() => { loadFromStorage(); });

  // ============ SAVE / LOAD ============

  function saveToStorage() {
    try {
      window.localStorage.setItem("dnd-notes", JSON.stringify(notes));
    } catch (e) {
      console.warn("Notes save failed — storage may be full");
    }
  }

  function loadFromStorage() {
    try {
      const raw = window.localStorage.getItem("dnd-notes");
      if (raw) {
        notes = JSON.parse(raw);
        return;
      }
    } catch {}
    notes = getDefaults();
  }

  function getDefaults(): Note[] {
    const today = new Date().toISOString().slice(0, 10);
    return [{
      id: genId(),
      date: today,
      title: "Session 1",
      content: "The adventure begins...\n\nWrite your session notes here. You can embed images using the image button below.",
      images: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }];
  }

  // ============ CRUD ============

  function genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function newNote() {
    const today = new Date().toISOString().slice(0, 10);
    const note: Note = {
      id: genId(),
      date: today,
      title: "",
      content: "",
      images: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    notes = [note, ...notes];
    activeNote = note;
    view = "edit";
    saveToStorage();
  }

  function openNote(note: Note) {
    activeNote = note;
    view = "edit";
  }

  function backToList() {
    if (activeNote) {
      activeNote.updatedAt = Date.now();
      notes = notes;
      saveToStorage();
    }
    view = "list";
    activeNote = null;
  }

  function deleteNote(id: string) {
    notes = notes.filter((n) => n.id !== id);
    if (activeNote?.id === id) {
      activeNote = null;
      view = "list";
    }
    saveToStorage();
  }

  function duplicateNote(note: Note) {
    const dup: Note = {
      ...JSON.parse(JSON.stringify(note)),
      id: genId(),
      title: note.title + " (copy)",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    notes = [dup, ...notes];
    saveToStorage();
  }

  /** Auto-save on every content change */
  function onContentChange() {
    if (activeNote) {
      activeNote.updatedAt = Date.now();
      notes = notes;
      saveToStorage();
    }
  }

  // ============ IMAGES ============

  function triggerImageUpload() {
    fileInputEl?.click();
  }

  function handleImageUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || !activeNote) return;
    for (const file of Array.from(files)) {
      addImageFile(file);
    }
    input.value = "";
  }

  function addImageFile(file: File) {
    if (!activeNote) return;
    if (!file.type.startsWith("image/")) return;
    // Limit file size to ~2MB
    if (file.size > 2 * 1024 * 1024) {
      alert("Image too large (max 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (!activeNote) return;
      activeNote.images = [...activeNote.images, {
        data: reader.result as string,
        name: file.name,
      }];
      notes = notes;
      saveToStorage();
    };
    reader.readAsDataURL(file);
  }

  function handlePaste(e: ClipboardEvent) {
    if (!activeNote) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) addImageFile(file);
      }
    }
  }

  function removeImage(idx: number) {
    if (!activeNote) return;
    activeNote.images = activeNote.images.filter((_, i) => i !== idx);
    notes = notes;
    saveToStorage();
  }

  // ============ EXPORT / IMPORT ============

  function exportNotes() {
    const json = JSON.stringify(notes, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "session-notes.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importNotes() {
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
          notes = data;
          saveToStorage();
        }
      } catch {
        console.error("Invalid notes JSON");
      }
    };
    input.click();
  }

  // ============ COMPUTED ============

  $: filteredNotes = (() => {
    let result = notes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.date.includes(q)
      );
    }
    result = [...result].sort((a, b) =>
      sortOrder === "newest"
        ? b.updatedAt - a.updatedAt
        : a.updatedAt - b.updatedAt
    );
    return result;
  })();

  /** Group notes by date */
  $: groupedNotes = (() => {
    const groups: Map<string, Note[]> = new Map();
    for (const note of filteredNotes) {
      const date = note.date;
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(note);
    }
    return groups;
  })();

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr + "T12:00:00");
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  }

  function isToday(dateStr: string): boolean {
    return dateStr === new Date().toISOString().slice(0, 10);
  }

  function previewText(content: string, max: number = 80): string {
    const line = content.split("\n")[0] || "";
    return line.length > max ? line.slice(0, max) + "…" : line;
  }

  function timeLabel(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
</script>

<div class="notes-app">
  {#if view === "list"}
    <!-- ==================== LIST VIEW ==================== -->
    <div class="list-controls">
      <button class="action-btn primary" on:click={newNote}>+ New Note</button>
      <button class="action-btn" on:click={importNotes}>Import</button>
      <button class="action-btn" on:click={exportNotes}>Export</button>
      <button
        class="sort-btn"
        on:click={() => { sortOrder = sortOrder === "newest" ? "oldest" : "newest"; }}
        title="Sort order"
      >
        {sortOrder === "newest" ? "↓ New" : "↑ Old"}
      </button>
    </div>

    <input
      type="text"
      class="search-input"
      bind:value={searchQuery}
      placeholder="Search notes..."
    />

    <div class="notes-list">
      {#each [...groupedNotes] as [date, dayNotes] (date)}
        <div class="date-group">
          <div class="date-header">
            <span class="date-label" class:today={isToday(date)}>
              {isToday(date) ? "Today" : formatDate(date)}
            </span>
            <span class="date-count">{dayNotes.length} note{dayNotes.length !== 1 ? "s" : ""}</span>
          </div>

          {#each dayNotes as note (note.id)}
            <div class="note-card" on:click={() => openNote(note)} on:keydown={() => {}}>
              <div class="note-card-top">
                <span class="note-title">{note.title || "Untitled"}</span>
                <span class="note-time">{timeLabel(note.updatedAt)}</span>
              </div>
              <p class="note-preview">{previewText(note.content)}</p>
              <div class="note-meta">
                {#if note.images.length > 0}
                  <span class="meta-tag">🖼 {note.images.length}</span>
                {/if}
                <span class="meta-tag">{note.content.split(/\s+/).filter(Boolean).length} words</span>
              </div>
              <div class="note-card-actions">
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <span class="card-action" on:click|stopPropagation={() => duplicateNote(note)}>Dup</span>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <span class="card-action danger" on:click|stopPropagation={() => deleteNote(note.id)}>Del</span>
              </div>
            </div>
          {/each}
        </div>
      {/each}

      {#if filteredNotes.length === 0}
        <div class="empty">
          {searchQuery ? "No notes match your search." : "No notes yet. Click + New Note to start."}
        </div>
      {/if}
    </div>

  {:else if view === "edit" && activeNote}
    <!-- ==================== EDIT VIEW ==================== -->
    <div class="edit-controls">
      <button class="action-btn" on:click={backToList}>← Back</button>
      <span class="edit-saved">Auto-saved</span>
      <button class="action-btn danger-btn" on:click={() => deleteNote(activeNote?.id || "")}>Delete</button>
    </div>

    <div class="edit-meta">
      <input
        type="date"
        class="date-input"
        bind:value={activeNote.date}
        on:change={onContentChange}
      />
    </div>

    <input
      type="text"
      class="title-input"
      bind:value={activeNote.title}
      on:input={onContentChange}
      placeholder="Note title..."
    />

    <textarea
      class="content-textarea"
      bind:value={activeNote.content}
      on:input={onContentChange}
      on:paste={handlePaste}
      placeholder="Write your notes here... (Paste images with Ctrl+V)"
    ></textarea>

    <!-- Image section -->
    <div class="image-section">
      <div class="image-controls">
        <button class="action-btn" on:click={triggerImageUpload}>🖼 Add Image</button>
        <span class="image-hint">or paste (Ctrl+V) into the text area</span>
      </div>
      <input
        type="file"
        accept="image/*"
        multiple
        bind:this={fileInputEl}
        on:change={handleImageUpload}
        class="hidden-input"
      />

      {#if activeNote.images.length > 0}
        <div class="image-grid">
          {#each activeNote.images as img, idx}
            <div class="image-thumb">
              <img src={img.data} alt={img.name} />
              <button class="img-remove" on:click={() => removeImage(idx)} title="Remove">✕</button>
              <span class="img-name">{img.name}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .notes-app {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
  }

  /* ======== LIST VIEW ======== */
  .list-controls {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }

  .list-controls .action-btn { font-size: 12px; padding: 4px 12px; }

  .action-btn {
    padding: 5px 12px;
    font-size: 12px;
    color: var(--text);
    border: 1px solid var(--border);
    background: var(--bg-input);
    cursor: pointer;
  }

  .action-btn.primary { color: var(--accent); border-color: var(--accent-dim); }
  .action-btn.primary:hover { background: rgba(200, 169, 110, 0.1); }
  .danger-btn:hover { color: var(--danger); border-color: var(--danger); }

  .sort-btn {
    margin-left: auto;
    font-size: 11px;
    padding: 3px 8px;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
  }
  .sort-btn:hover { color: var(--text); border-color: var(--border-focus); }

  .search-input {
    font-size: 12px;
    padding: 6px 10px;
  }

  .notes-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    flex: 1;
  }

  .date-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .date-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 2px;
    border-bottom: 1px solid var(--border);
  }

  .date-label {
    font-family: var(--font-heading);
    font-size: 12px;
    color: var(--text-dim);
    font-weight: 600;
  }

  .date-label.today { color: var(--accent); }

  .date-count {
    font-size: 10px;
    color: var(--text-dim);
    opacity: 0.5;
  }

  .note-card {
    padding: 8px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: border-color var(--transition);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .note-card:hover { border-color: var(--border-focus); }

  .note-card-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .note-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-bright);
  }

  .note-time {
    font-size: 10px;
    color: var(--text-dim);
    opacity: 0.5;
  }

  .note-preview {
    font-size: 12px;
    color: var(--text-dim);
    line-height: 1.3;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .note-meta {
    display: flex;
    gap: 8px;
  }

  .meta-tag {
    font-size: 10px;
    color: var(--text-dim);
    opacity: 0.5;
  }

  .note-card-actions {
    display: flex;
    gap: 8px;
    margin-top: 2px;
  }

  .card-action {
    font-size: 10px;
    color: var(--text-dim);
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms;
  }

  .note-card:hover .card-action { opacity: 0.6; }
  .card-action:hover { opacity: 1 !important; }
  .card-action.danger:hover { color: var(--danger); }

  .empty {
    text-align: center;
    padding: 24px;
    font-size: 12px;
    color: var(--text-dim);
    opacity: 0.4;
  }

  /* ======== EDIT VIEW ======== */
  .edit-controls {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .edit-saved {
    font-size: 10px;
    color: var(--success);
    opacity: 0.6;
    margin-left: auto;
    margin-right: 4px;
  }

  .edit-meta {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .date-input {
    font-size: 12px;
    padding: 3px 8px;
    color: var(--text);
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color-scheme: dark;
  }

  .title-input {
    font-size: 16px;
    font-weight: 600;
    font-family: var(--font-heading);
    padding: 6px 10px;
    color: var(--text-bright);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .title-input::placeholder { color: var(--text-dim); opacity: 0.4; }

  .content-textarea {
    flex: 1;
    min-height: 150px;
    padding: 10px;
    font-size: 13px;
    font-family: var(--font-body);
    line-height: 1.6;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    resize: none;
  }

  .content-textarea::placeholder { color: var(--text-dim); opacity: 0.3; }

  /* ---- Images ---- */
  .image-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .image-controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .image-hint {
    font-size: 10px;
    color: var(--text-dim);
    opacity: 0.5;
  }

  .hidden-input { display: none; }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 6px;
  }

  .image-thumb {
    position: relative;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    aspect-ratio: 1;
  }

  .image-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .img-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    padding: 0;
    font-size: 10px;
    color: var(--text-bright);
    background: rgba(0, 0, 0, 0.7);
    border: none;
    border-radius: 2px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .image-thumb:hover .img-remove { opacity: 1; }

  .img-name {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 2px 4px;
    font-size: 9px;
    color: var(--text);
    background: rgba(0, 0, 0, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
