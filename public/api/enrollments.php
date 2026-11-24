<?php
declare(strict_types=1);

/**
 * POST /api/enrollments.php
 * Header: X-Student-Id: <id>   Content-Type: application/json
 * Body:   {"course_id": <int>}
 *
 * Enrolls the current student in an active course.
 *
 * 201 {"data": {"course": {...}}}   the new course, same shape as GET /api/courses.php
 * 400 invalid_json / invalid_course_id
 * 401 unauthenticated
 * 404 course_not_found
 * 405 method_not_allowed
 * 409 already_enrolled              (any existing enrollment: in progress, completed or withdrawn,
 *                                   even if the course has since become inactive)
 * 415 unsupported_media_type
 * 422 course_inactive
 *
 * Checked in this order: method, student (401), content type (415), body (400),
 * course exists (404), existing enrollment (409), course active (422).
 */

require_once __DIR__ . '/../../src/http.php'; // first: installs the error handlers
require_once __DIR__ . '/../../src/db.php';
require_once __DIR__ . '/../../src/auth.php';
require_once __DIR__ . '/../../src/courses.php';

require_method('POST');
$student = current_student(); // who is asking comes before what they sent

// Only accept JSON. Besides being the API's format, this blocks plain HTML
// form posts from other sites (CSRF) once identity moves to a session cookie:
// a cross-site JSON request needs a CORS preflight, which we never approve.
$contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
if ($contentType !== 'application/json') {
    send_error(415, 'unsupported_media_type', 'Send the request body as application/json.');
}

// --- Validate the body ------------------------------------------------------
try {
    // Default depth (512): extra nested fields are ignored, not reported as broken JSON.
    $body = json_decode(file_get_contents('php://input'), true, flags: JSON_THROW_ON_ERROR);
} catch (JsonException) {
    send_error(400, 'invalid_json', 'Request body is not valid JSON.');
}
// Strict: a JSON integer >= 1. Rejects "3", 3.5, true, null, etc.
$courseId = is_array($body) ? ($body['course_id'] ?? null) : null;
if (!is_int($courseId) || $courseId < 1) {
    send_error(400, 'invalid_course_id', 'course_id must be a positive integer.');
}

// --- Business rules ---------------------------------------------------------
$stmt = db()->prepare('SELECT id, code, is_active FROM courses WHERE id = ?');
$stmt->execute([$courseId]);
$course = $stmt->fetch();
if ($course === false) {
    send_error(404, 'course_not_found', 'No course with that id.');
}
if (!$course['is_active']) {
    // A student who already took a since-retired course should hear that, not "not open".
    $existing = enrollment_status((int) $student['id'], $courseId);
    if ($existing !== null) {
        send_error(409, 'already_enrolled', already_enrolled_message($existing, $course['code']));
    }
    send_error(422, 'course_inactive', "{$course['code']} is not open for enrollment.");
}

// --- Enroll -----------------------------------------------------------------
// No "is the student already enrolled?" SELECT first: two clicks or two tabs
// could both pass it. The UNIQUE (student_id, course_id) key is the real guard;
// we insert and translate a duplicate-key error into a 409.
try {
    db()->prepare('INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)')
        ->execute([$student['id'], $courseId]);
} catch (PDOException $e) {
    if (($e->errorInfo[1] ?? null) !== 1062) { // 1062 = MySQL duplicate key
        throw $e; // anything else is unexpected: the global handler sends a 500
    }
    $existing = enrollment_status((int) $student['id'], $courseId) ?? 'in_progress';
    send_error(409, 'already_enrolled', already_enrolled_message($existing, $course['code']));
}

send_data(['course' => student_courses((int) $student['id'], courseId: $courseId)[0]], 201);

/** The student's enrollment status in a course, or null if not enrolled. */
function enrollment_status(int $studentId, int $courseId): ?string
{
    $stmt = db()->prepare('SELECT status FROM enrollments WHERE student_id = ? AND course_id = ?');
    $stmt->execute([$studentId, $courseId]);
    $status = $stmt->fetchColumn();
    return $status === false ? null : $status;
}

/**
 * Tell the student *why* they can't enroll. Re-enrolling after a withdrawal
 * is deliberately not self-serve: it's a school process, not a button.
 */
function already_enrolled_message(string $status, string $code): string
{
    return match ($status) {
        'completed' => "You have already completed $code.",
        'withdrawn' => "You withdrew from $code. Please contact Guidance to re-enroll.",
        default     => "You are already enrolled in $code.",
    };
}
