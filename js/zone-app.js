(function () {
  const state = {
    rows: structuredClone(ZONE_SEED_ROWS),
    isAdmin: false,
    dirty: false,
    selection: null,
    focus: null,
  };

  const loginOverlay = document.querySelector("#login-overlay");
  const loginForm = document.querySelector("#login-form");
  const loginError = document.querySelector("#login-error");
  const sheetMeta = document.querySelector("#sheet-meta");
  const sheetBody = document.querySelector("#sheet-body");
  const sheetHead = document.querySelector("#sheet-head");
  const sheetTable = document.querySelector("#sheet-table");
  const sheetScroll = document.querySelector("#sheet-scroll");
  const saveStatus = document.querySelector("#save-status");
  const roleBadge = document.querySelector("#role-badge");
  const readonlyBanner = document.querySelector("#readonly-banner");
  const statusMode = document.querySelector("#status-mode");
  const statusCell = document.querySelector("#status-cell");
  const statusCount = document.querySelector("#status-count");
  const logoutBtn = document.querySelector("#logout-btn");
  const adminLoginBtn = document.querySelector("#admin-login-btn");
  let saveTimer = null;
  let lastSavedAt = null;
  let gridEventsBound = false;

  function colIdxForKey(key) {
    return ZONE_COLUMNS.findIndex((c) => c.key === key);
  }

  function isDataColEditable(colIdx) {
    return colIdx > 0 && colIdx < ZONE_COLUMNS.length;
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(ZONE_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.rows?.length) {
        state.rows = saved.rows;
        lastSavedAt = saved.updatedAt || null;
      }
    } catch (_) {
      /* ignore */
    }
  }

  function syncActiveCellToState() {
    const el = document.activeElement;
    if (!el?.classList.contains("cell-input") || el.disabled) return;
    const row = Number(el.dataset.row);
    const col = el.dataset.col;
    if (!Number.isNaN(row) && col && state.rows[row]) {
      state.rows[row][col] = el.value;
    }
  }

  function formatSavedTime(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString();
  }

  function saveToStorage() {
    if (!state.isAdmin) return false;
    syncActiveCellToState();
    const payload = { rows: state.rows, updatedAt: Date.now() };
    try {
      localStorage.setItem(ZONE_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      saveStatus.textContent = "Save failed — browser storage may be full";
      return false;
    }
    state.dirty = false;
    lastSavedAt = payload.updatedAt;
    saveStatus.textContent = "All changes saved · " + formatSavedTime(lastSavedAt);
    return true;
  }

  function flushSave() {
    if (!state.isAdmin) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    syncActiveCellToState();
    if (state.dirty) saveToStorage();
  }

  function scheduleAutoSave() {
    if (!state.isAdmin) return;
    clearTimeout(saveTimer);
    saveStatus.textContent = "Saving…";
    saveTimer = setTimeout(() => {
      saveTimer = null;
      syncActiveCellToState();
      if (state.dirty) saveToStorage();
    }, 400);
  }

  function markDirty() {
    state.dirty = true;
    scheduleAutoSave();
  }

  function setAuth(role) {
    if (role === "admin") {
      sessionStorage.setItem(AUTH_KEY, "admin");
      state.isAdmin = true;
    } else {
      sessionStorage.removeItem(AUTH_KEY);
      state.isAdmin = false;
      clearSelection();
    }
    updateRoleUI();
    renderSheet();
  }

  function showLogin() {
    loginForm.reset();
    loginError.textContent = "";
    loginOverlay.classList.remove("hidden");
  }

  function hideLogin() {
    loginOverlay.classList.add("hidden");
  }

  function updateRoleUI() {
    document.querySelectorAll(".admin-only").forEach((el) => {
      el.classList.toggle("hidden", !state.isAdmin);
    });
    if (state.isAdmin) {
      roleBadge.textContent = "Admin — can edit";
      roleBadge.className = "badge admin";
      readonlyBanner.classList.add("hidden");
      statusMode.textContent = "Edit mode";
      logoutBtn.classList.remove("hidden");
      adminLoginBtn.classList.add("hidden");
      saveStatus.textContent = state.dirty
        ? "Unsaved changes…"
        : lastSavedAt
          ? "All changes saved · " + formatSavedTime(lastSavedAt)
          : "Edits save automatically to this browser";
    } else {
      roleBadge.textContent = "View only";
      roleBadge.className = "badge viewer";
      readonlyBanner.classList.remove("hidden");
      statusMode.textContent = "Read-only";
      logoutBtn.classList.add("hidden");
      adminLoginBtn.classList.remove("hidden");
      saveStatus.textContent = "";
    }
  }

  function addrKey(addr) {
    if (!addr) return "";
    return `c:${addr.row},${addr.colIdx}`;
  }

  function makeCellAddr(row, colIdx) {
    return { kind: "cell", row, colIdx };
  }

  function clearSelection() {
    state.selection = null;
    state.focus = null;
    updateSelectionUI();
    statusCell.textContent = "Ready";
  }

  function setSelection(anchor, focus) {
    state.selection = { anchor, focus: focus || anchor };
    state.focus = state.selection.focus;
    updateSelectionUI();
    updateStatusCell();
  }

  function selectColumn(colIdx) {
    if (!isDataColEditable(colIdx)) return;
    const lastRow = Math.max(0, state.rows.length - 1);
    setSelection(makeCellAddr(0, colIdx), makeCellAddr(lastRow, colIdx));
  }

  function selectRow(row) {
    setSelection(makeCellAddr(row, 1), makeCellAddr(row, ZONE_COLUMNS.length - 1));
  }

  function getSelectedCellSet() {
    if (!state.selection) return new Set();
    const { anchor, focus } = state.selection;
    const set = new Set();
    const r1 = Math.min(anchor.row, focus.row);
    const r2 = Math.max(anchor.row, focus.row);
    const c1 = Math.min(anchor.colIdx, focus.colIdx);
    const c2 = Math.max(anchor.colIdx, focus.colIdx);
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (isDataColEditable(c)) set.add(addrKey(makeCellAddr(r, c)));
      }
    }
    return set;
  }

  function updateSelectionUI() {
    sheetTable.querySelectorAll(".cell-td").forEach((td) => {
      td.classList.remove("selected", "active-cell");
    });
    sheetTable.querySelectorAll(".col-header").forEach((th) => th.classList.remove("selected"));
    sheetTable.querySelectorAll(".row-num").forEach((td) => td.classList.remove("selected"));

    const selected = getSelectedCellSet();
    const focusKey = state.focus ? addrKey(state.focus) : null;
    selected.forEach((key) => {
      sheetTable.querySelector(`[data-addr="${key}"]`)?.classList.add("selected");
    });
    if (focusKey) {
      sheetTable.querySelector(`[data-addr="${focusKey}"]`)?.classList.add("active-cell");
    }
    if (state.selection?.anchor.kind === "cell") {
      const c1 = state.selection.anchor.colIdx;
      const c2 = state.selection.focus.colIdx;
      if (c1 === c2 && state.selection.anchor.row !== state.selection.focus.row) {
        sheetTable.querySelector(`.col-header[data-col-idx="${c1}"]`)?.classList.add("selected");
      }
    }
  }

  function colLabel(colIdx) {
    return colIdx <= 0 ? "" : String.fromCharCode(64 + colIdx);
  }

  function updateStatusCell() {
    if (!state.focus) {
      statusCell.textContent = "Ready";
      return;
    }
    const sel = getSelectedCellSet();
    if (sel.size > 1) {
      statusCell.textContent = `${sel.size} cells selected`;
      return;
    }
    statusCell.textContent = `${colLabel(state.focus.colIdx)}${state.focus.row + 1}`;
  }

  function getInputForAddr(addr) {
    const td = sheetTable.querySelector(`[data-addr="${addrKey(addr)}"]`);
    return td?.querySelector(".cell-input");
  }

  function focusAddr(addr, extend) {
    const input = getInputForAddr(addr);
    if (!input || input.disabled) return;
    if (extend && state.selection?.anchor) {
      setSelection(state.selection.anchor, addr);
    } else {
      setSelection(addr, addr);
    }
    input.focus();
    if (input.select && input.tagName !== "TEXTAREA") input.select();
  }

  function moveFocusDirection(dir, extend) {
    if (!state.focus) return;
    const { row, colIdx } = state.focus;
    let nr = row;
    let nc = colIdx;
    if (dir === "up") nr = Math.max(0, row - 1);
    if (dir === "down") nr = Math.min(state.rows.length - 1, row + 1);
    if (dir === "left") nc = Math.max(1, colIdx - 1);
    if (dir === "right") nc = Math.min(ZONE_COLUMNS.length - 1, colIdx + 1);
    focusAddr(makeCellAddr(nr, nc), extend);
  }

  function handleNavKeydown(e) {
    if (!state.isAdmin) return;
    const extend = e.shiftKey;
    const key = e.key;
    if (key === "ArrowUp") {
      e.preventDefault();
      moveFocusDirection("up", extend);
    } else if (key === "ArrowDown" || key === "Enter") {
      e.preventDefault();
      moveFocusDirection("down", extend);
    } else if (key === "ArrowLeft") {
      e.preventDefault();
      moveFocusDirection("left", extend);
    } else if (key === "ArrowRight" || (key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      moveFocusDirection("right", extend);
    } else if (key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const order = [];
      state.rows.forEach((_, r) => {
        for (let c = 1; c < ZONE_COLUMNS.length; c++) order.push(makeCellAddr(r, c));
      });
      const idx = order.findIndex((a) => addrKey(a) === addrKey(state.focus));
      if (idx > 0) focusAddr(order[idx - 1], extend);
    } else if (key === "Escape") {
      clearSelection();
      e.target.blur();
    }
  }

  function onGridMouseDown(e) {
    if (!state.isAdmin) return;
    const colHeader = e.target.closest(".col-header");
    if (colHeader) {
      e.preventDefault();
      const colIdx = Number(colHeader.dataset.colIdx);
      selectColumn(colIdx);
      focusAddr(makeCellAddr(0, colIdx), false);
      sheetScroll.focus();
      return;
    }
    const rowNum = e.target.closest(".row-num.selectable");
    if (rowNum) {
      e.preventDefault();
      const row = Number(rowNum.dataset.row);
      selectRow(row);
      focusAddr(makeCellAddr(row, 1), false);
      sheetScroll.focus();
      return;
    }
    const td = e.target.closest(".cell-td");
    if (!td || td.querySelector(".cell-input")?.disabled) return;
    const addr = makeCellAddr(Number(td.dataset.row), Number(td.dataset.colIdx));
    if (e.shiftKey && state.selection?.anchor) {
      setSelection(state.selection.anchor, addr);
    } else {
      setSelection(addr, addr);
    }
    sheetScroll.focus();
  }

  function bindGridEvents() {
    if (gridEventsBound) return;
    gridEventsBound = true;
    sheetTable.addEventListener("mousedown", onGridMouseDown);
    sheetScroll.addEventListener("keydown", (e) => {
      if (document.activeElement?.classList.contains("cell-input")) return;
      handleNavKeydown(e);
    });
  }

  function bindCellInput(el) {
    el.addEventListener("input", onCellInput);
    el.addEventListener("blur", onCellBlur);
    el.addEventListener("focus", onCellFocus);
    el.addEventListener("keydown", handleNavKeydown);
    if (el.tagName === "TEXTAREA") {
      autoResize(el);
      el.addEventListener("input", () => autoResize(el));
    }
  }

  function onCellFocus(e) {
    const el = e.target;
    const row = Number(el.dataset.row);
    const colIdx = colIdxForKey(el.dataset.col);
    if (Number.isNaN(row) || colIdx < 0) return;
    const addr = makeCellAddr(row, colIdx);
    if (!e.shiftKey || !state.selection?.anchor) {
      setSelection(addr, addr);
    } else {
      setSelection(state.selection.anchor, addr);
    }
  }

  function priorityClass(value) {
    const v = (value || "").toLowerCase();
    if (v.includes("complete") || v.includes("done")) return "priority-medium";
    if (v.includes("progress")) return "priority-high";
    if (v.includes("pending") || v.includes("critical")) return "priority-critical";
    return "";
  }

  function exportExcel() {
    if (typeof XLSX === "undefined") {
      alert("Excel library failed to load.");
      return;
    }
    syncActiveCellToState();
    const aoa = [
      [ZONE_META.title],
      [ZONE_META.subtitle],
      [],
      ZONE_COLUMNS.map((c) => c.label),
    ];
    state.rows.forEach((row) => {
      aoa.push(ZONE_COLUMNS.map((c) => row[c.key] ?? ""));
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "Zone Checklist");
    XLSX.writeFile(wb, "Zone-48hr-checklist.xlsx");
  }

  function renderSheet() {
    const editable = state.isAdmin;
    statusCount.textContent = String(state.rows.length);

    sheetMeta.innerHTML = `
      <h2>${ZONE_META.subtitle}</h2>
      <p class="sheet-meta-note">${ZONE_META.title} · Assign owners and zones per item. All checklist points apply across zonal operations.</p>
    `;

    const colHeaders = ZONE_COLUMNS.map(
      (c, i) =>
        `<th class="col-header ${i > 0 && editable ? "col-header--selectable" : ""}" data-col-idx="${i}" style="min-width:${c.width}px;width:${c.width}px">${c.label}</th>`
    ).join("");

    sheetHead.innerHTML = `<tr><th class="corner-cell"></th>${colHeaders}</tr>`;

    sheetBody.innerHTML = state.rows
      .map((row, ri) => {
        const cells = ZONE_COLUMNS.map((col, ci) => {
          const val = row[col.key] ?? "";
          const extra = col.key === "status" ? priorityClass(val) : "";
          const disabled = !editable || col.key === "sno" ? "disabled" : "";
          const addr = makeCellAddr(ri, ci);
          const addrAttr = col.key === "sno" ? "" : `data-addr="${addrKey(addr)}"`;
          const tdClass = `cell-td ${col.key === "sno" ? "cell-td--sno" : ""}`;
          if (col.key === "task" || col.key === "remarks") {
            return `<td class="${tdClass}" data-row="${ri}" data-col-idx="${ci}" ${addrAttr}><textarea class="cell-input ${extra}" rows="1" ${disabled} data-row="${ri}" data-col="${col.key}">${escapeHtml(val)}</textarea></td>`;
          }
          return `<td class="${tdClass}" data-row="${ri}" data-col-idx="${ci}" ${addrAttr}><input class="cell-input ${extra}" type="text" ${disabled} data-row="${ri}" data-col="${col.key}" value="${escapeAttr(val)}" /></td>`;
        }).join("");
        const rowClass = editable ? "row-num selectable" : "row-num";
        return `<tr><td class="${rowClass}" data-row="${ri}">${ri + 1}</td>${cells}</tr>`;
      })
      .join("");

    sheetBody.querySelectorAll(".cell-input:not([disabled])").forEach(bindCellInput);
    updateSelectionUI();
    updateStatusCell();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
  }

  function onCellInput(e) {
    const el = e.target;
    const row = Number(el.dataset.row);
    const col = el.dataset.col;
    state.rows[row][col] = el.value;
    if (col === "status") el.className = "cell-input " + priorityClass(el.value);
    markDirty();
  }

  function onCellBlur() {
    clearTimeout(saveTimer);
    saveTimer = null;
    flushSave();
  }

  function autoResize(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.max(26, ta.scrollHeight) + "px";
  }

  function resetChecklist() {
    if (!state.isAdmin) return;
    if (!confirm("Reset zone checklist to original items?")) return;
    state.rows = structuredClone(ZONE_SEED_ROWS);
    saveToStorage();
    clearSelection();
    renderSheet();
  }

  function addRow() {
    if (!state.isAdmin) return;
    state.rows.push({
      sno: state.rows.length + 1,
      task: "",
      zone: "ALL ZONES",
      assignedTo: "",
      status: "",
      remarks: "",
    });
    saveToStorage();
    renderSheet();
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const user = document.querySelector("#username").value.trim();
    const pass = document.querySelector("#password").value;
    if (user === ADMIN_DEFAULT.username && pass === ADMIN_DEFAULT.password) {
      setAuth("admin");
      hideLogin();
      renderSheet();
    } else {
      loginError.textContent = "Invalid username or password.";
    }
  });

  document.querySelector("#cancel-login-btn").addEventListener("click", hideLogin);
  logoutBtn.addEventListener("click", () => {
    flushSave();
    setAuth("viewer");
    hideLogin();
  });
  adminLoginBtn.addEventListener("click", showLogin);
  document.querySelector("#save-btn").addEventListener("click", () => {
    if (state.isAdmin) {
      clearTimeout(saveTimer);
      state.dirty = true;
      flushSave();
    }
  });
  document.querySelector("#export-btn").addEventListener("click", exportExcel);
  document.querySelector("#add-row-btn").addEventListener("click", addRow);
  document.querySelector("#reset-btn").addEventListener("click", resetChecklist);

  loadFromStorage();
  if (sessionStorage.getItem(AUTH_KEY) === "admin") state.isAdmin = true;
  updateRoleUI();
  renderSheet();
  bindGridEvents();
  hideLogin();

  window.addEventListener("beforeunload", flushSave);
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSave();
  });
})();
