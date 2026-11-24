<?php
declare(strict_types=1);

/**
 * GET /api/catalogue.php
 * Header: X-Student-Id: <id>
 *
 * Active courses open for enrollment. Each carries the current student's
 * enrollment status (null = not enrolled), so the page can show which ones
 * the student can still enroll in without a second request.
 * Inactive courses are left out entirely.
 *
 * 200 {"data": {"courses": [{"id", "code", "title", "grade", "credit_value", "enrollment_status"}]}}
 * 401 unauthenticated · 405 method_not_allowed
 */

require_once __DIR__ . '/../../src/http.php'; // first: installs the error handlers
require_once __DIR__ . '/../../src/db.php';
require_once __DIR__ . '/../../src/auth.php';
require_once __DIR__ . '/../../src/serializers.php';

require_method('GET');
$student = current_student();

// LEFT JOIN on this student only: every active course appears once, with the
// student's enrollment status if they have one (the unique key on
// enrollments(student_id, course_id) guarantees at most one match).
$stmt = db()->prepare('
    SELECT c.id, c.code, c.title, c.grade, c.credit_value, e.status AS enrollment_status
    FROM courses c
    LEFT JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
    WHERE c.is_active = 1
    ORDER BY c.grade, c.code');
$stmt->execute([$student['id']]);

$courses = array_map('serialize_catalogue_course', $stmt->fetchAll());

send_data(['courses' => $courses]);
