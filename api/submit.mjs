import { db, ensureSchema, json, fail, readJson, text, groupNo, normCode, normStudentId } from './_lib.mjs';

// A student signs up (or updates) their group for the session the class code belongs to.
export async function POST(request) {
  const body = await readJson(request);
  const code = normCode(body.code);
  const studentId = normStudentId(body.studentId);
  const name = text(body.name, 30);
  const group = groupNo(body.group);
  if (!code) return fail(400, '請輸入班級代碼');
  if (!studentId) return fail(400, '請輸入學號（20 字以內）');
  if (!name) return fail(400, '請輸入姓名（30 字以內）');
  if (!group) return fail(400, '組別請填 1–99 的數字');

  await ensureSchema();
  const sql = db();
  const [session] = await sql`
    select id, title, to_char(course_date, 'YYYY-MM-DD') as course_date, is_open
    from sessions where class_code = ${code}`;
  if (!session) return fail(403, '班級代碼不正確');
  if (!session.is_open) return fail(423, '這堂課的登記已經截止');

  const [row] = await sql`
    insert into submissions (session_id, student_id, name, group_no)
    values (${session.id}, ${studentId}, ${name}, ${group})
    on conflict (session_id, student_id)
    do update set name = excluded.name, group_no = excluded.group_no, updated_at = now()
    returning (xmax = 0) as inserted`;

  return json(200, {
    ok: true,
    updated: !row.inserted,
    title: session.title,
    courseDate: session.course_date,
    studentId, name, group,
  });
}
