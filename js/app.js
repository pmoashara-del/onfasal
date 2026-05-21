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

  function checkAuth() {
    const auth = sessionStorage.getItem(AUTH_KEY);
    if (auth === "admin") {
      state.isAdmin = true;
      showApp();
      return true;
    }
    return false;
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
  }

  function showApp() {
    loginOverlay.classList.add("hidden");
    app.classList.remove("hidden");
    updateRoleUI();
    renderSidebar();
    renderSheet();
  }

  function updateRoleUI() {
    if (state.isAdmin) {
      roleBadge.textContent = "Admin — can edit";
      roleBadge.className = "badge admin";
      readonlyBanner.classList.add("hidden");
      statusMode.textContent = "Edit mode";
    } else {
      roleBadge.textContent = "View only";
      roleBadge.className = "badge viewer";
      readonlyBanner.classList.remove("hidden");
      statusMode.textContent = "Read-only";
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

  function exportCsv() {
    const dept = getActiveDept();
    const headers = COLUMNS.map((c) => c.label);
    const lines = [headers.join(",")];
    dept.rows.forEach((row) => {
      lines.push(
        COLUMNS.map((c) => {
          const v = String(row[c.key] ?? "").replace(/"/g, '""');
          return `"${v}"`;
        }).join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${dept.name}-48hr-planning.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
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
      showApp();
    } else {
      loginError.textContent = "Invalid username or password.";
    }
  });

  $("#viewer-btn").addEventListener("click", () => {
    setAuth("viewer");
    showApp();
  });

  $("#logout-btn").addEventListener("click", () => {
    setAuth("viewer");
    sessionStorage.removeItem(AUTH_KEY);
    state.isAdmin = false;
    app.classList.add("hidden");
    loginOverlay.classList.remove("hidden");
    loginForm.reset();
    loginError.textContent = "";
  });

  $("#admin-login-btn").addEventListener("click", () => {
    app.classList.add("hidden");
    loginOverlay.classList.remove("hidden");
  });

  $("#save-btn").addEventListener("click", () => {
    if (state.isAdmin) saveToStorage();
  });

  $("#export-btn").addEventListener("click", exportCsv);
  $("#add-row-btn").addEventListener("click", addRow);
  $("#reset-dept-btn").addEventListener("click", resetDepartment);
  $("#reset-all-btn").addEventListener("click", resetAll);

  loadFromStorage();
  if (checkAuth()) {
    /* already logged in */
  }

  window.addEventListener("beforeunload", (e) => {
    if (state.dirty && state.isAdmin) {
      saveToStorage();
    }
  });
})();
