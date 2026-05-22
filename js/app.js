(function () {
  const state = {
    departments: structuredClone(DEPARTMENTS),
    activeDeptId: DEPARTMENTS[0].id,
    isAdmin: false,
    dirty: false,
  };

  const $ = (sel) => document.querySelector(sel);
  const loginOverlay = $("#login-overlay");
  const app = $("#app");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const deptList = $("#dept-list");
  const sheetMeta = $("#sheet-meta");
  const sheetBody = $("#sheet-body");
  const sheetHead = $("#sheet-head");
  const saveStatus = $("#save-status");
  const roleBadge = $("#role-badge");
  const readonlyBanner = $("#readonly-banner");
  const statusDept = $("#status-dept");
  const statusMode = $("#status-mode");
  const logoutBtn = $("#logout-btn");
  const adminLoginBtn = $("#admin-login-btn");

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.departments?.length) {
        state.departments = saved.departments;
      }
    } catch (_) {
      /* ignore corrupt storage */
    }
  }

  function saveToStorage() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ departments: state.departments, updatedAt: Date.now() })
    );
    state.dirty = false;
    saveStatus.textContent = "Saved " + new Date().toLocaleTimeString();
  }

  function setAuth(role) {
    if (role === "admin") {
      sessionStorage.setItem(AUTH_KEY, "admin");
      state.isAdmin = true;
    } else {
      sessionStorage.removeItem(AUTH_KEY);
      state.isAdmin = false;
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
      saveStatus.textContent = state.dirty ? "Unsaved changes…" : "Changes save automatically";
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
        state.activeDeptId = btn.dataset.id;
        renderSidebar();
        renderSheet();
      });
    });
  }

  function renderSheet() {
    const dept = getActiveDept();
    statusDept.textContent = dept.name;

    sheetMeta.innerHTML = `
      <h2>${PLANNING_META.sheetTitle}</h2>
      <div class="meta-row">
        <div><span>DEPARTMENT:</span><strong>${dept.name}</strong></div>
        <div><span>CHAIRMAN:</span><strong>${dept.chairman || "—"}</strong></div>
        <div><span>PC:</span><strong>${dept.pc || "—"}</strong></div>
      </div>
    `;

    const colHeaders = COLUMNS.map(
      (c) => `<th style="min-width:${c.width}px;width:${c.width}px">${c.label}</th>`
    ).join("");

    sheetHead.innerHTML = `<tr><th class="corner-cell"></th>${colHeaders}</tr>`;

    const editable = state.isAdmin;
    const rows = dept.rows || [];

    sheetBody.innerHTML = rows
      .map((row, ri) => {
        const cells = COLUMNS.map((col) => {
          const val = row[col.key] ?? "";
          const extra = col.key === "priority" ? priorityClass(val) : "";
          const disabled = !editable || col.key === "sno" ? "disabled" : "";
          if (col.key === "task" || col.key === "remarks") {
            return `<td><textarea class="cell-input ${extra}" rows="1" ${disabled} data-row="${ri}" data-col="${col.key}">${escapeHtml(val)}</textarea></td>`;
          }
          return `<td><input class="cell-input ${extra}" type="text" ${disabled} data-row="${ri}" data-col="${col.key}" value="${escapeAttr(val)}" /></td>`;
        }).join("");
        return `<tr><td class="row-num">${ri + 1}</td>${cells}</tr>`;
      })
      .join("");

    sheetBody.querySelectorAll(".cell-input:not([disabled])").forEach((el) => {
      el.addEventListener("input", onCellInput);
      el.addEventListener("blur", onCellBlur);
      if (el.tagName === "TEXTAREA") {
        autoResize(el);
        el.addEventListener("input", () => autoResize(el));
      }
    });
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
    const row = Number(el.dataset.row);
    const col = el.dataset.col;
    dept.rows[row][col] = el.value;
    if (col === "priority") {
      el.className = "cell-input " + priorityClass(el.value);
    }
    state.dirty = true;
    saveStatus.textContent = "Unsaved changes…";
  }

  function onCellBlur() {
    if (state.dirty && state.isAdmin) {
      saveToStorage();
    }
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
      renderSheet();
    }
  }

  function resetAll() {
    if (!state.isAdmin) return;
    if (!confirm("Reset ALL departments to original data? This cannot be undone.")) return;
    state.departments = structuredClone(DEPARTMENTS);
    saveToStorage();
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
    const user = $("#username").value.trim();
    const pass = $("#password").value;
    if (user === ADMIN_DEFAULT.username && pass === ADMIN_DEFAULT.password) {
      setAuth("admin");
      hideLogin();
      updateRoleUI();
      renderSheet();
    } else {
      loginError.textContent = "Invalid username or password.";
    }
  });

  $("#cancel-login-btn").addEventListener("click", hideLogin);

  logoutBtn.addEventListener("click", () => {
    setAuth("viewer");
    hideLogin();
  });

  adminLoginBtn.addEventListener("click", showLogin);

  $("#save-btn").addEventListener("click", () => {
    if (state.isAdmin) saveToStorage();
  });

  $("#export-sheet-btn").addEventListener("click", exportExcelSheet);
  $("#export-all-btn").addEventListener("click", exportExcelAll);
  $("#add-row-btn").addEventListener("click", addRow);
  $("#reset-dept-btn").addEventListener("click", resetDepartment);
  $("#reset-all-btn").addEventListener("click", resetAll);

  loadFromStorage();
  if (sessionStorage.getItem(AUTH_KEY) === "admin") {
    state.isAdmin = true;
  }
  showApp();

  window.addEventListener("beforeunload", () => {
    if (state.dirty && state.isAdmin) {
      saveToStorage();
    }
  });
})();
