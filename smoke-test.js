/**
 * EduPlatform API — Комплексні тести
 * Стек: Node.js (fetch, вбудований в Node 18+)
 *
 * Запуск:
 *   BASE_URL=http://localhost:3000 node api-tests.js
 *
 * За замовчуванням BASE_URL = http://localhost:3000
 * Очікуваний вивід: кожен тест ✅ PASS або ❌ FAIL з деталями
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API = `${BASE_URL}/api/v1`;

// ─── Утиліти ──────────────────────────────────────────────────────────────────

const colors = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

const results = { pass: 0, fail: 0, skip: 0 };

function log(msg) { console.log(msg); }
function section(title) { log(`\n${colors.bold(colors.cyan(`── ${title} ──`))}`); }

async function test(name, fn) {
  try {
    await fn();
    results.pass++;
    log(colors.green(`  ✅ ${name}`));
  } catch (err) {
    results.fail++;
    log(colors.red(`  ❌ ${name}`));
    log(colors.dim(`     ${err.message}`));
  }
}

function skip(name, reason) {
  results.skip++;
  log(colors.yellow(`  ⏭  ${name} — ${reason}`));
}

// Виконати fetch і повернути { status, body, cookies }
async function req(method, path, { body, cookies, headers = {} } = {}) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    // Важливо для httpOnly cookies при тестуванні між тим самим доменом:
    // credentials не підтримується в Node fetch, тому передаємо Cookie вручну
  };
  if (cookies) opts.headers['Cookie'] = cookies;
  if (body)    opts.body = JSON.stringify(body);

  const res = await fetch(`${API}${path}`, opts);
  const setCookies = res.headers.get('set-cookie') || '';
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json, rawCookies: setCookies };
}

// Витягти значення cookie за назвою з рядка set-cookie
function extractCookie(cookieStr, name) {
  const match = cookieStr.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

// Зібрати Cookie-заголовок з кількох set-cookie рядків
function buildCookieHeader(rawCookies, ...names) {
  return names
    .map(n => { const v = extractCookie(rawCookies, n); return v ? `${n}=${v}` : null; })
    .filter(Boolean)
    .join('; ');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── Дані для тестів ──────────────────────────────────────────────────────────

const ts = Date.now();

const STUDENT = {
  name: 'Test',
  surname: 'Student',
  email: `student_${ts}@test.com`,
  password: 'StrongPass123!',
  role: 'student',
};

const TEACHER = {
  name: 'Test',
  surname: 'Teacher',
  email: `teacher_${ts}@test.com`,
  password: 'StrongPass123!',
  role: 'teacher',
};

// Стан, що накопичується між тестами
const ctx = {
  studentCookies:  '',
  teacherCookies:  '',
  adminCookies:    '',   // потрібен вже існуючий admin-акаунт
  studentId:       null,
  teacherId:       null,
  courseId:        null,
  lessonId:        null,
  testId:          null,
};

// ─── ТЕСТИ ────────────────────────────────────────────────────────────────────

async function runAll() {
  log(colors.bold(`\nEduPlatform API Tests — ${BASE_URL}\n`));

  // ── 0. Health ──────────────────────────────────────────────────────────────
  section('Health Check');

  await test('GET /api/health → 200', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.status === 'ok' || body.success === true || res.status === 200,
      'Health endpoint повинен повертати ok-статус');
  });

  // ── 1. Auth ────────────────────────────────────────────────────────────────
  section('Auth — реєстрація');

  await test('POST /auth/register — реєстрація студента', async () => {
    const r = await req('POST', '/auth/register', { body: STUDENT });
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.success === true, 'success має бути true');
    ctx.studentId = r.body?.data?.user?.id || r.body?.data?.id;
  });

  await test('POST /auth/register — реєстрація вчителя', async () => {
    const r = await req('POST', '/auth/register', { body: TEACHER });
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    ctx.teacherId = r.body?.data?.user?.id || r.body?.data?.id;
  });

  await test('POST /auth/register — заборона ролі admin', async () => {
    const r = await req('POST', '/auth/register', {
      body: { ...STUDENT, email: `admin_try_${ts}@test.com`, role: 'admin' },
    });
    assert(r.status === 400 || r.status === 422 || r.status === 403,
      `Admin-роль не повинна бути дозволена, але отримали ${r.status}`);
  });

  await test('POST /auth/register — дублікат email → 409', async () => {
    const r = await req('POST', '/auth/register', { body: STUDENT });
    assert(r.status === 409, `Expected 409, got ${r.status}`);
  });

  await test('POST /auth/register — невалідні дані (без email) → 422', async () => {
    const r = await req('POST', '/auth/register', {
      body: { name: 'A', surname: 'B', password: '123' },
    });
    assert(r.status === 400 || r.status === 422,
      `Expected 400/422, got ${r.status}`);
  });

  section('Auth — логін');

  await test('POST /auth/login — студент', async () => {
    const r = await req('POST', '/auth/login', {
      body: { email: STUDENT.email, password: STUDENT.password },
    });
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    assert(r.body?.success === true, 'success має бути true');
    ctx.studentCookies = buildCookieHeader(r.rawCookies, 'accessToken', 'refreshToken');
    assert(ctx.studentCookies.includes('accessToken'), 'accessToken cookie відсутній');
  });

  await test('POST /auth/login — вчитель', async () => {
    const r = await req('POST', '/auth/login', {
      body: { email: TEACHER.email, password: TEACHER.password },
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    ctx.teacherCookies = buildCookieHeader(r.rawCookies, 'accessToken', 'refreshToken');
    assert(ctx.teacherCookies.includes('accessToken'), 'accessToken cookie відсутній');
  });

  await test('POST /auth/login — невірний пароль → 401', async () => {
    const r = await req('POST', '/auth/login', {
      body: { email: STUDENT.email, password: 'WrongPassword!' },
    });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('POST /auth/login — неіснуючий email → 401', async () => {
    const r = await req('POST', '/auth/login', {
      body: { email: `nobody_${ts}@nowhere.com`, password: 'Pass123!' },
    });
    assert(r.status === 401 || r.status === 404, `Expected 401/404, got ${r.status}`);
  });

  section('Auth — refresh / logout');

  await test('POST /auth/refresh — оновлення токенів', async () => {
    const r = await req('POST', '/auth/refresh', { cookies: ctx.studentCookies });
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    // Оновлюємо cookies новими токенами
    const newCookies = buildCookieHeader(r.rawCookies, 'accessToken', 'refreshToken');
    if (newCookies.includes('accessToken')) ctx.studentCookies = newCookies;
  });

  await test('POST /auth/refresh — без токену → 401', async () => {
    const r = await req('POST', '/auth/refresh');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  // ── 2. Courses ─────────────────────────────────────────────────────────────
  section('Courses — публічний каталог');

  await test('GET /courses — публічний, без авторизації', async () => {
    const r = await req('GET', '/courses');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.success === true, 'success має бути true');
    assert(Array.isArray(r.body?.data?.courses ?? r.body?.data),
      'data повинна містити масив курсів');
  });

  await test('GET /courses?q=java — пошук (≥3 символи)', async () => {
    const r = await req('GET', '/courses?q=java');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('GET /courses?q=ab — занадто короткий запит → 400 або порожній результат', async () => {
    const r = await req('GET', '/courses?q=ab');
    // Залежно від реалізації: або 400, або 200 з порожнім масивом
    assert(r.status === 400 || r.status === 200, `Got ${r.status}`);
  });

  await test('GET /courses?sortBy=newest&page=1&limit=5', async () => {
    const r = await req('GET', '/courses?sortBy=newest&page=1&limit=5');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('GET /courses?price=free', async () => {
    const r = await req('GET', '/courses?price=free');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  section('Courses — CRUD (teacher)');

  await test('POST /courses — вчитель створює курс', async () => {
    const r = await req('POST', '/courses', {
      cookies: ctx.teacherCookies,
      body: {
        title: `Test Course ${ts}`,
        description: 'Автоматичний тест',
        price: 0,
      },
    });
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    ctx.courseId = r.body?.data?.course?.id || r.body?.data?.id;
    assert(ctx.courseId, 'courseId відсутній у відповіді');
  });

  await test('POST /courses — студент не може створити курс → 403', async () => {
    const r = await req('POST', '/courses', {
      cookies: ctx.studentCookies,
      body: { title: 'Student Course', price: 0 },
    });
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  await test('POST /courses — без авторизації → 401', async () => {
    const r = await req('POST', '/courses', { body: { title: 'Anon Course' } });
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('GET /courses/:id — деталі опублікованого/draft курсу власником', async () => {
    const r = await req('GET', `/courses/${ctx.courseId}`, { cookies: ctx.teacherCookies });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.data?.course?.id === ctx.courseId ||
           r.body?.data?.id === ctx.courseId, 'ID курсу не співпадає');
  });

  await test('GET /courses/:id (draft) — анонімний → 404', async () => {
    const r = await req('GET', `/courses/${ctx.courseId}`);
    assert(r.status === 404, `Draft-курс не повинен бути видимим, got ${r.status}`);
  });

  await test('PATCH /courses/:id — вчитель редагує власний курс', async () => {
    const r = await req('PATCH', `/courses/${ctx.courseId}`, {
      cookies: ctx.teacherCookies,
      body: { description: 'Оновлений опис' },
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('PATCH /courses/:id — студент не може редагувати → 403', async () => {
    const r = await req('PATCH', `/courses/${ctx.courseId}`, {
      cookies: ctx.studentCookies,
      body: { description: 'Злом' },
    });
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  await test('PATCH /courses/:id/publish — публікація курсу', async () => {
    const r = await req('PATCH', `/courses/${ctx.courseId}/publish`, {
      cookies: ctx.teacherCookies,
    });
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('GET /courses/:id (published) — публічний доступ', async () => {
    const r = await req('GET', `/courses/${ctx.courseId}`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('PATCH /courses/:id/unpublish — зняття з публікації', async () => {
    const r = await req('PATCH', `/courses/${ctx.courseId}/unpublish`, {
      cookies: ctx.teacherCookies,
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // Повторна публікація для подальших тестів
  await req('PATCH', `/courses/${ctx.courseId}/publish`, { cookies: ctx.teacherCookies });

  await test('GET /courses/my — вчитель бачить свої курси (включно з draft)', async () => {
    const r = await req('GET', '/courses/my', { cookies: ctx.teacherCookies });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const list = r.body?.data?.courses ?? r.body?.data ?? [];
    assert(Array.isArray(list), 'Очікувався масив');
  });

  await test('GET /courses/my — студент → 403', async () => {
    const r = await req('GET', '/courses/my', { cookies: ctx.studentCookies });
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  section('Courses — enroll (student)');

  await test('POST /courses/:id/enroll — студент записується на безкоштовний курс', async () => {
    const r = await req('POST', `/courses/${ctx.courseId}/enroll`, {
      cookies: ctx.studentCookies,
    });
    assert(r.status === 200 || r.status === 201,
      `Expected 200/201, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('POST /courses/:id/enroll — повторний запис → 409', async () => {
    const r = await req('POST', `/courses/${ctx.courseId}/enroll`, {
      cookies: ctx.studentCookies,
    });
    assert(r.status === 409, `Expected 409 ALREADY_ENROLLED, got ${r.status}`);
  });

  await test('POST /courses/:id/enroll — вчитель не може записатись → 403', async () => {
    const r = await req('POST', `/courses/${ctx.courseId}/enroll`, {
      cookies: ctx.teacherCookies,
    });
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  // ── 3. Lessons ─────────────────────────────────────────────────────────────
  section('Lessons');

  await test('POST /lessons/course/:courseId — вчитель створює урок', async () => {
    const r = await req('POST', `/lessons/course/${ctx.courseId}`, {
      cookies: ctx.teacherCookies,
      body: {
        title: 'Урок 1 — вступ',
        type: 'text',
        content: 'Текст першого уроку для автотесту.',
        order: 1,
      },
    });
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    ctx.lessonId = r.body?.data?.lesson?.id || r.body?.data?.id;
    assert(ctx.lessonId, 'lessonId відсутній у відповіді');
  });

  await test('POST /lessons/course/:courseId — студент не може → 403', async () => {
    const r = await req('POST', `/lessons/course/${ctx.courseId}`, {
      cookies: ctx.studentCookies,
      body: { title: 'Підроблений урок', type: 'text' },
    });
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  await test('GET /lessons/course/:courseId — записаний студент бачить список', async () => {
    const r = await req('GET', `/lessons/course/${ctx.courseId}`, {
      cookies: ctx.studentCookies,
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const lessons = r.body?.data?.lessons ?? r.body?.data ?? [];
    assert(Array.isArray(lessons), 'Очікувався масив уроків');
  });

  await test('GET /lessons/course/:courseId — незаписаний студент не бачить → 403', async () => {
    // Реєструємо нового студента без запису на курс
    const email = `novice_${ts}@test.com`;
    await req('POST', '/auth/register', {
      body: { ...STUDENT, email, role: 'student' },
    });
    const lr = await req('POST', '/auth/login', {
      body: { email, password: STUDENT.password },
    });
    const nc = buildCookieHeader(lr.rawCookies, 'accessToken', 'refreshToken');

    const r = await req('GET', `/lessons/course/${ctx.courseId}`, { cookies: nc });
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  await test('GET /lessons/:id — повний урок для записаного студента', async () => {
    const r = await req('GET', `/lessons/${ctx.lessonId}`, {
      cookies: ctx.studentCookies,
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const lesson = r.body?.data?.lesson ?? r.body?.data;
    assert(lesson?.content, 'Повний урок повинен містити content');
  });

  await test('PATCH /lessons/:id — вчитель редагує урок', async () => {
    const r = await req('PATCH', `/lessons/${ctx.lessonId}`, {
      cookies: ctx.teacherCookies,
      body: { title: 'Урок 1 — оновлено' },
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // ── 4. Progress ────────────────────────────────────────────────────────────
  section('Progress');

  await test('POST /progress/lessons/:lessonId — позначити урок пройденим', async () => {
    const r = await req('POST', `/progress/lessons/${ctx.lessonId}`, {
      cookies: ctx.studentCookies,
      body: { completed: true },
    });
    assert(r.status === 200 || r.status === 201,
      `Expected 200/201, got ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test('GET /progress/me — дашборд студента', async () => {
    const r = await req('GET', '/progress/me', { cookies: ctx.studentCookies });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.body?.success === true, 'success має бути true');
  });

  await test('GET /progress/courses/:courseId — прогрес по курсу', async () => {
    const r = await req('GET', `/progress/courses/${ctx.courseId}`, {
      cookies: ctx.studentCookies,
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const d = r.body?.data;
    assert(d !== undefined && d !== null, 'data відсутня');
  });

  await test('POST /progress/lessons/:lessonId — незаписаний → 403', async () => {
    const email = `noprog_${ts}@test.com`;
    await req('POST', '/auth/register', {
      body: { ...STUDENT, email, role: 'student' },
    });
    const lr = await req('POST', '/auth/login', {
      body: { email, password: STUDENT.password },
    });
    const nc = buildCookieHeader(lr.rawCookies, 'accessToken', 'refreshToken');

    const r = await req('POST', `/progress/lessons/${ctx.lessonId}`, {
      cookies: nc,
      body: { completed: true },
    });
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  // ── 5. Tests ───────────────────────────────────────────────────────────────
  section('Tests');

  await test('POST /tests/course/:courseId — вчитель створює тест', async () => {
    const r = await req('POST', `/tests/course/${ctx.courseId}`, {
      cookies: ctx.teacherCookies,
      body: {
        title: 'Фінальний тест',
        passingScore: 70,
        questions: [
          {
            question: 'Скільки байт у кілобайті?',
            options: ['512', '1024', '2048', '256'],
            correctIndex: 1,
          },
          {
            question: 'Що таке HTTP?',
            options: ['Протокол', 'Мова програмування', 'База даних', 'Фреймворк'],
            correctIndex: 0,
          },
        ],
      },
    });
    assert(r.status === 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.body)}`);
    ctx.testId = r.body?.data?.test?.id || r.body?.data?.id;
    assert(ctx.testId, 'testId відсутній у відповіді');
  });

  await test('GET /tests/course/:courseId — студент НЕ бачить correctIndex', async () => {
    const r = await req('GET', `/tests/course/${ctx.courseId}`, {
      cookies: ctx.studentCookies,
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const questions = r.body?.data?.test?.questions ?? r.body?.data?.questions ?? [];
    questions.forEach((q, i) => {
      assert(q.correctIndex === undefined,
        `Питання ${i}: correctIndex не повинен повертатись студенту`);
    });
  });

  await test('GET /tests/course/:courseId — вчитель БАЧИТЬ correctIndex', async () => {
    const r = await req('GET', `/tests/course/${ctx.courseId}`, {
      cookies: ctx.teacherCookies,
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const questions = r.body?.data?.test?.questions ?? r.body?.data?.questions ?? [];
    assert(questions.length > 0, 'Питання відсутні');
    assert(questions[0].correctIndex !== undefined,
      'Вчитель повинен бачити correctIndex');
  });

  await test('POST /tests/:id/submit — студент здає тест', async () => {
    const r = await req('POST', `/tests/${ctx.testId}/submit`, {
      cookies: ctx.studentCookies,
      body: { answers: [1, 0] },  // обидві правильні відповіді
    });
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.body)}`);
    const d = r.body?.data;
    assert(typeof d?.score === 'number', 'score відсутній у відповіді');
    assert(typeof d?.passed === 'boolean', 'passed відсутній у відповіді');
    assert(typeof d?.correctCount === 'number', 'correctCount відсутній');
    assert(d.passed === true, `Очікувалось passed=true, got ${d.passed} (score=${d.score})`);
  });

  await test('POST /tests/course/:courseId — дублікат тесту → 409', async () => {
    const r = await req('POST', `/tests/course/${ctx.courseId}`, {
      cookies: ctx.teacherCookies,
      body: {
        title: 'Другий тест (не повинен бути створений)',
        questions: [{ question: 'Q', options: ['A', 'B'], correctIndex: 0 }],
      },
    });
    assert(r.status === 409 || r.status === 400,
      `Expected 409/400 (один курс — один тест), got ${r.status}`);
  });

  await test('GET /tests/course/:courseId/results — студент отримує результати', async () => {
    const r = await req('GET', `/tests/course/${ctx.courseId}/results`, {
      cookies: ctx.studentCookies,
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  // ── 6. Profiles ────────────────────────────────────────────────────────────
  section('Profiles');

  await test('GET /profiles/me — авторизований отримує власний профіль', async () => {
    const r = await req('GET', '/profiles/me', { cookies: ctx.studentCookies });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const user = r.body?.data?.user ?? r.body?.data;
    assert(user?.email === STUDENT.email, 'Email не співпадає');
    assert(user?.passwordHash === undefined, 'passwordHash НЕ ПОВИНЕН повертатись!');
  });

  await test('GET /profiles/me — без авторизації → 401', async () => {
    const r = await req('GET', '/profiles/me');
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test('PATCH /profiles/me — оновлення профілю', async () => {
    const r = await req('PATCH', '/profiles/me', {
      cookies: ctx.studentCookies,
      body: { bio: 'Автотестовий профіль', phone: '+380991234567' },
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('GET /profiles/:id — публічний профіль', async () => {
    if (!ctx.studentId) return skip('GET /profiles/:id', 'studentId невідомий');
    const r = await req('GET', `/profiles/${ctx.studentId}`);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const data = r.body?.data?.user ?? r.body?.data;
    assert(data?.passwordHash === undefined, 'passwordHash НЕ ПОВИНЕН бути публічним!');
  });

  // ── 7. Analytics ───────────────────────────────────────────────────────────
  section('Analytics (teacher only)');

  await test('GET /analytics/dashboard — вчитель отримує дашборд', async () => {
    const r = await req('GET', '/analytics/dashboard', { cookies: ctx.teacherCookies });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const d = r.body?.data;
    assert(d !== undefined, 'data відсутня');
  });

  await test('GET /analytics/dashboard — студент → 403', async () => {
    const r = await req('GET', '/analytics/dashboard', { cookies: ctx.studentCookies });
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  await test('GET /analytics/courses/:courseId — аналітика по курсу', async () => {
    const r = await req('GET', `/analytics/courses/${ctx.courseId}`, {
      cookies: ctx.teacherCookies,
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('GET /analytics/courses/:courseId/students — список студентів з прогресом', async () => {
    const r = await req('GET', `/analytics/courses/${ctx.courseId}/students`, {
      cookies: ctx.teacherCookies,
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const students = r.body?.data?.students ?? r.body?.data ?? [];
    assert(Array.isArray(students), 'Очікувався масив студентів');
  });

  // ── 8. Admin ───────────────────────────────────────────────────────────────
  section('Admin');

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASS  = process.env.ADMIN_PASSWORD;

  if (ADMIN_EMAIL && ADMIN_PASS) {
    const lr = await req('POST', '/auth/login', {
      body: { email: ADMIN_EMAIL, password: ADMIN_PASS },
    });
    if (lr.status === 200) {
      ctx.adminCookies = buildCookieHeader(lr.rawCookies, 'accessToken', 'refreshToken');
      log(colors.dim('  [Admin credentials завантажено]'));
    }
  } else {
    log(colors.yellow('  ⚠  ADMIN_EMAIL/ADMIN_PASSWORD не задано — admin-тести будуть частково пропущені'));
  }

  if (ctx.adminCookies) {
    await test('GET /admin/users — адмін бачить список користувачів', async () => {
      const r = await req('GET', '/admin/users', { cookies: ctx.adminCookies });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      const users = r.body?.data?.users ?? r.body?.data ?? [];
      assert(Array.isArray(users), 'Очікувався масив');
    });

    await test('GET /admin/users?role=student — фільтр за роллю', async () => {
      const r = await req('GET', '/admin/users?role=student', { cookies: ctx.adminCookies });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
    });

    await test('GET /admin/courses — модерація курсів', async () => {
      const r = await req('GET', '/admin/courses', { cookies: ctx.adminCookies });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
    });

    await test('PATCH /admin/courses/:id/unpublish — адмін знімає курс', async () => {
      const r = await req('PATCH', `/admin/courses/${ctx.courseId}/unpublish`, {
        cookies: ctx.adminCookies,
      });
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      // Відновлюємо для чистоти
      await req('PATCH', `/courses/${ctx.courseId}/publish`, { cookies: ctx.teacherCookies });
    });

    if (ctx.studentId) {
      await test('PATCH /admin/users/:id/ban — бан студента', async () => {
        const r = await req('PATCH', `/admin/users/${ctx.studentId}/ban`, {
          cookies: ctx.adminCookies,
        });
        assert(r.status === 200, `Expected 200, got ${r.status}`);
      });

      await test('POST /auth/login — заблокований студент → 403', async () => {
        const r = await req('POST', '/auth/login', {
          body: { email: STUDENT.email, password: STUDENT.password },
        });
        assert(r.status === 403, `Expected 403 для забаненого, got ${r.status}`);
      });

      await test('PATCH /admin/users/:id/unban — розбан студента', async () => {
        const r = await req('PATCH', `/admin/users/${ctx.studentId}/unban`, {
          cookies: ctx.adminCookies,
        });
        assert(r.status === 200, `Expected 200, got ${r.status}`);
      });
    }
  } else {
    skip('GET /admin/users', 'потрібен ADMIN_EMAIL + ADMIN_PASSWORD');
    skip('PATCH /admin/users/:id/ban', 'потрібен ADMIN_EMAIL + ADMIN_PASSWORD');
    skip('PATCH /admin/courses/:id/unpublish', 'потрібен ADMIN_EMAIL + ADMIN_PASSWORD');
  }

  await test('GET /admin/users — студент → 403', async () => {
    const r = await req('GET', '/admin/users', { cookies: ctx.studentCookies });
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  await test('GET /admin/users — вчитель → 403', async () => {
    const r = await req('GET', '/admin/users', { cookies: ctx.teacherCookies });
    assert(r.status === 403, `Expected 403, got ${r.status}`);
  });

  // ── 9. Logout ──────────────────────────────────────────────────────────────
  section('Logout');

  await test('POST /auth/logout — студент', async () => {
    const r = await req('POST', '/auth/logout', { cookies: ctx.studentCookies });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('GET /profiles/me після logout → 401', async () => {
    const r = await req('GET', '/profiles/me', { cookies: ctx.studentCookies });
    assert(r.status === 401, `Expected 401 після logout, got ${r.status}`);
  });

  // ── Видалення уроку наприкінці ─────────────────────────────────────────────
  section('Cleanup');

  await test('DELETE /lessons/:id — вчитель видаляє урок', async () => {
    const r = await req('DELETE', `/lessons/${ctx.lessonId}`, {
      cookies: ctx.teacherCookies,
    });
    assert(r.status === 200 || r.status === 204, `Expected 200/204, got ${r.status}`);
  });

  // ── Підсумок ───────────────────────────────────────────────────────────────
  const total = results.pass + results.fail + results.skip;
  log(`\n${'─'.repeat(50)}`);
  log(colors.bold(`Результати: ${total} тестів`));
  log(colors.green(`  ✅ Пройдено:  ${results.pass}`));
  if (results.fail > 0)
    log(colors.red(`  ❌ Провалено: ${results.fail}`));
  if (results.skip > 0)
    log(colors.yellow(`  ⏭  Пропущено: ${results.skip}`));
  log(`${'─'.repeat(50)}\n`);

  if (results.fail > 0) process.exit(1);
}

runAll().catch(err => {
  console.error(colors.red(`\n💥 Критична помилка запуску: ${err.message}`));
  console.error(err.stack);
  process.exit(2);
});