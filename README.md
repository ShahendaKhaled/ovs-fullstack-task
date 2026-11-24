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
- **A third, read-only endpoint: `GET /api/catalogue.php`.** The brief asks for two endpoints, but the page needs the active catalogue to enroll from. It lists active courses with the student's enrollment status, so the page can mark courses the student is already in without a second request. Inactive courses are left out entirely.
- **Two queries per request, however many courses.** One query gets enrollments, one gets all their evaluations. The rows are grouped in PHP rather than with `JSON_ARRAYAGG`, which keeps the SQL plain. No pagination, because a student has a handful of enrollments.
- **Responses are sent with `send_json(): never`, which ends the script.** That's simpler than building response objects, at the cost of being harder to unit-test the endpoints in isolation, so the plan is to test them over HTTP instead.
- **Page security headers are left to the web server.** The API sets its own headers in PHP. Static files never run PHP, so their headers (page CSP, HSTS, etc.) are documented for nginx in `docs/nginx-security-headers.conf` rather than added locally. Locally, `php -S` serves the page without them; a dev router could add them, but it was extra code to secure for something only used in development.
- **The dev database password is committed** (`ovs_app_dev_pw`) so a clean checkout runs with no setup. The account is limited to localhost and has least privilege; real deployments set `DB_PASS`.

## AI tools

I used **Claude Code** (in VS Code) throughout, as a pair programmer:

- **I made the decisions; Claude drafted and tested.** I chose plain PHP + PDO and vanilla JS, the scope, and the trade-offs above. Claude drafted the code to that direction and tested it against the running app with `curl` (status codes, edge cases, a concurrent-enroll race), and I reviewed each piece. It also drafted this README.
- **Line-by-line explanations.** I had it explain parts I wanted to be sure of before keeping them, such as `filter_var` validation, PDO options, `strict_types`, and the `static` connection.
- **Built-in `/code-review` skill.** I ran it on the committed code. It found 8 issues, and I acted on the important ones: the dev router (path handling and missing headers) was removed and its job documented for nginx instead; `json_encode` failures now return a 500 instead of an empty 200; PHP errors can no longer leak into JSON responses. I judged the rest minor and left them.
