-- ============================================================
-- OVS Full Stack Take-Home — starter database
-- MySQL 8.x. Run this before you begin.
--   mysql -u root -p < schema_and_seed.sql
-- This gives you a small, realistic slice of an LMS so you can
-- spend your time on the feature, not on boilerplate.
-- ============================================================

DROP DATABASE IF EXISTS ovs_takehome;
CREATE DATABASE ovs_takehome CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ovs_takehome;

CREATE TABLE students (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20)  NOT NULL UNIQUE,   -- e.g. 'ENG4U'
  title         VARCHAR(255) NOT NULL,
  grade         SMALLINT     NOT NULL,          -- 6..12
  credit_value  DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1
);

CREATE TABLE enrollments (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  student_id        INT NOT NULL,
  course_id         INT NOT NULL,
  status            ENUM('in_progress','completed','withdrawn') NOT NULL DEFAULT 'in_progress',
  progress_percent  TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- 0..100
  enrolled_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at      TIMESTAMP NULL,
  UNIQUE KEY uniq_student_course (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id)  REFERENCES courses(id)
);

-- The evaluations (assessments) that make up each course.
-- weight_percent is that evaluation's share of the final course mark;
-- per course the weights are intended to sum to 100.
CREATE TABLE course_evaluations (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  course_id       INT NOT NULL,
  name            VARCHAR(150) NOT NULL,                 -- e.g. 'Final Exam'
  category        ENUM('quiz','assignment','test','exam','project') NOT NULL,
  weight_percent  DECIMAL(5,2) NOT NULL,                 -- share of final mark
  out_of          DECIMAL(6,2) NOT NULL DEFAULT 100.00,  -- maximum score
  position        SMALLINT NOT NULL DEFAULT 1,           -- display order
  UNIQUE KEY uniq_course_eval (course_id, name),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- A student's result on a single course evaluation.
-- score is NULL when the evaluation has been assigned/submitted but
-- not yet graded; rows are simply absent for evaluations not started.
CREATE TABLE student_evaluations (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  student_id            INT NOT NULL,
  course_evaluation_id  INT NOT NULL,
  score                 DECIMAL(6,2) NULL,               -- marks earned, out of course_evaluations.out_of
  graded_at             TIMESTAMP NULL,
  UNIQUE KEY uniq_student_eval (student_id, course_evaluation_id),
  FOREIGN KEY (student_id)           REFERENCES students(id),
  FOREIGN KEY (course_evaluation_id) REFERENCES course_evaluations(id)
);

-- --- seed: students -------------------------------------------
INSERT INTO students (first_name, last_name, email) VALUES
  ('Amara', 'Okafor',   'amara.okafor@example.com'),
  ('Liam',  'Tremblay', 'liam.tremblay@example.com'),
  ('Mei',   'Chen',     'mei.chen@example.com');

-- --- seed: courses --------------------------------------------
INSERT INTO courses (code, title, grade, credit_value, is_active) VALUES
  ('ENG4U', 'English',                       12, 1.0, 1),
  ('MHF4U', 'Advanced Functions',            12, 1.0, 1),
  ('SCH4U', 'Chemistry',                     12, 1.0, 1),
  ('SBI4U', 'Biology',                        12, 1.0, 1),
  ('MCV4U', 'Calculus and Vectors',          12, 1.0, 1),
  ('CGC1D', 'Issues in Canadian Geography',   9, 1.0, 1),
  ('SNC2D', 'Science',                        10, 1.0, 1),
  ('MPM1D', 'Principles of Mathematics',       9, 1.0, 0);  -- inactive

-- --- seed: enrollments ----------------------------------------
INSERT INTO enrollments (student_id, course_id, status, progress_percent, completed_at) VALUES
  (1, 1, 'completed',   100, NOW()),
  (1, 2, 'in_progress',  45, NULL),
  (1, 3, 'in_progress',  10, NULL),
  (2, 1, 'in_progress',  80, NULL),
  (2, 5, 'withdrawn',    25, NULL),
  (3, 4, 'in_progress',  60, NULL);

-- --- seed: course_evaluations ---------------------------------
-- Give every active course the same four-evaluation structure
-- (weights sum to 100). Generated from the course list.
INSERT INTO course_evaluations (course_id, name, category, weight_percent, out_of, position)
SELECT c.id, x.name, x.category, x.weight_percent, x.out_of, x.position
FROM courses c
JOIN (
            SELECT 'Quiz 1'       AS name, 'quiz'       AS category, 10.00 AS weight_percent, 20.00  AS out_of, 1 AS position
  UNION ALL SELECT 'Assignment 1',        'assignment',                20.00,                 40.00,           2
  UNION ALL SELECT 'Midterm Test',        'test',                      30.00,                 60.00,           3
  UNION ALL SELECT 'Final Exam',          'exam',                      40.00,                 100.00,          4
) x
WHERE c.is_active = 1;

-- --- seed: student_evaluations --------------------------------
-- Marks are looked up by (student email, course code, evaluation position)
-- so this stays readable. score = NULL means submitted but not yet graded.
INSERT INTO student_evaluations (student_id, course_evaluation_id, score, graded_at)
SELECT s.id, ce.id, v.score,
       CASE WHEN v.score IS NULL THEN NULL ELSE NOW() END
FROM (
            SELECT 'amara.okafor@example.com'  AS email, 'ENG4U' AS code, 1 AS position, 18.0 AS score  -- completed course
  UNION ALL SELECT 'amara.okafor@example.com',         'ENG4U',          2,              34.0
  UNION ALL SELECT 'amara.okafor@example.com',         'ENG4U',          3,              51.0
  UNION ALL SELECT 'amara.okafor@example.com',         'ENG4U',          4,              88.0
  UNION ALL SELECT 'amara.okafor@example.com',         'MHF4U',          1,              16.0  -- in progress, 2 graded
  UNION ALL SELECT 'amara.okafor@example.com',         'MHF4U',          2,              30.0
  UNION ALL SELECT 'amara.okafor@example.com',         'SCH4U',          1,              14.0  -- just started
  UNION ALL SELECT 'liam.tremblay@example.com',        'ENG4U',          1,              12.0
  UNION ALL SELECT 'liam.tremblay@example.com',        'ENG4U',          2,              28.0
  UNION ALL SELECT 'liam.tremblay@example.com',        'ENG4U',          3,              45.0
  UNION ALL SELECT 'liam.tremblay@example.com',        'MCV4U',          1,              10.0  -- withdrawn course
  UNION ALL SELECT 'mei.chen@example.com',             'SBI4U',          1,              17.0
  UNION ALL SELECT 'mei.chen@example.com',             'SBI4U',          2,              36.0
  UNION ALL SELECT 'mei.chen@example.com',             'SBI4U',          3,              NULL  -- submitted, awaiting grade
) v
JOIN students s           ON s.email = v.email
JOIN courses  c           ON c.code  = v.code
JOIN course_evaluations ce ON ce.course_id = c.id AND ce.position = v.position;
