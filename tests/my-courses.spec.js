// @ts-check
// UI tests: drive the My Courses page in a real browser, using the same
// accessible names a screen reader user would hear.
// Expected values come from db/schema_and_seed.sql plus tests/fixtures/test_data.sql.

const { test, expect } = require('@playwright/test');

const enrolledList = (page) => page.getByRole('list', { name: 'Enrolled courses' });
const catalogue = (page) => page.getByRole('list', { name: 'Enroll in a course' });
const courseCard = (page, code) => enrolledList(page).getByRole('listitem').filter({ hasText: code });
const showFilter = (page, label) => page.getByRole('group', { name: 'Show' }).getByText(label, { exact: true }).click();

/** A promise you resolve from outside: used to hold a response back until the test says so. */
const gate = () => {
  let open;
  const promise = new Promise((resolve) => { open = resolve; });
  return { promise, open };
};

/** Lets the page finish handling a response it has just received. */
const settle = (page) => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));

const isApi = (file, status) => (url) =>
  url.pathname.endsWith(`/api/${file}`) && (status === undefined || url.searchParams.get('status') === status);
/** Same match for page.waitForResponse, which passes a Response rather than a URL. */
const isApiResponse = (file, status) => (response) => isApi(file, status)(new URL(response.url()));

test('shows the student\'s courses with marks and what they are based on', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Hi Amara, here\'s where you stand.')).toBeVisible();
  await expect(enrolledList(page).locator('.course__code')).toHaveText(['MHF4U', 'SCH4U', 'ENG4U']);

  const functions = courseCard(page, 'MHF4U');
  await expect(functions.locator('.course__status')).toHaveText('In progress');
  await expect(functions.getByRole('progressbar', { name: 'MHF4U progress' })).toHaveAttribute('value', '45');
  await expect(functions.locator('.mark__value')).toHaveText('76.7%');
  await expect(functions.locator('.mark__basis')).toHaveText('Based on 30% of the course graded so far');

  const english = courseCard(page, 'ENG4U');
  await expect(english.locator('.course__status')).toHaveText('Completed');
  await expect(english.locator('.mark__basis')).toHaveText('All evaluations graded');
});

test('the evaluation breakdown labels work that is not graded yet', async ({ page }) => {
  await page.goto('/?student=3');
  await expect(page.getByLabel('Viewing as (demo)')).toHaveValue('3');

  const biology = courseCard(page, 'SBI4U');
  await biology.getByText('Evaluation breakdown', { exact: true }).click(); // the <summary>, not the caption
  const table = biology.getByRole('table', { name: 'Evaluation breakdown for SBI4U' });

  await expect(table.getByRole('row', { name: /Quiz 1/ })).toContainText('17 / 20 (85%)');
  await expect(table.getByRole('row', { name: /Midterm Test/ })).toContainText('Awaiting grade');
  await expect(table.getByRole('row', { name: /Final Exam/ })).toContainText('Not started');
});

test('filters courses by status', async ({ page }) => {
  await page.goto('/');
  await expect(enrolledList(page).getByRole('listitem')).toHaveCount(3);

  await showFilter(page, 'Completed');
  await expect(enrolledList(page).locator('.course__code')).toHaveText(['ENG4U']);

  await showFilter(page, 'Withdrawn');
  await expect(enrolledList(page).getByRole('listitem')).toHaveCount(0);
  await expect(page.getByText('No withdrawn courses.')).toBeVisible();

  await showFilter(page, 'All');
  await expect(enrolledList(page).getByRole('listitem')).toHaveCount(3);
});

test('switching student reloads both lists and updates the URL', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Hi Amara')).toBeVisible();

  await page.getByLabel('Viewing as (demo)').selectOption('2');

  await expect(page).toHaveURL(/[?&]student=2\b/);
  await expect(page.getByText('Hi Liam, here\'s where you stand.')).toBeVisible();
  await expect(courseCard(page, 'MCV4U').locator('.course__status')).toHaveText('Withdrawn');
  await expect(catalogue(page).getByRole('listitem').filter({ hasText: 'MCV4U' })).toContainText('Withdrawn');
});

