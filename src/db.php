<?php
declare(strict_types=1);

/**
 * Shared PDO connection.
 *
 * Credentials come from environment variables, with defaults matching
 * db/create_app_user.sql so a clean checkout runs with no config.
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            getenv('DB_HOST') ?: 'localhost',
            getenv('DB_PORT') ?: '3306',
            getenv('DB_NAME') ?: 'ovs_takehome'
        );
        $pdo = new PDO($dsn, getenv('DB_USER') ?: 'ovs_app', getenv('DB_PASS') ?: 'ovs_app_dev_pw', [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            // Real server-side prepared statements, not client-side string interpolation.
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}
