<?php
declare(strict_types=1);

/**
 * Security headers for API (JSON) responses.
 *
 * The HTML page and static files get their headers from the web server, not
 * PHP (see docs/nginx-security-headers.conf), which is also where HSTS lives
 * since only the HTTPS layer can set it. Locally, `php -S` serves static
 * files without them; that is accepted for development.
 */

// JSON API: a response should never load or run anything (OWASP REST guidance).
const CSP_API = "default-src 'none'; frame-ancestors 'none'";

function send_security_headers(): void
{
    header_remove('X-Powered-By');                 // don't advertise the PHP version
    header('Content-Security-Policy: ' . CSP_API);
    header('X-Content-Type-Options: nosniff');     // don't guess content types
    header('X-Frame-Options: DENY');               // no framing (clickjacking); older-browser twin of frame-ancestors
    header('Referrer-Policy: no-referrer');        // don't leak our URLs to other sites
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
}
