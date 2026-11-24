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
require_once __DIR__ . '/../../src/marks.php';

require_method('GET');
$student = current_student();

const STATUSES = ['in_progress', 'completed', 'withdrawn'];
$status = $_GET['status'] ?? null;
if ($status !== null && $status !== '' && !in_array($status, STATUSES, true)) {
    send_error(400, 'invalid_status', 'status must be one of: ' . implode(', ', STATUSES) . '.');
}
$status = $status ?: null;

// --- Query 1: the student's enrollments -------------------------------------
// In-progress courses first (what the student is working on), then completed,
// then withdrawn; alphabetical by code within each group.
$sql = '
    SELECT e.id AS enrollment_id, e.status, e.progress_percent, e.enrolled_at, e.completed_at,
           c.id AS course_id, c.code, c.title, c.grade, c.credit_value
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    WHERE e.student_id = :student_id';
$params = ['student_id' => $student['id']];
if ($status !== null) {
    $sql .= ' AND e.status = :status';
    $params['status'] = $status;
}
$sql .= " ORDER BY FIELD(e.status, 'in_progress', 'completed', 'withdrawn'), c.code";

$stmt = db()->prepare($sql);
$stmt->execute($params);
$enrollments = $stmt->fetchAll();

// --- Query 2: evaluations for all of those courses, with this student's result
// One query for every course (not one per course). LEFT JOIN keeps
// evaluations the student hasn't started; se.id IS NULL means "no row".
$evaluationsByCourse = [];
if ($enrollments) {
    $courseIds = array_column($enrollments, 'course_id');
    $placeholders = implode(',', array_fill(0, count($courseIds), '?'));
    $stmt = db()->prepare("
        SELECT ce.id, ce.course_id, ce.name, ce.category, ce.weight_percent, ce.out_of, ce.position,
               se.id AS result_id, se.score, se.graded_at
        FROM course_evaluations ce
        LEFT JOIN student_evaluations se
               ON se.course_evaluation_id = ce.id AND se.student_id = ?
        WHERE ce.course_id IN ($placeholders)
        ORDER BY ce.course_id, ce.position");
    $stmt->execute([$student['id'], ...$courseIds]);

    foreach ($stmt->fetchAll() as $row) {
        $evalStatus = evaluation_status($row['result_id'] !== null, $row['score']);
        $outOf = (float) $row['out_of'];
        $score = $evalStatus === 'graded' ? (float) $row['score'] : null;

        $evaluationsByCourse[$row['course_id']][] = [
            'id'             => (int) $row['id'],
            'name'           => $row['name'],
            'category'       => $row['category'],
            'weight_percent' => (float) $row['weight_percent'],
            'out_of'         => $outOf,
            'status'         => $evalStatus,
            'score'          => $score,
            'percent'        => $score !== null && $outOf > 0 ? round($score / $outOf * 100, 1) : null,
            'graded_at'      => $row['graded_at'],
        ];
    }
}

// --- Shape the response -----------------------------------------------------
$courses = array_map(function (array $e) use ($evaluationsByCourse): array {
    $evaluations = $evaluationsByCourse[$e['course_id']] ?? [];
    return [
        'enrollment_id'    => (int) $e['enrollment_id'],
        'course_id'        => (int) $e['course_id'],
        'code'             => $e['code'],
        'title'            => $e['title'],
        'grade'            => (int) $e['grade'],
        'credit_value'     => (float) $e['credit_value'],
        'status'           => $e['status'],
        'progress_percent' => (int) $e['progress_percent'],
        'enrolled_at'      => $e['enrolled_at'],
        'completed_at'     => $e['completed_at'],
        'mark'             => course_mark($evaluations),
        'evaluations'      => $evaluations,
    ];
}, $enrollments);

send_data([
    'student' => [
        'id'         => (int) $student['id'],
        'first_name' => $student['first_name'],
        'last_name'  => $student['last_name'],
    ],
    'courses' => $courses,
]);
