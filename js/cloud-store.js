/** Load / save department planning data for all users (Supabase). */
const FasalCloud = (function () {
  const TABLE = "fasal_planning_data";
  const ROW_ID = "departments";
  let client = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase?.createClient) return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return client;
  }

  async function loadDepartments() {
    const sb = getClient();
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from(TABLE)
        .select("payload, updated_at")
        .eq("id", ROW_ID)
        .maybeSingle();
      if (error || !data?.payload) return null;
      const p = data.payload;
      if (p.departments?.length) {
        return {
          departments: p.departments,
          updatedAt: p.updatedAt || new Date(data.updated_at).getTime(),
        };
      }
    } catch (_) {
      /* offline */
    }
    return null;
  }

  async function saveDepartments(departments, adminPassword) {
    const sb = getClient();
    if (!sb) return { ok: false, error: "Cloud not available" };
    const payload = { departments, updatedAt: Date.now() };
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/fasal-save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          id: ROW_ID,
          payload,
          password: adminPassword,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: body.error || res.statusText };
      }
      return { ok: true, updatedAt: payload.updatedAt };
    } catch (e) {
      return { ok: false, error: e.message || "Network error" };
    }
  }

  return { loadDepartments, saveDepartments };
})();
