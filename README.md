# OVS Take-Home — My Courses

**Start:** 10:00 · **End:** _TODO_

## How to run

PHP 8.1+ (`pdo_mysql`), MySQL 8.

```bash
mysql -u root -p < db/schema_and_seed.sql
mysql -u root -p < db/create_app_user.sql
php -S 127.0.0.1:8000 -t public
```

Open http://127.0.0.1:8000/ and switch students with **Viewing as (demo)**.

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

Claude Code drafted and tested code to my decisions, and drafted this README. Its `/code-review` found 8 issues; I fixed the important ones.
