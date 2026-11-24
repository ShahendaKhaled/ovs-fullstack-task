// @ts-check
// API tests: call the PHP endpoints directly, no browser.
// Expected values come from db/schema_and_seed.sql plus tests/fixtures/test_data.sql
// (course ids: 1 ENG4U, 2 MHF4U, 4 SBI4U, 5 MCV4U, 8 MPM1D inactive;
// student 2 completed MPM1D before it became inactive).

const { test, expect } = require('@playwright/test');

const as = (studentId) => ({ 'X-Student-Id': String(studentId) });

const enroll = (request, studentId, body, headers = {}) =>
  request.post('/api/enrollments.php', {
    headers: { ...as(studentId), 'Content-Type': 'application/json', ...headers },
    // Objects are sent as JSON. A Buffer is sent byte for byte: Playwright would
    // JSON-encode a plain string, turning broken JSON into a valid JSON string.
    data: body,
  });

const expectError = async (response, status, code) => {
  expect(response.status()).toBe(status);
  const body = await response.json();
  expect(body.error.code).toBe(code);
  return body.error;
};

test.describe('GET /api/courses.php', () => {
  test('lists the student\'s courses, in progress first, with weighted marks', async ({ request }) => {
    const response = await request.get('/api/courses.php', { headers: as(1) });
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');

    const { data } = await response.json();
    expect(data.student).toEqual({ id: 1, first_name: 'Amara', last_name: 'Okafor' });
    expect(data.courses.map((c) => [c.code, c.status])).toEqual([
      ['MHF4U', 'in_progress'],
      ['SCH4U', 'in_progress'],
      ['ENG4U', 'completed'],
    ]);

    const mark = Object.fromEntries(data.courses.map((c) => [c.code, c.mark]));
    // MHF4U: (16/20*10 + 30/40*20) / 30 = 76.7%. Ungraded work doesn't count as zero.
    expect(mark.MHF4U).toEqual({ percent: 76.7, graded_weight_percent: 30 });
    expect(mark.SCH4U).toEqual({ percent: 70, graded_weight_percent: 10 });
    expect(mark.ENG4U).toEqual({ percent: 86.7, graded_weight_percent: 100 });
  });

  test('marks each evaluation as graded, submitted or not started', async ({ request }) => {
    const { data } = await (await request.get('/api/courses.php', { headers: as(3) })).json();
    const biology = data.courses.find((c) => c.code === 'SBI4U');

    expect(biology.evaluations.map((e) => [e.name, e.status, e.score])).toEqual([
      ['Quiz 1', 'graded', 17],
      ['Assignment 1', 'graded', 36],
      ['Midterm Test', 'submitted', null],
      ['Final Exam', 'not_started', null],
    ]);
    expect(biology.mark).toEqual({ percent: 88.3, graded_weight_percent: 30 });
  });

  test('filters by status', async ({ request }) => {
    const response = await request.get('/api/courses.php?status=withdrawn', { headers: as(2) });
    const { data } = await response.json();
    expect(data.courses.map((c) => c.code)).toEqual(['MCV4U']);
  });

  test('rejects an unknown status filter', async ({ request }) => {
    const response = await request.get('/api/courses.php?status=failed', { headers: as(1) });
    await expectError(response, 400, 'invalid_status');
  });

  for (const [label, headers] of [
    ['no student header', {}],
    ['a non-numeric student id', { 'X-Student-Id': '1 OR 1=1' }],
    ['an unknown student', as(999)],
  ]) {
    test(`returns 401 for ${label}`, async ({ request }) => {
      await expectError(await request.get('/api/courses.php', { headers }), 401, 'unauthenticated');
    });
  }

  test('only allows GET', async ({ request }) => {
    const response = await request.delete('/api/courses.php', { headers: as(1) });
    await expectError(response, 405, 'method_not_allowed');
    expect(response.headers().allow).toBe('GET');
  });
});

test.describe('GET /api/catalogue.php', () => {
  test('lists active courses only, with this student\'s enrollment status', async ({ request }) => {
    const { data } = await (await request.get('/api/catalogue.php', { headers: as(2) })).json();
    const status = Object.fromEntries(data.courses.map((c) => [c.code, c.enrollment_status]));

    expect(Object.keys(status)).not.toContain('MPM1D'); // inactive
    expect(Object.keys(status)).toHaveLength(7);
    expect(status).toMatchObject({ ENG4U: 'in_progress', MCV4U: 'withdrawn', SBI4U: null });
  });
});

test.describe('POST /api/enrollments.php', () => {
  test('enrolls the student and returns the new course', async ({ request }) => {
    // Writes to the DB: student 2 + MHF4U is not used by any other test.
    const response = await enroll(request, 2, { course_id: 2 });
    expect(response.status()).toBe(201);

    const { course } = (await response.json()).data;
    expect(course).toMatchObject({
      course_id: 2,
      code: 'MHF4U',
      status: 'in_progress',
      progress_percent: 0,
      mark: { percent: null, graded_weight_percent: 0 },
    });
    expect(course.evaluations.map((e) => e.status)).toEqual(Array(4).fill('not_started'));

    // Enrolling twice is refused (also covers a double click).
    const again = await expectError(await enroll(request, 2, { course_id: 2 }), 409, 'already_enrolled');
    expect(again.message).toBe('You are already enrolled in MHF4U.');
  });

  test('explains why a completed or withdrawn course can\'t be taken again', async ({ request }) => {
    const completed = await expectError(await enroll(request, 1, { course_id: 1 }), 409, 'already_enrolled');
    expect(completed.message).toBe('You have already completed ENG4U.');

    const withdrawn = await expectError(await enroll(request, 2, { course_id: 5 }), 409, 'already_enrolled');
    expect(withdrawn.message).toBe('You withdrew from MCV4U. Please contact Guidance to re-enroll.');
  });

  test('refuses inactive and unknown courses', async ({ request }) => {
    await expectError(await enroll(request, 3, { course_id: 8 }), 422, 'course_inactive');
    await expectError(await enroll(request, 3, { course_id: 9999 }), 404, 'course_not_found');
  });

  test('says "already completed" for a course that became inactive afterwards', async ({ request }) => {
    const error = await expectError(await enroll(request, 2, { course_id: 8 }), 409, 'already_enrolled');
    expect(error.message).toBe('You have already completed MPM1D.');
  });

  test('accepts extra nested fields in the body (not reported as broken JSON)', async ({ request }) => {
    // Inactive course, so nothing is written: reaching the 422 proves the body was parsed.
    const body = { course_id: 8, meta: { a: { b: { c: {} } } } };
    await expectError(await enroll(request, 3, body), 422, 'course_inactive');
  });

  for (const [label, body] of [
    ['a string id', { course_id: '2' }],
    ['a decimal id', { course_id: 2.5 }],
    ['zero', { course_id: 0 }],
    ['a missing id', {}],
  ]) {
    test(`rejects ${label}`, async ({ request }) => {
      await expectError(await enroll(request, 3, body), 400, 'invalid_course_id');
    });
  }

  test('rejects a body that is not JSON', async ({ request }) => {
    await expectError(await enroll(request, 3, Buffer.from('{course_id: 2')), 400, 'invalid_json');
  });

  test('rejects form posts (only JSON is accepted)', async ({ request }) => {
    const response = await request.post('/api/enrollments.php', { headers: as(3), form: { course_id: '2' } });
    await expectError(response, 415, 'unsupported_media_type');
  });

  test('checks who is asking before the body format', async ({ request }) => {
    const response = await request.post('/api/enrollments.php', { form: { course_id: '2' } });
    await expectError(response, 401, 'unauthenticated');
  });
});
