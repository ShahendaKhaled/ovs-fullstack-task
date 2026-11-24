<?php
declare(strict_types=1);

/**
 * Mark calculations. Pure functions (no DB, no HTTP) so they are easy to test.
 */

/**
 * Where a student stands on one evaluation, from the student_evaluations row:
 *   no row          -> not_started
 *   row, NULL score -> submitted (awaiting grade)
 *   row with score  -> graded
 */
function evaluation_status(bool $hasRow, ?string $score): string
{
    if (!$hasRow) {
        return 'not_started';
    }
    return $score === null ? 'submitted' : 'graded';
}

/**
 * Overall course mark as a weighted average of *graded* evaluations only.
 *
 * Each graded evaluation contributes (score / out_of) * weight. The total is
 * divided by the sum of the graded weights, not by 100, so evaluations that
 * aren't graded yet don't count as zeros. Example: 80% on a 10%-weight quiz
 * and 75% on a 20%-weight assignment gives (8 + 15) / 30 = 76.7%.
 *
 * @param array<array{status:string, score:?float, out_of:float, weight_percent:float}> $evaluations
 * @return array{percent:?float, graded_weight_percent:float}
 *         percent is null when nothing is graded yet (no mark, rather than 0%).
 */
function course_mark(array $evaluations): array
{
    $earned = 0.0;
    $gradedWeight = 0.0;
    foreach ($evaluations as $e) {
        if ($e['status'] !== 'graded' || $e['out_of'] <= 0) {
            continue; // out_of <= 0 would be bad data; skip it rather than divide by zero
        }
        $earned += ($e['score'] / $e['out_of']) * $e['weight_percent'];
        $gradedWeight += $e['weight_percent'];
    }

    return [
        'percent'               => $gradedWeight > 0 ? round($earned / $gradedWeight * 100, 1) : null,
        'graded_weight_percent' => round($gradedWeight, 2),
    ];
}
