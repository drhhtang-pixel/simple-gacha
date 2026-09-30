(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const form = $('join-form');
  const REMEMBER = 'mysimplegacha.join';

  function say(text, cls) {
    const li = document.createElement('li');
    li.textContent = text;
    if (cls) li.className = cls;
    $('messages').replaceChildren(li);
  }

  // Pre-fill the code from a shared link and the student's own details from last time.
  const code = new URLSearchParams(location.search).get('code');
  if (code) $('code').value = code.toUpperCase();
  try {
    const saved = JSON.parse(localStorage.getItem(REMEMBER));
    if (saved) { $('student-id').value = saved.studentId || ''; $('name').value = saved.name || ''; }
  } catch { /* storage unavailable */ }
  (code ? $('student-id') : $('code')).focus();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    $('submit').disabled = true;
    say('送出中…');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        say(body.error || (res.status === 429 ? '太多次嘗試，請稍後再試' : '送出失敗，請再試一次'), 'error');
        return;
      }
      try { localStorage.setItem(REMEMBER, JSON.stringify({ studentId: body.studentId, name: body.name })); } catch { /* ignore */ }
      say(`${body.updated ? '已更新' : '已登記'}：${body.name}（${body.studentId}）第 ${body.group} 組 · ${body.courseDate} ${body.title}`, 'ok');
    } catch {
      say('連線失敗，請檢查網路後再試', 'error');
    } finally {
      $('submit').disabled = false;
    }
  });
})();
