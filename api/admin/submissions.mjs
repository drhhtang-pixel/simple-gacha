import { db, json, fail, readJson, text, groupNo, normStudentId, teacherOnly, intParam } from '../_lib.mjs';

// Quotes a CSV cell and defuses values Excel would run as a formula.
function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET = teacherOnly(async request => {
  const id = intParam(request, 'id');
  if (!id) return fail(400, '缺少課程 id');
  const sql = db();
  const [session] = await sql`
    select id, title, to_char(course_date, 'YYYY-MM-DD') as course_date, class_code, is_open
    from sessions where id = ${id}`;
  if (!session) return fail(404, '找不到這堂課');
  const rows = await sql`
    select id, student_id, name, group_no, to_char(updated_at at time zone 'Asia/Taipei', 'YYYY-MM-DD HH24:MI') as updated_at
    from submissions where session_id = ${id} order by group_no, student_id`;

  if (new URL(request.url).searchParams.get('format') === 'csv') {
    const lines = [['課程日期', '課程', '學號', '姓名', '組別', '最後更新']]
      .concat(rows.map(r => [session.course_date, session.title, r.student_id, r.name, r.group_no, r.updated_at]))
      .map(cells => cells.map(csvCell).join(','));
    const filename = encodeURIComponent(`${session.course_date}-${session.title}-分組.csv`);
    return new Response('﻿' + lines.join('\r\n') + '\r\n', {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename*=UTF-8''${filename}`,
        'cache-control': 'no-store',
      },
    });
  }
  return json(200, { session, rows });
});

export const PATCH = teacherOnly(async request => {
  const rowId = intParam(request, 'rowId');
  if (!rowId) return fail(400, '缺少資料 id');
  const body = await readJson(request);
  const studentId = normStudentId(body.studentId);
  const name = text(body.name, 30);
  const group = groupNo(body.group);
  if (!studentId || !name || !group) return fail(400, '學號、姓名、組別（1–99）都要填');
  try {
    const [row] = await db()`
      update submissions set student_id = ${studentId}, name = ${name}, group_no = ${group}, updated_at = now()
      where id = ${rowId} returning id`;
    return row ? json(200, { ok: true }) : fail(404, '找不到這筆資料');
  } catch (e) {
    if (e?.code === '23505') return fail(409, '這個學號在這堂課已經登記過');
    throw e;
  }
});

export const DELETE = teacherOnly(async request => {
  const rowId = intParam(request, 'rowId');
  if (!rowId) return fail(400, '缺少資料 id');
  await db()`delete from submissions where id = ${rowId}`;
  return json(200, { ok: true });
});
