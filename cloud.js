// Хмарна синхронізація через Supabase.
// Працює поверх localStorage: локальні дані лишаються кешем,
// а хмара — джерелом правди між пристроями.
window.Cloud = (() => {
  'use strict';

  const CFG = window.CLOUD || {};
  const TABLE = 'tracker_state';
  const listeners = new Set();

  let sb = null;            // клієнт Supabase
  let user = null;          // поточний користувач
  let status = 'off';       // off | loading | ready | syncing | error | signed-out
  let message = '';
  let pushTimer = null;
  let lastPulledAt = 0;

  const enabled = () => !!(CFG.url && CFG.anonKey);
  const emit = () => listeners.forEach(fn => fn(state()));
  const state = () => ({ enabled: enabled(), status, message, email: user ? user.email : '' });
  const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  const set = (s, m = '') => { status = s; message = m; emit(); };

  async function init(applyRemote) {
    if (!enabled()) { set('off'); return state(); }
    set('loading');
    try {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      sb = createClient(CFG.url, CFG.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });

      sb.auth.onAuthStateChange(async (_event, session) => {
        user = session ? session.user : null;
        if (user) await pull(applyRemote);
        else set('signed-out');
      });

      const { data } = await sb.auth.getSession();
      user = data.session ? data.session.user : null;
      if (user) await pull(applyRemote);
      else set('signed-out');

      // прибрати токени з адреси після переходу за посиланням з пошти
      if (location.hash.includes('access_token')) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    } catch (e) {
      set('error', 'Не вдалося підключитися до хмари');
    }
    return state();
  }

  async function signIn(email) {
    if (!sb) return { ok: false, error: 'Хмара не налаштована' };
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  // Вхід за кодом із листа — для застосунку на головному екрані iPhone,
  // де посилання з пошти відкривається в Safari, а не в самому застосунку.
  async function verifyCode(email, code) {
    if (!sb) return { ok: false, error: 'Хмара не налаштована' };
    const { error } = await sb.auth.verifyOtp({ email, token: String(code).trim(), type: 'email' });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function signOut() {
    if (sb) await sb.auth.signOut();
    user = null;
    set('signed-out');
  }

  // Завантажити з хмари. Якщо там порожньо — віддаємо null,
  // щоб застосунок запропонував залити локальні дані.
  async function pull(applyRemote) {
    if (!sb || !user) return null;
    set('syncing', 'Завантаження…');
    const { data, error } = await sb
      .from(TABLE).select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) { set('error', 'Помилка читання з хмари'); return null; }
    lastPulledAt = data ? +new Date(data.updated_at) : 0;
    if (data && applyRemote) applyRemote(data.data);
    set('ready', data ? 'Синхронізовано' : 'Хмара порожня — дані завантажаться при першій зміні');
    return data ? data.data : null;
  }

  // Відкласти запис: під час тренування зміни йдуть щосекунди,
  // тож зберігаємо пачкою через 1.5 с після останньої правки.
  function push(getData) {
    if (!sb || !user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => flush(getData), 1500);
  }

  async function flush(getData) {
    if (!sb || !user) return;
    set('syncing', 'Збереження…');
    const payload = { user_id: user.id, data: getData(), updated_at: new Date().toISOString() };
    const { error } = await sb.from(TABLE).upsert(payload, { onConflict: 'user_id' });
    if (error) set('error', 'Не вдалося зберегти в хмару');
    else { lastPulledAt = Date.now(); set('ready', 'Синхронізовано'); }
  }

  // ---- Фото прогресу (приватне сховище Supabase) ----
  const BUCKET = 'progress';
  const urlCache = new Map();

  async function uploadPhoto(blob) {
    if (!sb || !user) return { ok: false, error: 'Спершу увійди в хмару' };
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    return error ? { ok: false, error: error.message } : { ok: true, path };
  }

  async function photoUrl(path) {
    if (!sb || !user || !path) return null;
    const hit = urlCache.get(path);
    if (hit && hit.until > Date.now()) return hit.url;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data) return null;
    urlCache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
    return data.signedUrl;
  }

  async function removePhoto(path) {
    if (!sb || !user || !path) return;
    urlCache.delete(path);
    await sb.storage.from(BUCKET).remove([path]);
  }

  return {
    init, signIn, verifyCode, signOut, pull, push, flush, onChange, state, enabled,
    uploadPhoto, photoUrl, removePhoto,
    get user() { return user; },
  };
})();
