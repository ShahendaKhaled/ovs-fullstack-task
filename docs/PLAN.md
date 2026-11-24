# Plan — My Courses take-home

The "My Courses" feature needs two endpoints (list a student's courses with marks, filterable by status; enroll in a course), one vanilla HTML/CSS/JS page, a short README and optional tests. It's built in plain PHP + MySQL to match the LMS, with no framework or build tooling.

## Time breakdown

| Time | Duration | Work |
|---|---|---|
| 10:00 – 10:30 | 30 min | Investigate requirements and the DB tables; look into good skills for PHP, security, code review and testing; install PHP and MySQL locally; set up the GitHub repo |
| 10:30 – 11:40 | 70 min | Implement the APIs with Claude Code, plus code review |
| 11:40 – 11:50 | 10 min | Front end and screenshot collages at each size |
| 11:50 – 12:15 | 25 min | README updates and research into optimization |
| 12:15 – 12:30 | 15 min | Playwright tests, using the Playwright plugin |
| 12:30 – 12:55 | 25 min | Code review, security review and code cleanup |
| **Total** | **2 h 55 min** | |

## Steps

### 1. Investigate requirements and DB structure
- Read the brief and list what's required and what's optional (tests are a bonus).
- Read the starter schema (`students`, `courses`, `enrollments`, `course_evaluations`, `student_evaluations`) and seed data: relationships, existing indexes, and how a course's mark is calculated from evaluations.
- Decide scope and trade-offs up front: plain PHP, an `X-Student-Id` header in place of login, and a least-privilege DB user.

**Output:** [db/schema_and_seed.sql](../db/schema_and_seed.sql), [db/create_app_user.sql](../db/create_app_user.sql)

### 2. Pick skills for PHP, security, code review and testing
- Choose the Claude Code skills and tools to use: PHP practices, `/security-review`, `/code-review`, and Playwright for API and browser tests.

### 3. Install PHP and MySQL locally
- PHP 8.3 with `pdo_mysql`, MySQL 8.0 running as a service, and Node 20 for the tests.
- Load the schema and seed data, create the `ovs_app` user, and check the connection.

### 4. Implement the APIs
- `GET /api/courses.php`: the student's courses with marks, with a status filter.
- `POST /api/enrollments.php`: enroll the student, with validation and clear error codes.
- `GET /api/catalogue.php`: active courses for the enroll list (added; noted as a trade-off).
- Shared code in `src/`: DB connection, auth header, HTTP helpers, mark calculation, security headers.

**Output:** [public/api/](../public/api/), [src/](../src/)

### 5. Review the implementation
- Run `/code-review` on the API code and fix the important findings.
- Check security: prepared statements, input validation, per-student access only, and a DB user that can't edit grades.
- Compare responses against the seed data by hand.

### 6. Front end and screenshots at each size
- "My Courses" page: course list with marks, status filter, enroll form, and a demo student switcher.
- Make it responsive, with a strict CSP (no inline scripts or styles).
- Take screenshot collages at phone, tablet and desktop widths.

**Output:** [public/index.html](../public/index.html), [public/app.js](../public/app.js), [public/styles.css](../public/styles.css), [docs/screenshots/](screenshots/)

### 7. Update the README
- How to run (DB, app, tests), scale, security (done / next), trade-offs, and an honest record of AI use.
- Start and end times.

**Output:** [README.md](../README.md)

### 8. Tests (bonus)
- Playwright API tests covering every endpoint and error code.
- Playwright browser tests of the page.
- Global setup that checks the seed data is fresh, plus `npm run db:reset`.

**Output:** [tests/](../tests/), [playwright.config.js](../playwright.config.js)

### 9. Final code review
- Run `/code-review` (and `/security-review`) on the whole project.
- Fix the important findings and note any deferred ones in the README's trade-offs.
- Run the full test suite on fresh seed data, recheck the README run steps from a clean start, and fill in the end time.
