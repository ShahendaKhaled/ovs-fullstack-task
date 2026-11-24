<?php
declare(strict_types=1);

require_once __DIR__ . '/marks.php';

/**
 * Resource shapes: turn DB rows into the objects the API returns.
 * One function per resource. The response envelope ({"data": ...}) and the
 * error shape are built in http.php, and each endpoint picks the data keys.
 * Casts happen here because PDO returns numbers from MySQL as strings.
 */

/** GET /api/courses.php: data.student */
function serialize_student(array $row): array
{
    return [
        'id'         => (int) $row['id'],
        'first_name' => $row['first_name'],
        'last_name'  => $row['last_name'],
    ];
}

/**
 * One evaluation with this student's result. $row is a course_evaluations row
 * LEFT JOINed to student_evaluations (result_id is null when there's no result).
 */
function serialize_evaluation(array $row): array
{
    $status = evaluation_status($row['result_id'] !== null, $row['score']);
    $outOf = (float) $row['out_of'];
    $score = $status === 'graded' ? (float) $row['score'] : null;

    return [
        'id'             => (int) $row['id'],
        'name'           => $row['name'],
        'category'       => $row['category'],
        'weight_percent' => (float) $row['weight_percent'],
        'out_of'         => $outOf,
        'status'         => $status,
        'score'          => $score,
        'percent'        => $score !== null && $outOf > 0 ? round($score / $outOf * 100, 1) : null,
        'graded_at'      => $row['graded_at'],
    ];
}

/**
 * An enrolled course, used by GET /api/courses.php and POST /api/enrollments.php.
 *
 * @param array $evaluations already serialized with serialize_evaluation()
 */
function serialize_enrolled_course(array $row, array $evaluations): array
{
    return [
        'enrollment_id'    => (int) $row['enrollment_id'],
        'course_id'        => (int) $row['course_id'],
        'code'             => $row['code'],
        'title'            => $row['title'],
        'grade'            => (int) $row['grade'],
        'credit_value'     => (float) $row['credit_value'],
        'status'           => $row['status'],
        'progress_percent' => (int) $row['progress_percent'],
        'enrolled_at'      => $row['enrolled_at'],
        'completed_at'     => $row['completed_at'],
        'mark'             => course_mark($evaluations),
        'evaluations'      => $evaluations,
    ];
}

/** GET /api/catalogue.php: one course open for enrollment (enrollment_status null = not enrolled). */
function serialize_catalogue_course(array $row): array
{
    return [
        'id'                => (int) $row['id'],
        'code'              => $row['code'],
        'title'             => $row['title'],
        'grade'             => (int) $row['grade'],
        'credit_value'      => (float) $row['credit_value'],
        'enrollment_status' => $row['enrollment_status'],
    ];
}
