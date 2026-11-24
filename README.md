# OVS Take-Home — My Courses

**Start:** _TODO_ · **End:** _TODO_

## How to run

_TODO (final steps once the page and enroll endpoint exist)._ Currently:

```bash
sudo mysql < db/schema_and_seed.sql        # or: mysql -u root -p < ...
sudo mysql < db/create_app_user.sql        # least-privilege app user
php -S 127.0.0.1:8000 -t public
curl -H 'X-Student-Id: 1' 'http://127.0.0.1:8000/api/courses.php?status=in_progress'
```

DB settings can be overridden with `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`.

## Scale

_TODO_

## Security

_TODO_

## Trade-offs

- **Plain PHP, one file per endpoint, no framework or router.** This matches how the LMS is built and keeps every line explainable. The cost: shared concerns (headers, errors, auth) live in small `src/` helpers instead of middleware.
- **The student id comes from an `X-Student-Id` header, standing in for a session.** Endpoints act only on the *current* student and never take a "which student" parameter. It's a convention, not security: anyone can send the header. In production only `current_student()` changes, to read the session.
- **The course mark only counts graded work.** It's `Σ(score / out_of × weight) ÷ Σ(graded weight)`, so ungraded evaluations don't count as zeros. The API also returns `graded_weight_percent` so the page can say "76.7%, based on 30% of the course". A course with nothing graded gets `null` (no mark yet), not 0%. Withdrawn courses still show their mark.
- **Marks are calculated in PHP, not SQL.** The calculation is a pure function (`src/marks.php`), easy to read and to test. The catch is that the database can't sort or filter by mark. If that's ever needed, store the mark and update it when grading happens.
- **Two queries per request, however many courses.** One query gets enrollments, one gets all their evaluations. The rows are grouped in PHP rather than with `JSON_ARRAYAGG`, which keeps the SQL plain. No pagination, because a student has a handful of enrollments.
- **Responses are sent with `send_json(): never`, which ends the script.** That's simpler than building response objects, at the cost of being harder to unit-test the endpoints in isolation, so the plan is to test them over HTTP instead.
- **Page security headers are left to the web server.** The API sets its own headers in PHP. Static files never run PHP, so their headers (page CSP, HSTS, etc.) are documented for nginx in `docs/nginx-security-headers.conf` rather than added locally. Locally, `php -S` serves the page without them; a dev router could add them, but it was extra code to secure for something only used in development.
- **The dev database password is committed** (`ovs_app_dev_pw`) so a clean checkout runs with no setup. The account is limited to localhost and has least privilege; real deployments set `DB_PASS`.

## AI tools

_TODO_
