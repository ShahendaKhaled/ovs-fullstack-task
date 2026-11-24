-- Least-privilege MySQL user for the PHP app (local development only).
-- The app only reads data and inserts enrollments, so that is all it may do.
-- Run as an admin after schema_and_seed.sql:
--   sudo mysql < db/create_app_user.sql      (or: mysql -u root -p < ...)
-- Change the password for anything beyond local dev.

CREATE USER IF NOT EXISTS 'ovs_app'@'localhost' IDENTIFIED BY 'ovs_app_dev_pw';
GRANT SELECT ON ovs_takehome.* TO 'ovs_app'@'localhost';
GRANT INSERT ON ovs_takehome.enrollments TO 'ovs_app'@'localhost';
FLUSH PRIVILEGES;
