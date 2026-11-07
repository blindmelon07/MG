<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | When the app runs behind a load balancer, reverse proxy or Cloudflare,
    | list the proxy addresses here so the visitor's real IP address (from
    | X-Forwarded-For) is used in login alerts, the grade change history and
    | rate limits. Leave empty when visitors connect to the server directly:
    | trusting proxies that aren't there lets anyone fake their IP address.
    |
    | Comma-separated IPs or CIDR ranges, e.g. "10.0.0.0/8,172.16.0.0/12",
    | or "*" to trust whichever proxy the request came through.
    |
    */

    'proxies' => env('TRUSTED_PROXIES') ?: null,

];
