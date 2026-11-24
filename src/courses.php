<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/serializers.php';

const ENROLLMENT_STATUSES = ['in_progress', 'completed', 'withdrawn'];

/**
 * A student's enrolled courses, each with progress, overall mark and the
 * evaluation breakdown. Shared by GET /api/courses.php (the list) and
 * POST /api/enrollments.php (returns the new course in the same shape).
 *
 * @param string|null $status   only enrollments with this status
 * @param int|null    $courseId only this course (used after enrolling)
 */
function student_courses(int $studentId, ?string $status = null, ?int $courseId = null): array
{
    // --- Query 1: the student's enrollments -------------------------------------
    // In-progress courses first (what the student is working on), then completed,
    // then withdrawn; alphabetical by code within each group.
    $sql = '
        SELECT e.id AS enrollment_id, e.status, e.progress_percent, e.enrolled_at, e.completed_at,
               c.id AS course_id, c.code, c.title, c.grade, c.credit_value
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        WHERE e.student_id = :student_id';
    $params = ['student_id' => $studentId];
    if ($status !== null) {
        $sql .= ' AND e.status = :status';
        $params['status'] = $status;
    }
    if ($courseId !== null) {
        $sql .= ' AND e.course_id = :course_id';
        $params['course_id'] = $courseId;
    }
    $sql .= " ORDER BY FIELD(e.status, 'in_progress', 'completed', 'withdrawn'), c.code";

    $orderedStudentCoursesStatement = db()->prepare($sql);
    $orderedStudentCoursesStatement->execute($params);
    $enrollments = $orderedStudentCoursesStatement->fetchAll();

    // --- Query 2: evaluations for all of those courses, with this student's result
    // One query for every course (not one per course). LEFT JOIN keeps
    // evaluations the student hasn't started; se.id IS NULL means "no row".
    $evaluationsByCourse = [];
    if ($enrollments) {
        $courseIds = array_column($enrollments, 'course_id');
        $placeholders = implode(',', array_fill(0, count($courseIds), '?'));
        $studentCourseEvaluationsStatement = db()->prepare("
            SELECT ce.id, ce.course_id, ce.name, ce.category, ce.weight_percent, ce.out_of, ce.position,
                   se.id AS result_id, se.score, se.graded_at
            FROM course_evaluations ce
            LEFT JOIN student_evaluations se
                   ON se.course_evaluation_id = ce.id AND se.student_id = ?
            WHERE ce.course_id IN ($placeholders)
            ORDER BY ce.course_id, ce.position");
        $studentCourseEvaluationsStatement->execute([$studentId, ...$courseIds]);

        foreach ($studentCourseEvaluationsStatement->fetchAll() as $row) {
            $evaluationsByCourse[$row['course_id']][] = serialize_evaluation($row);
        }
    }

    // --- Shape each course -----------------------------------------------------
    return array_map(
        fn (array $e): array => serialize_enrolled_course($e, $evaluationsByCourse[$e['course_id']] ?? []),
        $enrollments
    );
}
