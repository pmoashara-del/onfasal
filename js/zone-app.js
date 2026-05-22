(function () {
  const STATUS_OPTIONS = ["", "Pending", "In Progress", "Complete", "Critical"];

  const state = {
    rows: structuredClone(ZONE_SEED_ROWS),
    isAdmin: false,
    dirty: false,
    filterZone: "",
  };

  const loginOverlay = document.querySelector("#login-overlay");
  const loginForm = document.querySelector("#login-form");
  const loginError = document.querySelector("#login-error");
  const zoneCards = document.querySelector("#zone-cards");
  const saveStatus = document.querySelector("#save-status");
  const roleBadge = document.querySelector("#role-badge");
  const readonlyBanner = document.querySelector("#readonly-banner");
  const statusMode = document.querySelector("#status-mode");
  const statusCount = document.querySelector("#status-count");
  const progressText = document.querySelector("#progress-text");
  const progressFill = document.querySelector("#progress-fill");
  const logoutBtn = document.querySelector("#logout-btn");
  const adminLoginBtn = document.querySelector("#admin-login-btn");
  const zoneFilter = document.querySelector("#zone-filter");
  let saveTimer = null;
  let lastSavedAt = null;

  function statusKind(status) {
    const s = (status || "").toLowerCase();
    if (s.includes("complete") || s.includes("done")) return "complete";
    if (s.includes("progress")) return "progress";
    if (s.includes("pending") || s.includes("critical")) return "pending";
    return "empty";
  }

  function badgeLabel(status) {
    if (!status) return "Not set";
    return status;
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

  function syncFromDom() {
    zoneCards.querySelectorAll(".zone-card").forEach((card) => {
      const idx = Number(card.dataset.index);
      if (Number.isNaN(idx) || !state.rows[idx]) return;
      const row = state.rows[idx];
      const zone = card.querySelector('[data-field="zone"]');
      const assigned = card.querySelector('[data-field="assignedTo"]');
      const status = card.querySelector('[data-field="status"]');
      const remarks = card.querySelector('[data-field="remarks"]');
      if (zone) row.zone = zone.value;
      if (assigned) row.assignedTo = assigned.value;
      if (status) row.status = status.value;
      if (remarks) row.remarks = remarks.value;
    });
  }

  function formatSavedTime(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString();
  }

  function saveToStorage() {
    if (!state.isAdmin) return false;
    syncFromDom();
    const payload = { rows: state.rows, updatedAt: Date.now() };
    try {
      localStorage.setItem(ZONE_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      saveStatus.textContent = "Save failed";
      return false;
    }
    state.dirty = false;
    lastSavedAt = payload.updatedAt;
    saveStatus.textContent = "Saved · " + formatSavedTime(lastSavedAt);
    return true;
  }

  function flushSave() {
    if (!state.isAdmin) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    syncFromDom();
    if (state.dirty) saveToStorage();
  }

  function scheduleAutoSave() {
    if (!state.isAdmin) return;
    clearTimeout(saveTimer);
    saveStatus.textContent = "Saving…";
    saveTimer = setTimeout(() => {
      saveTimer = null;
      syncFromDom();
      if (state.dirty) saveToStorage();
    }, 400);
  }

  function markDirty() {
    state.dirty = true;
    scheduleAutoSave();
    updateProgress();
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
    renderCards();
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
      roleBadge.textContent = "Admin";
      roleBadge.className = "badge admin";
      readonlyBanner.classList.add("hidden");
      statusMode.textContent = "Edit mode";
      logoutBtn.classList.remove("hidden");
      adminLoginBtn.classList.add("hidden");
      saveStatus.textContent = state.dirty
        ? "Unsaved…"
        : lastSavedAt
          ? "Saved · " + formatSavedTime(lastSavedAt)
          : "";
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

  function updateProgress() {
    const total = state.rows.length;
    const complete = state.rows.filter((r) => statusKind(r.status) === "complete").length;
    const pct = total ? Math.round((complete / total) * 100) : 0;
    statusCount.textContent = `${total} checklist items`;
    progressText.textContent = `${complete} of ${total} complete (${pct}%)`;
    progressFill.style.width = pct + "%";
  }

  function matchesFilter(row) {
    if (!state.filterZone) return true;
    const z = (row.zone || "").toUpperCase();
    const f = state.filterZone.toUpperCase();
    return z === f || z.includes(f);
  }

  function fieldHtml(label, field, value, editable, type) {
    if (!editable) {
      return `<div class="zone-field">
        <span class="zone-field-label">${label}</span>
        <span class="zone-field-value">${escapeHtml(value || "—")}</span>
      </div>`;
    }
    if (type === "select-status") {
      const opts = STATUS_OPTIONS.map(
        (o) => `<option value="${escapeAttr(o)}" ${o === value ? "selected" : ""}>${o || "—"}</option>`
      ).join("");
      return `<div class="zone-field">
        <span class="zone-field-label">${label}</span>
        <select data-field="${field}" class="zone-input">${opts}</select>
      </div>`;
    }
    if (type === "textarea") {
      return `<div class="zone-field">
        <span class="zone-field-label">${label}</span>
        <textarea data-field="${field}" class="zone-input" rows="2">${escapeHtml(value)}</textarea>
      </div>`;
    }
    return `<div class="zone-field">
      <span class="zone-field-label">${label}</span>
      <input type="text" data-field="${field}" class="zone-input" value="${escapeAttr(value)}" />
    </div>`;
  }

  function renderCards() {
    const editable = state.isAdmin;
    updateProgress();

    zoneCards.innerHTML = state.rows
      .map((row, i) => {
        const kind = statusKind(row.status);
        const hidden = matchesFilter(row) ? "" : "is-hidden";
        return `
        <article class="zone-card is-${kind} ${hidden}" data-index="${i}">
          <header class="zone-card-header">
            <span class="zone-card-num">${String(i + 1).padStart(2, "0")}</span>
            <p class="zone-card-task">${escapeHtml(row.task)}</p>
            <span class="zone-card-badge zone-card-badge--${kind}">${escapeHtml(badgeLabel(row.status))}</span>
          </header>
          <div class="zone-card-body">
            <div class="zone-card-fields-row">
              ${fieldHtml("Zone", "zone", row.zone, editable)}
              ${fieldHtml("Assigned to / Owner", "assignedTo", row.assignedTo, editable)}
            </div>
            ${fieldHtml("Status", "status", row.status, editable, "select-status")}
            ${fieldHtml("Remarks", "remarks", row.remarks, editable, "textarea")}
          </div>
        </article>`;
      })
      .join("");

    if (editable) {
      zoneCards.querySelectorAll(".zone-input").forEach((el) => {
        el.addEventListener("input", () => {
          const card = el.closest(".zone-card");
          const idx = Number(card.dataset.index);
          const field = el.dataset.field;
          state.rows[idx][field] = el.value;
          if (field === "status") {
            const kind = statusKind(el.value);
            card.className = `zone-card is-${kind} ${matchesFilter(state.rows[idx]) ? "" : "is-hidden"}`;
            const badge = card.querySelector(".zone-card-badge");
            badge.className = `zone-card-badge zone-card-badge--${kind}`;
            badge.textContent = badgeLabel(el.value);
          }
          markDirty();
        });
        el.addEventListener("change", () => markDirty());
      });
    }
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

  function exportExcel() {
    if (typeof XLSX === "undefined") {
      alert("Excel library failed to load.");
      return;
    }
    syncFromDom();
    const aoa = [[ZONE_META.title], [ZONE_META.subtitle], [], ZONE_COLUMNS.map((c) => c.label)];
    state.rows.forEach((row) => {
      aoa.push(ZONE_COLUMNS.map((c) => row[c.key] ?? ""));
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Zone Checklist");
    XLSX.writeFile(wb, "Zone-48hr-checklist.xlsx");
  }

  function resetChecklist() {
    if (!state.isAdmin || !confirm("Reset all zone checklist items to original?")) return;
    state.rows = structuredClone(ZONE_SEED_ROWS);
    saveToStorage();
    renderCards();
  }

  function addRow() {
    if (!state.isAdmin) return;
    state.rows.push({
      sno: state.rows.length + 1,
      task: "New checklist item — describe action required",
      zone: "ALL ZONES",
      assignedTo: "",
      status: "Pending",
      remarks: "",
    });
    state.dirty = true;
    saveToStorage();
    renderCards();
    zoneCards.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const user = document.querySelector("#username").value.trim();
    const pass = document.querySelector("#password").value;
    if (user === ADMIN_DEFAULT.username && pass === ADMIN_DEFAULT.password) {
      setAuth("admin");
      hideLogin();
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

  zoneFilter.addEventListener("change", () => {
    state.filterZone = zoneFilter.value;
    renderCards();
  });

  loadFromStorage();
  if (sessionStorage.getItem(AUTH_KEY) === "admin") state.isAdmin = true;
  updateRoleUI();
  renderCards();
  hideLogin();

  window.addEventListener("beforeunload", flushSave);
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSave();
  });
})();
