(function (root) {
  'use strict';

  // Fetches a sign-up session's roster as setup-table rows ({ name, group }).
  // Needs the teacher to be logged in on /admin; rejects with a message otherwise.
  async function loadCloudRoster(sessionId) {
    const res = await fetch(`/api/admin/submissions?id=${encodeURIComponent(sessionId)}`);
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('要先到「教師管理」登入才能載入雲端名單');
    if (!res.ok) throw new Error(body.error || '載入雲端名單失敗');
    return {
      label: `${body.session.course_date} ${body.session.title}`,
      rows: body.rows.map(r => ({ name: r.name, group: String(r.group_no) })),
    };
  }

  root.DrawLots = Object.assign(root.DrawLots || {}, { loadCloudRoster });
})(typeof globalThis !== 'undefined' ? globalThis : this);
