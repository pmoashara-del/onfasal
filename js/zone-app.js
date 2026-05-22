(function () {
  function render() {
    const list = document.querySelector("#zone-list");
    const tasks = ZONE_CHECKLIST_ITEMS.slice();

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
