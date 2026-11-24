// @ts-check
// UI tests: drive the My Courses page in a real browser, using the same
// accessible names a screen reader user would hear.
// Expected values come from db/schema_and_seed.sql.

const { test, expect } = require('@playwright/test');

const enrolledList = (page) => page.getByRole('list', { name: 'Enrolled courses' });
const catalogue = (page) => page.getByRole('list', { name: 'Enroll in a course' });
const courseCard = (page, code) => enrolledList(page).getByRole('listitem').filter({ hasText: code });
const showFilter = (page, label) => page.getByRole('group', { name: 'Show' }).getByText(label, { exact: true }).click();

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
