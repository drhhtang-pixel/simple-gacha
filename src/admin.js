(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = { sessions: [], current: null };

  function el(tag, text, className) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (className) e.className = className;
    return e;
  }

  function say(text, cls) {
    const li = el('li', text, cls);
    $('messages').replaceChildren(li);
    if (cls !== 'error') setTimeout(() => li.remove(), 4000);
  }

  // Calls the API; a 401 sends the teacher back to the login form.
  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: options.body ? { 'content-type': 'application/json' } : {},
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/api/admin/login') showLogin();
    if (!res.ok && !body.error && (res.status === 429 || res.headers.get('x-vercel-mitigated'))) {
      throw new Error('操作太頻繁，請等一分鐘再試');
    }
    if (!res.ok) throw new Error(body.error || `發生錯誤（${res.status}）`);
    return body;
  }

  function confirmBox(text) {
    return new Promise(resolve => {
      const dlg = $('confirm');
      $('confirm-text').textContent = text;
      const done = ok => { dlg.close(); $('confirm-yes').onclick = $('confirm-no').onclick = null; resolve(ok); };
      $('confirm-yes').onclick = () => done(true);
      $('confirm-no').onclick = () => done(false);
      dlg.showModal();
    });
  }

  function showLogin() {
    $('loading').hidden = true;
    $('admin').hidden = true;
    $('logout').hidden = true;
    $('login-form').hidden = false;
    $('password').focus();
  }

  async function showAdmin() {
    $('loading').hidden = true;
    $('login-form').hidden = true;
    $('admin').hidden = false;
    $('logout').hidden = false;
    await loadSessions();
  }

  async function loadSessions() {
    const { sessions } = await api('/api/admin/sessions');
    state.sessions = sessions;
    renderSessions();
    if (state.current) {
      const still = sessions.find(s => s.id === state.current.id);
      if (still) await openSession(still.id); else $('detail').hidden = true;
    }
  }

  function renderSessions() {
    const body = $('sessions-body');
    body.replaceChildren();
    if (state.sessions.length === 0) {
      const td = el('td', '還沒有課程，先在上方建立一堂。');
      td.colSpan = 6;
      const tr = el('tr');
      tr.append(td);
      body.append(tr);
      return;
    }
    for (const s of state.sessions) {
      const tr = el('tr');
      if (state.current && state.current.id === s.id) tr.className = 'selected';
      const open = el('button', '查看', 'small');
      open.type = 'button';
      open.onclick = () => openSession(s.id);
      tr.append(el('td', s.course_date), el('td', s.title), el('td', s.class_code, 'code'),
        el('td', String(s.count)), el('td', s.is_open ? '開放中' : '已截止', s.is_open ? 'open' : 'closed'));
      const actionTd = el('td');
      actionTd.append(open);
      tr.append(actionTd);
      body.append(tr);
    }
  }

  function joinUrl(code) {
    return `${location.origin}/join?code=${encodeURIComponent(code)}`;
  }

  async function openSession(id) {
    const { session, rows } = await api(`/api/admin/submissions?id=${id}`);
    state.current = session;
    // The list was fetched earlier; bring this session's count up to date with what just loaded.
    const listed = state.sessions.find(s => s.id === session.id);
    if (listed) Object.assign(listed, session, { count: rows.length });
    renderSessions();
    $('detail').hidden = false;
    $('detail-title').textContent = `${session.course_date} ${session.title}`;
    $('detail-code').textContent = session.class_code;
    const url = joinUrl(session.class_code);
    $('join-link').href = url;
    $('join-link').textContent = url;
    if (window.QRious) new window.QRious({ element: $('qr'), value: url, size: 360, background: '#f4f4f4', foreground: '#1a1c2c' });
    $('csv').href = `/api/admin/submissions?id=${id}&format=csv`;
    $('toggle-open').textContent = session.is_open ? '🔒 截止登記' : '🔓 重新開放';
    renderRows(rows);
  }

  function rowInput(value, cls, attrs = {}) {
    const i = el('input', undefined, cls);
    i.value = value;
    Object.assign(i, attrs);
    return i;
  }

  function renderRows(rows) {
    const body = $('rows-body');
    body.replaceChildren();
    $('rows-empty').hidden = rows.length > 0;
    for (const r of rows) {
      const tr = el('tr');
      const sid = rowInput(r.student_id, 'c-sid', { maxLength: 20, ariaLabel: '學號' });
      const name = rowInput(r.name, 'c-name', { maxLength: 30, ariaLabel: '姓名' });
      const group = rowInput(String(r.group_no), 'c-num', { inputMode: 'numeric', ariaLabel: '組別' });
      const save = async () => {
        try {
          await api(`/api/admin/submissions?rowId=${r.id}`, {
            method: 'PATCH', body: { studentId: sid.value, name: name.value, group: group.value },
          });
          say(`已更新 ${name.value}`, 'ok');
        } catch (e) {
          say(e.message, 'error');
        }
      };
      for (const i of [sid, name, group]) i.addEventListener('change', save);
      const del = el('button', '✕', 'row-del');
      del.type = 'button';
      del.setAttribute('aria-label', `刪除 ${r.name}`);
      del.onclick = async () => {
        if (!(await confirmBox(`刪除 ${r.name}（${r.student_id}）的登記？`))) return;
        await api(`/api/admin/submissions?rowId=${r.id}`, { method: 'DELETE' });
        await loadSessions();
      };
      const cells = [sid, name, group].map(i => { const td = el('td'); td.append(i); return td; });
      cells[2].className = 'num';
      const delTd = el('td', undefined, 'del');
      delTd.append(del);
      tr.append(...cells, el('td', r.updated_at, 'muted'), delTd);
      body.append(tr);
    }
  }

  // Runs an action and reports its error instead of letting it vanish.
  const guard = fn => async e => {
    try { await fn(e); } catch (err) { say(err.message, 'error'); }
  };

  $('login-form').addEventListener('submit', guard(async e => {
    e.preventDefault();
    await api('/api/admin/login', { method: 'POST', body: { password: $('password').value } });
    $('password').value = '';
    await showAdmin();
  }));

  $('logout').onclick = guard(async () => {
    await api('/api/admin/login', { method: 'DELETE' });
    state.current = null;
    showLogin();
  });

  $('new-session').addEventListener('submit', guard(async e => {
    e.preventDefault();
    const { session } = await api('/api/admin/sessions', {
      method: 'POST', body: { courseDate: $('new-date').value, title: $('new-title').value },
    });
    $('new-title').value = '';
    state.current = session;
    await loadSessions();
    say(`已建立，班級代碼 ${session.class_code}`, 'ok');
  }));

  const patchCurrent = body => api(`/api/admin/sessions?id=${state.current.id}`, { method: 'PATCH', body });

  $('toggle-open').onclick = guard(async () => {
    await patchCurrent({ isOpen: !state.current.is_open });
    await loadSessions();
  });

  $('new-code').onclick = guard(async () => {
    if (!(await confirmBox('換新代碼後，舊的代碼和 QR code 就不能用了。確定？'))) return;
    await patchCurrent({ newCode: true });
    await loadSessions();
  });

  $('delete-session').onclick = guard(async () => {
    const s = state.current;
    if (!(await confirmBox(`刪除「${s.course_date} ${s.title}」和所有學生登記？這無法復原。`))) return;
    await api(`/api/admin/sessions?id=${s.id}`, { method: 'DELETE' });
    state.current = null;
    $('detail').hidden = true;
    await loadSessions();
  });

  $('use-in-gacha').onclick = () => { location.href = `/?session=${state.current.id}`; };

  $('new-date').value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  guard(async () => {
    const { loggedIn } = await api('/api/admin/login');
    if (loggedIn) await showAdmin(); else showLogin();
  })();
})();
