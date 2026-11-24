# OVS Take-Home — My Courses

**Start:** 10:00 · **End:** _TODO_

## How to run

Needs PHP 8.1+ with `pdo_mysql`, MySQL 8, and for the tests Node 20+.

**1. Database** (creates `ovs_takehome` with seed data, then a least-privilege app user):

```bash
mysql -u root -p < db/schema_and_seed.sql
mysql -u root -p < db/create_app_user.sql
```

If root uses socket auth (Ubuntu's default), use `sudo mysql` instead of `mysql -u root -p`. The app connects as `ovs_app`; override with `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.

**2. App**

```bash
php -S 127.0.0.1:8000 -t public
```

Open http://127.0.0.1:8000/ and switch students with **Viewing as (demo)** (or link to `?student=2`).

**3. Tests** (Playwright: 18 API tests covering every endpoint and error code, 9 browser tests of the page)

```bash
npm ci                            # installs the pinned Playwright version from package-lock.json
npx playwright install chromium   # first time only; on a fresh Linux box use --with-deps (needs sudo) for system libraries
npm run db:reset   # fresh seed data; uses `sudo mysql`, or set MYSQL_ADMIN="mysql -u root -p"
npm test           # starts `php -S` itself if it isn't already running
npm run test:report   # HTML report, with a trace for any failure
```

Reset the database before every test run. Some tests enroll students and the app's DB user can't delete rows, so the suite can't clean up after itself. It checks the seed data first and stops with the reset command if anything has changed.

## Scale

- Data is small (~0.5M grade rows/yr) and queries use existing indexes; peaks are the risk. Use PHP-FPM + OPcache and load-test expected peaks (e.g. start of the school year).
- Cache the catalogue; add search and a grade filter for 170+ courses.
- Run reports on a read replica.

## Security

- **Done:** prepared statements, input validation, per-student access only, a DB user that can't edit grades, strict CSP.
- **Next:** real sessions + CSRF, roles, a grade audit log, encryption at rest, rate limits.

## Trade-offs

- Plain PHP to match the LMS.
- The `X-Student-Id` header stands in for login.
- Added `GET /api/catalogue.php` for the enrol list.
- The dev DB password is in code; next step is a gitignored `.env`.

## AI tools

I used Claude Code (Anthropic) throughout, with me making the decisions and reviewing the output.

- **Code:** it drafted the endpoints, page and SQL to my decisions (plain PHP, header in place of login, a separate catalogue endpoint, a DB user that can't edit grades) and checked them against the seed data.
- **Review:** its `/code-review` found 8 issues; I fixed the important ones.
- **Tests:** it wrote the Playwright suite and its setup, including the expected marks, which come from the seed data. All 27 tests pass on fresh seed data.
- **Docs:** it drafted this README; I edited it.