test('the catalogue hides inactive courses and offers Enroll only where allowed', async ({ page }) => {
  await page.goto('/');
  const items = catalogue(page).getByRole('listitem');

  await expect(items).toHaveCount(7);
  await expect(catalogue(page)).not.toContainText('MPM1D');
  await expect(items.filter({ hasText: 'ENG4U' })).toContainText('Completed');
  await expect(items.filter({ hasText: 'MHF4U' })).toContainText('Enrolled');
  await expect(page.getByRole('button', { name: 'Enroll in SBI4U Biology' })).toBeEnabled();
});

test('enrolling adds the course without a reload and moves focus to it', async ({ page }) => {
  // Writes to the DB: student 3 + CGC1D is not used by any other test.
  await page.goto('/?student=3');
  await page.getByRole('button', { name: 'Enroll in CGC1D' }).click();

  const card = courseCard(page, 'CGC1D');
  await expect(card.locator('.course__status')).toHaveText('In progress');
  await expect(card.locator('.mark__value')).toHaveText('No mark yet');
  await expect(card.getByRole('heading', { name: /CGC1D/ })).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Enrolled in CGC1D Issues in Canadian Geography.');

  await expect(page.getByRole('button', { name: 'Enroll in CGC1D' })).toHaveCount(0);
  await expect(catalogue(page).getByRole('listitem').filter({ hasText: 'CGC1D' })).toContainText('Enrolled');

  // It is really saved: still there after a reload.
  await page.reload();
  await expect(courseCard(page, 'CGC1D')).toBeVisible();
});

test('a stale catalogue (enrolled in another tab) shows the reason and refreshes', async ({ page, request }) => {
  // Writes to the DB: student 3 + SNC2D is not used by any other test.
  await page.goto('/?student=3');
  const enrollButton = page.getByRole('button', { name: 'Enroll in SNC2D' });
  await expect(enrollButton).toBeVisible();

  // Enroll behind the page's back, as another tab would.
  const response = await request.post('/api/enrollments.php', {
    headers: { 'X-Student-Id': '3', 'Content-Type': 'application/json' },
    data: { course_id: 7 },
  });
  expect(response.status()).toBe(201);

  await enrollButton.click();

  await expect(page.getByRole('alert')).toHaveText('You are already enrolled in SNC2D.');
  await expect(catalogue(page).getByRole('listitem').filter({ hasText: 'SNC2D' })).toContainText('Enrolled');
  await expect(courseCard(page, 'SNC2D')).toBeVisible();
});

test('shows the server\'s message when a request fails', async ({ page }) => {
  await page.route('**/api/catalogue.php', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } }),
    }),
  );
  await page.goto('/');

  await expect(page.getByRole('alert')).toHaveText('Something went wrong. Please try again.');
  await expect(page.getByText('Loading catalogue…')).toBeHidden();
  await expect(enrolledList(page).getByRole('listitem')).toHaveCount(3); // the rest of the page still works
});

test('an Enroll that cannot reach the server can be retried', async ({ page }) => {
  await page.goto('/?student=3');
  await page.route('**/api/enrollments.php', (route) => route.abort('internetdisconnected'));

  const button = page.getByRole('button', { name: 'Enroll in MCV4U' });
  await button.click();

  await expect(page.getByRole('alert')).toHaveText('Could not reach the server. Check your connection and try again.');
  await expect(button).toBeEnabled();
  await expect(button).toHaveText(/^Enroll/);
});

