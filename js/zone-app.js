(function () {
  function loadTasks() {
    try {
      const raw = localStorage.getItem(ZONE_STORAGE_KEY);
      if (!raw) return ZONE_CHECKLIST_ITEMS.slice();
      const saved = JSON.parse(raw);
      if (saved?.items?.length) return saved.items;
      if (saved?.rows?.length) return saved.rows.map((r) => r.task || r);
    } catch (_) {
      /* ignore */
    }
    return ZONE_CHECKLIST_ITEMS.slice();
  }

  function render() {
    const list = document.querySelector("#zone-list");
    const tasks = loadTasks();

    list.innerHTML = tasks
      .map(
        (task, i) => `
      <li class="zone-item">
        <span class="zone-item-num">${i + 1}.</span>
        <p class="zone-item-text">${escapeHtml(task)}</p>
      </li>`
      )
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  render();
})();
