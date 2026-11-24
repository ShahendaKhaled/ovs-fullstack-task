// @ts-check
// The tests assert exact seed values (marks, enrollments) and some of them enroll
// students, so they need a freshly reset database (seed + test fixture). The app's MySQL user can't
// delete rows (by design), so the suite can't reset the data itself. Instead it
// checks the data through the API and stops early with a clear message.

const { request } = require('@playwright/test');

// Enrolled course codes per student after `npm run db:reset`
// (db/schema_and_seed.sql plus tests/fixtures/test_data.sql).
const SEED_ENROLLMENTS = {
  1: ['ENG4U', 'MHF4U', 'SCH4U'],
  2: ['ENG4U', 'MCV4U', 'MPM1D'],
  3: ['SBI4U'],
};

module.exports = async function globalSetup(config) {
  const { baseURL } = config.projects[0].use;
  const api = await request.newContext({ baseURL });
  try {
    for (const [studentId, expected] of Object.entries(SEED_ENROLLMENTS)) {
      const response = await api.get('/api/courses.php', { headers: { 'X-Student-Id': studentId } });
      if (!response.ok()) {
        throw new Error(`GET /api/courses.php returned ${response.status()}. Is MySQL running and seeded?`);
      }
      const actual = (await response.json()).data.courses.map((c) => c.code).sort();
      if (actual.join() !== [...expected].sort().join()) {
        throw new Error(
          `The database is not in its seed state (student ${studentId} is enrolled in ${actual.join(', ')}).\n` +
          'Reset it and run the tests again:\n\n  npm run db:reset\n',
        );
      }
    }
  } finally {
    await api.dispose();
  }
};