test.describe('races and failures', () => {
  test('an enrollment that finishes after switching student stays with the first student', async ({ page }) => {
    const release = gate();
    // Mocked, so nothing is written: student 1's enrollment in SBI4U, answered late.
    await page.route(isApi('enrollments.php'), async (route) => {
      await release.promise;
      await route.fulfill({
        status: 201,
        json: {
          data: {
            course: {
              enrollment_id: 999, course_id: 4, code: 'SBI4U', title: 'Biology', grade: 12, credit_value: 1,
              status: 'in_progress', progress_percent: 0, enrolled_at: '2026-11-24 10:00:00', completed_at: null,
              mark: { percent: null, graded_weight_percent: 0 }, evaluations: [],
            },
          },
        },
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Enroll in SBI4U' }).click();
    await page.getByLabel('Viewing as (demo)').selectOption('2');
    await expect(page.getByText('Hi Liam')).toBeVisible();

    const answered = page.waitForResponse(isApiResponse('enrollments.php'));
    release.open();
    await answered;
    await settle(page);

    await expect(courseCard(page, 'SBI4U')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enroll in SBI4U' })).toBeEnabled();
  });

  test('a course list requested before enrolling cannot hide the new course', async ({ page }) => {
    // Writes to the DB: student 3 + MHF4U is not used by any other test.
    await page.goto('/?student=3');
    await expect(courseCard(page, 'SBI4U')).toBeVisible();

    // Hold the "In progress" list, fetched *before* the enrollment exists.
    const release = gate();
    const fetched = gate();
    let first = true;
    await page.route(isApi('courses.php', 'in_progress'), async (route) => {
      if (!first) return route.continue();
      first = false;
      const response = await route.fetch();
      fetched.open();
      await release.promise;
      await route.fulfill({ response });
    });

    await showFilter(page, 'In progress');
    await fetched.promise;
    await page.getByRole('button', { name: 'Enroll in MHF4U' }).click();
    await page.waitForResponse(isApiResponse('enrollments.php'));

    const staleAnswered = page.waitForResponse(isApiResponse('courses.php', 'in_progress'));
    release.open();
    await staleAnswered;
    await settle(page);

    await expect(page.getByText('Loading your courses…')).toBeHidden();
    await expect(courseCard(page, 'MHF4U')).toHaveCount(1);
    await expect(courseCard(page, 'MHF4U').getByRole('heading')).toBeFocused();
  });

  test('an older catalogue response cannot overwrite a newer one', async ({ page }) => {
    // The first catalogue request is answered last, with outdated (empty) data.
    const release = gate();
    let first = true;
    await page.route(isApi('catalogue.php'), async (route) => {
      if (!first) return route.continue();
      first = false;
      await release.promise;
      await route.fulfill({ json: { data: { courses: [] } } });
    });

    await page.goto('/?student=3');
    await page.getByLabel('Viewing as (demo)').selectOption('2');
    await page.getByLabel('Viewing as (demo)').selectOption('3');
    await expect(catalogue(page).getByRole('listitem')).toHaveCount(7);

    const staleAnswered = page.waitForResponse(isApiResponse('catalogue.php'));
    release.open();
    await staleAnswered;
    await settle(page);

    await expect(catalogue(page).getByRole('listitem')).toHaveCount(7);
  });

  test('the Enroll button recovers when refreshing after a conflict also fails', async ({ page }) => {
    await page.goto('/?student=3');
    await expect(catalogue(page).getByRole('listitem')).toHaveCount(7);

    // Mocked, so nothing is written.
    await page.route(isApi('enrollments.php'), (route) => route.fulfill({
      status: 409,
      json: { error: { code: 'already_enrolled', message: 'You are already enrolled in ENG4U.' } },
    }));
    await page.route(isApi('catalogue.php'), (route) => route.abort('internetdisconnected'));

    const button = page.getByRole('button', { name: 'Enroll in ENG4U' });
    await button.click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(button).toHaveText(/^Enroll in ENG4U/);
  });

  test('a success response that is not JSON shows a clear error', async ({ page }) => {
    await page.route(isApi('courses.php'), (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Gateway page</body></html>' }),
    );
    await page.goto('/');

    await expect(page.getByRole('alert')).toHaveText('The server sent an unexpected response. Please try again.');
  });
});

test('a link to an unknown student falls back to the first student', async ({ page }) => {
  await page.goto('/?student=9');

  await expect(page.getByLabel('Viewing as (demo)')).toHaveValue('1');
  await expect(page.getByText('Hi Amara, here\'s where you stand.')).toBeVisible();
  await expect(page.getByRole('alert')).toBeHidden();
});
