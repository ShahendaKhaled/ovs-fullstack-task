<?php
declare(strict_types=1);

/**
 * Who is making the request.
 *
 * The brief says auth is out of scope and the student id is "passed in".
 * It is passed as an X-Student-Id header, standing in for a server-side
 * session: endpoints only ever act on the *current* student and never take
 * a "which student" parameter, so one student can't ask for another's data.
 * In production this function would read the id from the session instead
 * and nothing else would change.
 */
function current_student(): array
{
    $raw = $_SERVER['HTTP_X_STUDENT_ID'] ?? '';
    $id = filter_var($raw, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false) {
        send_error(401, 'unauthenticated', 'Missing or invalid X-Student-Id header.');
    }

    $findStudentStatement = db()->prepare('SELECT id, first_name, last_name FROM students WHERE id = ?');
    $findStudentStatement->execute([$id]);
    $student = $findStudentStatement->fetch();
    if ($student === false) {
        send_error(401, 'unauthenticated', 'Unknown student.');
    }
    return $student;
}
