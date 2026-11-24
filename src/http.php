<?php
declare(strict_types=1);

require_once __DIR__ . '/security_headers.php';

/**
 * JSON response helpers. Every response has one of two shapes:
 *   success: {"data": ...}
 *   failure: {"error": {"code": "machine_readable", "message": "Human readable"}}
 */
function send_json(int $status, array $body): never
{
    http_response_code($status);
    send_security_headers();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store'); // student data: don't let browsers/proxies cache it
    // THROW_ON_ERROR: if encoding fails (e.g. invalid UTF-8 in the data), throw
    // so the handler below sends a 500, instead of echoing false (an empty 200).
    echo json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}

function send_data(array $data, int $status = 200): never
{
    send_json($status, ['data' => $data]);
}

function send_error(int $status, string $code, string $message): never
{
    send_json($status, ['error' => ['code' => $code, 'message' => $message]]);
}

function require_method(string $method): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        header('Allow: ' . $method);
        send_error(405, 'method_not_allowed', "Use $method for this endpoint.");
    }
}

// --- Unexpected failures: log the details server-side, never leak them to the client.

// PHP errors must never be printed into the response: that would corrupt the
// JSON and send output before our headers. They still go to the error log.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Turn warnings/notices (e.g. "Undefined array key") into exceptions, so a bug
// fails loudly as a clean 500 instead of returning half-right data.
// Respects error_reporting and the @ operator.
set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

set_exception_handler(function (Throwable $e): void {
    error_log((string) $e);
    send_error(500, 'internal_error', 'Something went wrong. Please try again.');
});

// Fatal errors (e.g. out of memory) skip both handlers above; still answer in
// our JSON shape if nothing has been sent yet. PHP has already logged them.
register_shutdown_function(function (): void {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)
        && !headers_sent()) {
        send_error(500, 'internal_error', 'Something went wrong. Please try again.');
    }
});
