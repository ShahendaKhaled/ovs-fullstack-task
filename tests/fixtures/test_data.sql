-- Extra data the tests need on top of db/schema_and_seed.sql (loaded by `npm run db:reset`).
-- Run as an admin: the app's DB user can't write this.

USE ovs_takehome;

-- Liam completed MPM1D before it was retired (made inactive). Enrolling again must
-- say "already completed" (409), not "not open for enrollment" (422).
INSERT INTO enrollments (student_id, course_id, status, progress_percent, completed_at)
SELECT s.id, c.id, 'completed', 100, NOW()
FROM students s JOIN courses c ON c.code = 'MPM1D'
WHERE s.email = 'liam.tremblay@example.com';
