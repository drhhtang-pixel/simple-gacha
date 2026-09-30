import { json, fail, readJson, checkPassword, loginCookie, logoutCookie, isTeacher } from '../_lib.mjs';

export function GET(request) {
  return json(200, { loggedIn: isTeacher(request) });
}

export async function POST(request) {
  const { password } = await readJson(request);
  if (!checkPassword(password)) return fail(401, '密碼不正確');
  return json(200, { ok: true }, { 'set-cookie': loginCookie() });
}

export function DELETE() {
  return json(200, { ok: true }, { 'set-cookie': logoutCookie() });
}
