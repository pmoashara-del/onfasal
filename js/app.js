(function () {
  const META_FIELDS = [
    { key: "chairman", label: "CHAIRMAN" },
    { key: "pc", label: "PC" },
  ];

  const state = {
    departments: structuredClone(DEPARTMENTS),
    activeDeptId: DEPARTMENTS[0].id,
    isAdmin: false,
    dirty: false,
    selection: null,
    focus: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const loginOverlay = $("#login-overlay");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const deptList = $("#dept-list");
  const sheetMeta = $("#sheet-meta");
  const sheetBody = $("#sheet-body");
  const sheetHead = $("#sheet-head");
  const sheetTable = $("#sheet-table");
  const sheetScroll = $("#sheet-scroll");
  const saveStatus = $("#save-status");
  const roleBadge = $("#role-badge");
  const readonlyBanner = $("#readonly-banner");
  const statusDept = $("#status-dept");
  const statusMode = $("#status-mode");
  const statusCell = $("#status-cell");
  const logoutBtn = $("#logout-btn");
  const adminLoginBtn = $("#admin-login-btn");
  let saveTimer = null;
  let lastSavedAt = null;
  let gridEventsBound = false;

  function colIdxForKey(key) {
    return COLUMNS.findIndex((c) => c.key === key);
  }

  function colKeyForIdx(idx) {
    return COLUMNS[idx]?.key;
  }

  function isDataColEditable(colIdx) {
    return colIdx > 0 && colIdx < COLUMNS.length;
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.departments?.length) {
        state.departments = saved.departments;
        lastSavedAt = saved.updatedAt || null;
      }
    } catch (_) {
      /* ignore */
    }
  }

  async function loadData() {
    const statusEl = document.querySelector("#status-saved");
    if (statusEl) statusEl.textContent = "Loading shared data…";
    const cloud = await FasalCloud.loadDepartments();
    if (cloud?.departments?.length) {
      state.departments = cloud.departments;
      lastSavedAt = cloud.updatedAt;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ departments: cloud.departments, updatedAt: cloud.updatedAt })
        );
      } catch (_) {
        /* ignore */
      }
      if (statusEl) {
        statusEl.textContent = "Shared data loaded · " + formatSavedTime(lastSavedAt);
      }
      return;
    }
    loadFromStorage();
    if (statusEl) {
      statusEl.textContent = lastSavedAt
        ? "Loaded (offline cache) · " + formatSavedTime(lastSavedAt)
        : "Using default seed data — sign in as admin to save to cloud";
    }
  }

  async function refreshFromCloud() {
    if (state.dirty || state.isAdmin) return;
    const cloud = await FasalCloud.loadDepartments();
    if (!cloud?.departments?.length) return;
    if (!lastSavedAt || cloud.updatedAt >= lastSavedAt) {
      state.departments = cloud.departments;
      lastSavedAt = cloud.updatedAt;
      renderSidebar();
      renderSheet();
      const statusEl = document.querySelector("#status-saved");
      if (statusEl) statusEl.textContent = "Updated · " + formatSavedTime(lastSavedAt);
    }
  }

  function syncActiveCellToState() {
    const el = document.activeElement;
    if (!el) return;
    const dept = getActiveDept();
    if (el.dataset.meta) {
      dept[el.dataset.meta] = el.value;
      return;
    }
    if (!el.classList.contains("cell-input") || el.disabled) return;
    const row = Number(el.dataset.row);
    const col = el.dataset.col;
    if (!Number.isNaN(row) && col && dept.rows[row]) {
      dept.rows[row][col] = el.value;
    }
  }

  function syncAllMetaFromDom() {
    const dept = getActiveDept();
    sheetMeta.querySelectorAll("[data-meta]").forEach((el) => {
      dept[el.dataset.meta] = el.value;
    });
  }

  function formatSavedTime(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString();
  }

  async function saveToStorage() {
    if (!state.isAdmin) return false;
    syncActiveCellToState();
    syncAllMetaFromDom();
    const updatedAt = Date.now();
    const payload = { departments: state.departments, updatedAt };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      saveStatus.textContent = "Local save failed";
      return false;
    }

    saveStatus.textContent = "Saving to cloud…";
    const result = await FasalCloud.saveDepartments(
      state.departments,
      ADMIN_DEFAULT.password
    );

    state.dirty = false;
    lastSavedAt = updatedAt;

    if (result.ok) {
      saveStatus.textContent = "Saved for everyone · " + formatSavedTime(lastSavedAt);
      const statusEl = document.querySelector("#status-saved");
      if (statusEl) statusEl.textContent = "Shared with all users · " + formatSavedTime(lastSavedAt);
      return true;
    }

    saveStatus.textContent = "Cloud save failed: " + (result.error || "unknown") + " (cached locally)";
    return false;
  }

  function flushSave() {
    if (!state.isAdmin) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    syncActiveCellToState();
    syncAllMetaFromDom();
    if (state.dirty) void saveToStorage();
  }

  function scheduleAutoSave() {
    if (!state.isAdmin) return;
    clearTimeout(saveTimer);
    saveStatus.textContent = "Saving…";
    saveTimer = setTimeout(() => {
      saveTimer = null;
      syncActiveCellToState();
      syncAllMetaFromDom();
      if (state.dirty) void saveToStorage();
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

  function showApp() {
    hideLogin();
    updateRoleUI();
    renderSidebar();
    renderSheet();
    bindGridEvents();
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
          : "Edits save to cloud for all users";
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

  function getActiveDept() {
    return state.departments.find((d) => d.id === state.activeDeptId) || state.departments[0];
  }

  function priorityClass(value) {
    const v = (value || "").toLowerCase();
    if (v.includes("critical")) return "priority-critical";
    if (v.includes("high")) return "priority-high";
    if (v.includes("medium") || v.includes("med")) return "priority-medium";
    return "";
  }

  /* ——— Selection & navigation ——— */

  function addrKey(addr) {
    if (!addr) return "";
    if (addr.kind === "meta") return `m:${addr.key}`;
    return `c:${addr.row},${addr.colIdx}`;
  }

  function makeMetaAddr(key) {
    return { kind: "meta", key };
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
    const dept = getActiveDept();
    if (!isDataColEditable(colIdx)) return;
    const lastRow = Math.max(0, dept.rows.length - 1);
    setSelection(makeCellAddr(0, colIdx), makeCellAddr(lastRow, colIdx));
  }

  function selectRow(row) {
    const firstCol = 1;
    const lastCol = COLUMNS.length - 1;
    setSelection(makeCellAddr(row, firstCol), makeCellAddr(row, lastCol));
  }

  function getSelectedCellSet() {
    if (!state.selection) return new Set();
    const { anchor, focus } = state.selection;
    const set = new Set();

    if (anchor.kind === "meta" || focus.kind === "meta") {
      set.add(addrKey(anchor));
      if (focus.kind === "meta") set.add(addrKey(focus));
      return set;
    }

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
    sheetTable.querySelectorAll(".col-header").forEach((th) => {
      th.classList.remove("selected");
    });
    sheetTable.querySelectorAll(".row-num").forEach((td) => {
      td.classList.remove("selected");
    });

    const selected = getSelectedCellSet();
    const focusKey = state.focus ? addrKey(state.focus) : null;

    selected.forEach((key) => {
      const td = sheetTable.querySelector(`[data-addr="${key}"]`);
      if (td) td.classList.add("selected");
    });

    if (focusKey) {
      const activeTd = sheetTable.querySelector(`[data-addr="${focusKey}"]`);
      if (activeTd) activeTd.classList.add("active-cell");
    }

    if (state.selection?.anchor.kind === "cell" && state.selection.focus.kind === "cell") {
      const c1 = state.selection.anchor.colIdx;
      const c2 = state.selection.focus.colIdx;
      if (c1 === c2 && state.selection.anchor.row !== state.selection.focus.row) {
        sheetTable.querySelector(`.col-header[data-col-idx="${c1}"]`)?.classList.add("selected");
      }
      const r1 = state.selection.anchor.row;
      const r2 = state.selection.focus.row;
      if (r1 === r2 && c1 !== c2) {
        sheetTable.querySelector(`tbody tr:nth-child(${r1 + 1}) .row-num`)?.classList.add("selected");
      }
    }
  }

  function colLabel(colIdx) {
    if (colIdx <= 0) return "";
    return String.fromCharCode(64 + colIdx);
  }

  function updateStatusCell() {
    if (!state.focus) {
      statusCell.textContent = "Ready";
      return;
    }
    if (state.focus.kind === "meta") {
      statusCell.textContent = state.focus.key.toUpperCase();
      return;
    }
    const col = colLabel(state.focus.colIdx);
    const row = state.focus.row + 1;
    const sel = getSelectedCellSet();
    if (sel.size > 1) {
      statusCell.textContent = `${sel.size} cells selected`;
    } else {
      statusCell.textContent = `${col}${row}`;
    }
  }

  function getInputForAddr(addr) {
    if (!addr) return null;
    if (addr.kind === "meta") {
      return sheetMeta.querySelector(`[data-meta="${addr.key}"]`);
    }
    const td = sheetTable.querySelector(`[data-addr="${addrKey(addr)}"]`);
    return td?.querySelector(".cell-input");
  }

  function focusAddr(addr, extendSelection) {
    if (!addr) return;
    const input = getInputForAddr(addr);
    if (!input || input.disabled) return;

    if (extendSelection && state.selection?.anchor) {
      setSelection(state.selection.anchor, addr);
    } else {
      setSelection(addr, addr);
    }

    input.focus();
    if (input.select && input.tagName !== "TEXTAREA") {
      input.select();
    } else if (input.setSelectionRange) {
      input.setSelectionRange(0, input.value.length);
    }
    updateSelectionUI();
  }

  function getNavOrder() {
    const order = [];
    if (state.isAdmin) {
      META_FIELDS.forEach((f) => order.push(makeMetaAddr(f.key)));
    }
    const dept = getActiveDept();
    dept.rows.forEach((_, row) => {
      for (let c = 1; c < COLUMNS.length; c++) {
        order.push(makeCellAddr(row, c));
      }
    });
    return order;
  }

  function moveFocus(delta, extend) {
    const order = getNavOrder();
    const current = state.focus || state.selection?.focus;
    if (!current) {
      if (order.length) focusAddr(order[0], false);
      return;
    }
    const idx = order.findIndex((a) => addrKey(a) === addrKey(current));
    const next = order[Math.max(0, Math.min(order.length - 1, idx + delta))];
    focusAddr(next, extend);
  }

  function moveFocusDirection(dir, extend) {
    if (!state.focus || state.focus.kind === "meta") {
      moveFocus(dir === "down" || dir === "right" ? 1 : -1, extend);
      return;
    }

    const dept = getActiveDept();
    const { row, colIdx } = state.focus;
    let nr = row;
    let nc = colIdx;

    if (dir === "up") nr = Math.max(0, row - 1);
    if (dir === "down") nr = Math.min(dept.rows.length - 1, row + 1);
    if (dir === "left") nc = Math.max(1, colIdx - 1);
    if (dir === "right") nc = Math.min(COLUMNS.length - 1, colIdx + 1);

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
      moveFocus(-1, extend);
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

    const row = Number(td.dataset.row);
    const colIdx = Number(td.dataset.colIdx);
    const addr = makeCellAddr(row, colIdx);

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
      if (document.activeElement?.classList.contains("cell-input") ||
          document.activeElement?.classList.contains("meta-input")) {
        return;
      }
      handleNavKeydown(e);
    });

    sheetMeta.addEventListener("keydown", (e) => {
      if (e.target.classList.contains("meta-input")) handleNavKeydown(e);
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
    if (el.dataset.meta) {
      const addr = makeMetaAddr(el.dataset.meta);
      if (!e.shiftKey || !state.selection?.anchor) {
        setSelection(addr, addr);
      } else {
        setSelection(state.selection.anchor, addr);
      }
      return;
    }
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

  /* ——— Export ——— */

  function sanitizeSheetName(name) {
    return String(name).replace(/[\\/*?:\[\]]/g, "").slice(0, 31) || "Sheet";
  }

  function deptToAoA(dept) {
    const aoa = [
      [PLANNING_META.title + " — " + PLANNING_META.location],
      [PLANNING_META.sheetTitle],
      [],
      ["DEPARTMENT:", dept.name, "", "CHAIRMAN:", dept.chairman || "", "", "PC:", dept.pc || ""],
      [],
      COLUMNS.map((c) => c.label),
    ];
    dept.rows.forEach((row) => {
      aoa.push(COLUMNS.map((c) => row[c.key] ?? ""));
    });
    return aoa;
  }

  function exportExcelSheet() {
    if (typeof XLSX === "undefined") {
      alert("Excel library failed to load. Check your internet connection and refresh.");
      return;
    }
    syncAllMetaFromDom();
    const dept = getActiveDept();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(deptToAoA(dept));
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(dept.name));
    XLSX.writeFile(wb, `${sanitizeSheetName(dept.name)}-48hr-planning.xlsx`);
  }

  function exportExcelAll() {
    if (typeof XLSX === "undefined") {
      alert("Excel library failed to load. Check your internet connection and refresh.");
      return;
    }
    const wb = XLSX.utils.book_new();
    const used = new Set();
    state.departments.forEach((dept) => {
      let name = sanitizeSheetName(dept.name);
      let base = name;
      let n = 2;
      while (used.has(name)) {
        const suffix = String(n++);
        name = base.slice(0, 31 - suffix.length) + suffix;
      }
      used.add(name);
      const ws = XLSX.utils.aoa_to_sheet(deptToAoA(dept));
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    XLSX.writeFile(wb, "Fasal-48hr-planning-all-departments.xlsx");
  }

  function renderSidebar() {
    deptList.innerHTML = state.departments
      .map(
        (d) =>
          `<li><button type="button" data-id="${d.id}" class="${d.id === state.activeDeptId ? "active" : ""}">${d.name}</button></li>`
      )
      .join("");

    deptList.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.id === state.activeDeptId) return;
        flushSave();
        state.activeDeptId = btn.dataset.id;
        clearSelection();
        renderSidebar();
        renderSheet();
      });
    });
  }

  function renderSheet() {
    const dept = getActiveDept();
    statusDept.textContent = dept.name;
    const editable = state.isAdmin;

    const metaFieldsHtml = META_FIELDS.map((f) => {
      const val = dept[f.key] || "";
      const input = editable
        ? `<input type="text" class="meta-input cell-input" data-meta="${f.key}" value="${escapeAttr(val)}" />`
        : `<span class="meta-value">${escapeHtml(val) || "—"}</span>`;
      return `<div class="meta-field"><span class="meta-label">${f.label}:</span>${input}</div>`;
    }).join("");

    sheetMeta.innerHTML = `
      <h2>${PLANNING_META.sheetTitle}</h2>
      <div class="meta-row">
        <div class="meta-field meta-field--dept"><span class="meta-label">DEPARTMENT:</span><strong>${escapeHtml(dept.name)}</strong></div>
        ${metaFieldsHtml}
      </div>
    `;

    if (editable) {
      sheetMeta.querySelectorAll(".meta-input").forEach((el) => {
        el.addEventListener("input", () => {
          dept[el.dataset.meta] = el.value;
          markDirty();
        });
        el.addEventListener("blur", onCellBlur);
        el.addEventListener("focus", onCellFocus);
        el.addEventListener("keydown", handleNavKeydown);
      });
    }

    const colHeaders = COLUMNS.map(
      (c, i) =>
        `<th class="col-header ${i > 0 && editable ? "col-header--selectable" : ""}" data-col-idx="${i}" style="min-width:${c.width}px;width:${c.width}px" title="${i > 0 && editable ? "Click to select column" : ""}">${c.label}</th>`
    ).join("");

    sheetHead.innerHTML = `<tr><th class="corner-cell"></th>${colHeaders}</tr>`;

    const rows = dept.rows || [];

    sheetBody.innerHTML = rows
      .map((row, ri) => {
        const cells = COLUMNS.map((col, ci) => {
          const val = row[col.key] ?? "";
          const extra = col.key === "priority" ? priorityClass(val) : "";
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
        return `<tr><td class="${rowClass}" data-row="${ri}" title="${editable ? "Click to select row" : ""}">${ri + 1}</td>${cells}</tr>`;
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
    const dept = getActiveDept();
    if (el.dataset.meta) {
      dept[el.dataset.meta] = el.value;
      markDirty();
      return;
    }
    const row = Number(el.dataset.row);
    const col = el.dataset.col;
    dept.rows[row][col] = el.value;
    if (col === "priority") {
      el.className = "cell-input " + priorityClass(el.value);
    }
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

  function resetDepartment() {
    if (!state.isAdmin) return;
    if (!confirm(`Reset ${getActiveDept().name} to original seed data?`)) return;
    const seed = DEPARTMENTS.find((d) => d.id === state.activeDeptId);
    if (seed) {
      const idx = state.departments.findIndex((d) => d.id === state.activeDeptId);
      state.departments[idx] = structuredClone(seed);
      saveToStorage();
      clearSelection();
      renderSheet();
    }
  }

  function resetAll() {
    if (!state.isAdmin) return;
    if (!confirm("Reset ALL departments to original data? This cannot be undone.")) return;
    state.departments = structuredClone(DEPARTMENTS);
    saveToStorage();
    clearSelection();
    renderSidebar();
    renderSheet();
  }

  function addRow() {
    if (!state.isAdmin) return;
    const dept = getActiveDept();
    const next = dept.rows.length + 1;
    dept.rows.push({ sno: next, task: "", assignedTo: "", dependency: "", priority: "", zone: "", remarks: "" });
    state.dirty = true;
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
      updateRoleUI();
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
      saveTimer = null;
      state.dirty = true;
      flushSave();
    }
  });

  document.querySelector("#export-sheet-btn").addEventListener("click", exportExcelSheet);
  document.querySelector("#export-all-btn").addEventListener("click", exportExcelAll);
  document.querySelector("#add-row-btn").addEventListener("click", addRow);
  document.querySelector("#reset-dept-btn").addEventListener("click", resetDepartment);
  document.querySelector("#reset-all-btn").addEventListener("click", resetAll);

  (async function init() {
    await loadData();
    if (sessionStorage.getItem(AUTH_KEY) === "admin") {
      state.isAdmin = true;
    }
    showApp();
  })();

  window.addEventListener("beforeunload", flushSave);
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSave();
    if (document.visibilityState === "visible") void refreshFromCloud();
  });

  setInterval(() => {
    if (!state.isAdmin && !state.dirty) void refreshFromCloud();
  }, 45000);
})();
