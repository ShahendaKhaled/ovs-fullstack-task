<?php
declare(strict_types=1);

/**
 * GET /api/courses.php[?status=in_progress|completed|withdrawn]
 * Header: X-Student-Id: <id>
 *
 * The current student's enrolled courses, each with progress, overall mark
 * and the evaluation breakdown.
 *
 * 200 {"data": {"student": {...}, "courses": [...]}}
 * 400 invalid status filter · 401 missing/unknown student · 405 wrong method
 */

require_once __DIR__ . '/../../src/http.php'; // first: installs the error handlers
require_once __DIR__ . '/../../src/db.php';
require_once __DIR__ . '/../../src/auth.php';
require_once __DIR__ . '/../../src/courses.php';
require_once __DIR__ . '/../../src/serializers.php';

require_method('GET');
$student = current_student();

$status = $_GET['status'] ?? '';
if ($status !== '' && !in_array($status, ENROLLMENT_STATUSES, true)) {
    send_error(400, 'invalid_status', 'status must be one of: ' . implode(', ', ENROLLMENT_STATUSES) . '.');
}

send_data([
    'student' => serialize_student($student),
    'courses' => student_courses((int) $student['id'], $status ?: null),
]);
