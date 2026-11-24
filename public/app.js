// My Courses page. Vanilla JS, no build step.
// All data is rendered with textContent / DOM APIs, never innerHTML, so text
// from the API (course titles etc.) can't inject markup.

const STATUS_LABELS = { in_progress: 'In progress', completed: 'Completed', withdrawn: 'Withdrawn' };
const STATUS_ORDER = { in_progress: 0, completed: 1, withdrawn: 2 }; // same order as the API
const number = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 });

const $ = (selector, root = document) => root.querySelector(selector);

const els = {
  studentSelect: $('#student-select'),
  greeting: $('#greeting'),
  announcer: $('#announcer'),
  errorBanner: $('#error-banner'),
  courseList: $('#course-list'),
  coursesLoading: $('#courses-loading'),
  coursesEmpty: $('#courses-empty'),
  catalogueList: $('#catalogue-list'),
  catalogueLoading: $('#catalogue-loading'),
  courseTemplate: $('#course-template'),
  catalogueTemplate: $('#catalogue-template'),
};

const state = {
  studentId: initialStudentId(),
  filter: '',
  courses: [],
  catalogue: [],
  // Each load takes a new token; only the newest load may write its result,
  // so a slow response can never overwrite a newer one.
  coursesToken: 0,
  catalogueToken: 0,
  // True while a load is in flight (its result may predate an enrollment).
  coursesLoading: false,
  catalogueLoading: false,
};

// --- API ---------------------------------------------------------------------

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Calls the API as the current student. Resolves with `data`, rejects with ApiError. */
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'X-Student-Id': String(state.studentId), Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`api/${path}`, { method, headers, body: body && JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach the server. Check your connection and try again.');
  }

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      json?.error?.code ?? 'unknown_error',
      json?.error?.message ?? `Something went wrong (HTTP ${response.status}).`,
    );
  }
  // A 2xx that isn't our JSON (e.g. an HTML page from a proxy) is still a failure.
  if (json === null || typeof json !== 'object' || !('data' in json)) {
    throw new ApiError(response.status, 'bad_response', 'The server sent an unexpected response. Please try again.');
  }
  return json.data;
}

// --- Loading -----------------------------------------------------------------

async function loadCourses() {
  const token = ++state.coursesToken;
  state.coursesLoading = true;
  els.courseList.setAttribute('aria-busy', 'true');
  els.coursesLoading.hidden = false;
  try {
    const query = state.filter ? `?status=${encodeURIComponent(state.filter)}` : '';
    const data = await api(`courses.php${query}`);
    if (token !== state.coursesToken) return; // a newer load has started
    state.courses = data.courses;
    els.greeting.textContent = `Hi ${data.student.first_name}, here's where you stand.`;
    renderCourses();
  } catch (error) {
    if (token === state.coursesToken) showError(error.message);
  } finally {
    if (token === state.coursesToken) {
      state.coursesLoading = false;
      els.courseList.removeAttribute('aria-busy');
      els.coursesLoading.hidden = true;
    }
  }
}

async function loadCatalogue() {
  const token = ++state.catalogueToken;
  state.catalogueLoading = true;
  els.catalogueLoading.hidden = false;
  try {
    const data = await api('catalogue.php');
    if (token !== state.catalogueToken) return; // a newer load has started
    state.catalogue = data.courses;
    renderCatalogue();
  } catch (error) {
    if (token === state.catalogueToken) showError(error.message);
  } finally {
    if (token === state.catalogueToken) {
      state.catalogueLoading = false;
      els.catalogueLoading.hidden = true;
    }
  }
}

// --- Rendering: enrolled courses -------------------------------------------------

function renderCourses() {
  const cards = state.courses.map(renderCourseCard);
  els.courseList.replaceChildren(...cards);

  els.coursesEmpty.hidden = cards.length > 0;
  els.coursesEmpty.textContent = state.filter
    ? `No ${STATUS_LABELS[state.filter].toLowerCase()} courses.`
    : 'You are not enrolled in any courses yet. Pick one below to get started.';
}

function renderCourseCard(course) {
  const card = els.courseTemplate.content.firstElementChild.cloneNode(true);
  card.dataset.courseId = course.course_id;

  $('.course__code', card).textContent = course.code;
  $('.course__name', card).textContent = course.title;

  const badge = $('.course__status', card);
  badge.textContent = STATUS_LABELS[course.status];
  badge.classList.add(`badge--${course.status}`);

  const progress = $('.progress', card);
  progress.value = course.progress_percent;
  progress.setAttribute('aria-label', `${course.code} progress`);
  progress.textContent = `${course.progress_percent}%`; // fallback text for old browsers
  $('.progress__text', card).textContent = `${course.progress_percent}%`;

  const { percent, graded_weight_percent: gradedWeight } = course.mark;
  $('.mark__value', card).textContent = percent === null ? 'No mark yet' : `${number.format(percent)}%`;
  $('.mark__basis', card).textContent = markBasis(percent, gradedWeight);

  $('.breakdown__table caption', card).textContent = `Evaluation breakdown for ${course.code}`;
  $('.breakdown__table tbody', card).replaceChildren(...course.evaluations.map(renderEvaluationRow));
  return card;
}

/** Explains what the mark is based on, so a partial mark isn't mistaken for a final one. */
function markBasis(percent, gradedWeight) {
  if (percent === null) return 'Nothing graded yet';
  if (gradedWeight >= 100) return 'All evaluations graded';
  return `Based on ${number.format(gradedWeight)}% of the course graded so far`;
}

