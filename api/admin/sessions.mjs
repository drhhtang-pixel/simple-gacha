import { db, json, fail, readJson, text, isoDate, makeCode, teacherOnly, intParam } from '../_lib.mjs';

const COLUMNS = `s.id, s.title, to_char(s.course_date, 'YYYY-MM-DD') as course_date, s.class_code, s.is_open`;

export const GET = teacherOnly(async () => {
  const rows = await db().unsafe(`
    select ${COLUMNS}, count(sub.id)::int as count
    from sessions s left join submissions sub on sub.session_id = s.id
    group by s.id order by s.course_date desc, s.id desc`);
  return json(200, { sessions: rows });
});

// Class codes are unique; a clash just means drawing another one.
async function withFreshCode(run) {
  for (let i = 0; i < 5; i++) {
    try {
      return await run(makeCode());
    } catch (e) {
      if (e?.code !== '23505') throw e;
    }
  }
  throw new Error('could not generate a unique class code');
}

export const POST = teacherOnly(async request => {
  const body = await readJson(request);
  const courseDate = isoDate(body.courseDate);
  const title = text(body.title, 60);
  if (!courseDate) return fail(400, '請選擇課程日期');
  if (!title) return fail(400, '請輸入課程名稱（60 字以內）');
  const [row] = await withFreshCode(code => db()`
    insert into sessions (course_date, title, class_code) values (${courseDate}, ${title}, ${code})
    returning id, title, to_char(course_date, 'YYYY-MM-DD') as course_date, class_code, is_open`);
  return json(201, { session: { ...row, count: 0 } });
});

export const PATCH = teacherOnly(async request => {
  const id = intParam(request, 'id');
  if (!id) return fail(400, '缺少課程 id');
  const body = await readJson(request);
  const sql = db();
  const [current] = await sql`select id from sessions where id = ${id}`;
  if (!current) return fail(404, '找不到這堂課');

  if (typeof body.isOpen === 'boolean') await sql`update sessions set is_open = ${body.isOpen} where id = ${id}`;
  if (body.title !== undefined) {
    const title = text(body.title, 60);
    if (!title) return fail(400, '請輸入課程名稱（60 字以內）');
    await sql`update sessions set title = ${title} where id = ${id}`;
  }
  if (body.courseDate !== undefined) {
    const courseDate = isoDate(body.courseDate);
    if (!courseDate) return fail(400, '請選擇課程日期');
    await sql`update sessions set course_date = ${courseDate} where id = ${id}`;
  }
  if (body.newCode === true) await withFreshCode(code => sql`update sessions set class_code = ${code} where id = ${id}`);

  const [row] = await sql.unsafe(`select ${COLUMNS} from sessions s where s.id = $1`, [id]);
  return json(200, { session: row });
});

export const DELETE = teacherOnly(async request => {
  const id = intParam(request, 'id');
  if (!id) return fail(400, '缺少課程 id');
  await db()`delete from sessions where id = ${id}`;
  return json(200, { ok: true });
});