function renderEvaluationRow(evaluation) {
  const row = document.createElement('tr');
  row.className = `evaluation evaluation--${evaluation.status}`;

  const name = document.createElement('th');
  name.scope = 'row';
  name.textContent = evaluation.name;

  const weight = document.createElement('td');
  weight.className = 'num';
  weight.textContent = `${number.format(evaluation.weight_percent)}%`;

  const result = document.createElement('td');
  if (evaluation.status === 'graded') {
    result.textContent =
      `${number.format(evaluation.score)} / ${number.format(evaluation.out_of)} (${number.format(evaluation.percent)}%)`;
  } else {
    // Not-graded items get a labelled badge, not just a dash, so the reason is clear.
    const tag = document.createElement('span');
    tag.className = `tag tag--${evaluation.status}`;
    tag.textContent = evaluation.status === 'submitted' ? 'Awaiting grade' : 'Not started';
    result.append(tag);
  }

  row.append(name, weight, result);
  return row;
}

// --- Rendering: catalogue ------------------------------------------------------

function renderCatalogue() {
  els.catalogueList.replaceChildren(...state.catalogue.map(renderCatalogueItem));
}

function renderCatalogueItem(course) {
  const item = els.catalogueTemplate.content.firstElementChild.cloneNode(true);
  item.dataset.courseId = course.id;
  $('.course__code', item).textContent = course.code;
  $('.course__name', item).textContent = course.title;
  $('.catalogue__meta', item).textContent = `Grade ${course.grade} · ${number.format(course.credit_value)} credit`;

  const action = $('.catalogue__action', item);
  if (course.enrollment_status === null) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button';
    button.dataset.enroll = course.id;
    // Visible text "Enroll"; the hidden part makes each button's name unique for screen readers.
    const hidden = document.createElement('span');
    hidden.className = 'visually-hidden';
    hidden.textContent = ` in ${course.code} ${course.title}`;
    button.append('Enroll', hidden);
    action.append(button);
  } else {
    const tag = document.createElement('span');
    tag.className = `badge badge--${course.enrollment_status}`;
    tag.textContent = course.enrollment_status === 'in_progress' ? 'Enrolled' : STATUS_LABELS[course.enrollment_status];
    action.append(tag);
  }
  return item;
}

// --- Enrolling -----------------------------------------------------------------

async function enroll(button) {
  const courseId = Number(button.dataset.enroll);
  const studentId = state.studentId;
  button.disabled = true;
  button.firstChild.textContent = 'Enrolling…';
  hideError();

  try {
    const { course } = await api('enrollments.php', { method: 'POST', body: { course_id: courseId } });
    if (studentId !== state.studentId) return; // switched student meanwhile: not this page's course

    // Update both lists from the response: no full reload, no extra request.
    // But a load still in flight may have been answered before this enrollment
    // existed, so start a fresh load instead of letting that one win.
    if (state.catalogueLoading) {
      loadCatalogue();
    } else {
      setCatalogueStatus(courseId, course.status);
    }
    if (state.coursesLoading) {
      await loadCourses();
    } else if (!state.filter || state.filter === course.status) {
      state.courses = [...state.courses, course].sort(compareCourses);
      renderCourses();
    }
    if (studentId !== state.studentId) return;
    announce(`Enrolled in ${course.code} ${course.title}.`);

    // The button is gone, so move focus somewhere meaningful: the new course.
    const heading = $(`.course[data-course-id="${course.course_id}"] .course__title`, els.courseList);
    heading?.focus();
  } catch (error) {
    if (studentId !== state.studentId) return;
    showError(error.message);
    // Re-enable first: if the refresh below fails, the button must not stay stuck.
    button.disabled = false;
    button.firstChild.textContent = 'Enroll';
    if (error.code === 'already_enrolled' || error.code === 'course_inactive') {
      // Our copy of the catalogue was out of date (another tab?); refresh both lists.
      loadCatalogue();
      loadCourses();
    }
  }
}

function setCatalogueStatus(courseId, status) {
  const entry = state.catalogue.find((c) => c.id === courseId);
  if (entry) entry.enrollment_status = status;
  renderCatalogue();
}

function compareCourses(a, b) {
  return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.code.localeCompare(b.code);
}

// --- Messages ------------------------------------------------------------------

function announce(message) {
  els.announcer.textContent = message;
}

function showError(message) {
  els.errorBanner.textContent = message;
  els.errorBanner.hidden = false;
}

function hideError() {
  els.errorBanner.hidden = true;
  els.errorBanner.textContent = '';
}

// --- Student (demo stand-in for login) ------------------------------------------

/**
 * Reads ?student=N from the URL so a view can be linked and reloaded.
 * Falls back to the first student in the picker for a missing or unknown id.
 */
function initialStudentId() {
  const requested = new URLSearchParams(location.search).get('student');
  const known = [...els.studentSelect.options].map((option) => option.value);
  return Number(known.includes(requested) ? requested : known[0]);
}

function switchStudent(id) {
  state.studentId = id;
  const url = new URL(location.href);
  url.searchParams.set('student', String(id));
  history.replaceState(null, '', url);

  hideError();
  els.greeting.textContent = '';
  els.courseList.replaceChildren();
  els.catalogueList.replaceChildren();
  loadCourses();
  loadCatalogue();
}

// --- Wiring --------------------------------------------------------------------

els.studentSelect.value = String(state.studentId);
els.studentSelect.addEventListener('change', () => switchStudent(Number(els.studentSelect.value)));

document.querySelectorAll('input[name="status"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    state.filter = radio.value;
    hideError();
    loadCourses();
  });
});

// One listener for all Enroll buttons (they are re-rendered often).
els.catalogueList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-enroll]');
  if (button && !button.disabled) enroll(button);
});

loadCourses();
loadCatalogue();
