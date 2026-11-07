<?php

namespace App\Support;

use Carbon\CarbonInterface;
use Illuminate\Http\Request;

/**
 * Where and when a sign-in attempt came from, as shown in login alerts.
 */
final readonly class LoginAttempt
{
    public const SUCCEEDED = 'succeeded';

    public const FAILED = 'failed';

    /** The password was right but the two-factor code was wrong. */
    public const TWO_FACTOR_FAILED = 'two_factor_failed';

    public function __construct(
        public string $outcome,
        public CarbonInterface $at,
        public ?string $ip,
        public string $device,
    ) {}

    public static function from(Request $request, string $outcome): self
    {
        return new self(
            $outcome,
            now()->setTimezone(config('security.login_alerts.timezone')),
            $request->ip(),
            self::describeDevice((string) $request->userAgent()),
        );
    }

    public function time(): string
    {
        return $this->at->format('M j, Y g:i A');
    }

    /**
     * A short "Browser on OS" description of a user agent.
     */
    public static function describeDevice(string $userAgent): string
    {
        $browser = match (true) {
            str_contains($userAgent, 'Edg/') => 'Edge',
            str_contains($userAgent, 'OPR/') || str_contains($userAgent, 'Opera') => 'Opera',
            str_contains($userAgent, 'SamsungBrowser') => 'Samsung Internet',
            str_contains($userAgent, 'Firefox/') => 'Firefox',
            str_contains($userAgent, 'Chrome/') || str_contains($userAgent, 'CriOS/') => 'Chrome',
            str_contains($userAgent, 'Safari/') => 'Safari',
            default => null,
        };

        $os = match (true) {
            str_contains($userAgent, 'Android') => 'Android',
            str_contains($userAgent, 'iPhone') || str_contains($userAgent, 'iPad') => 'iOS',
            str_contains($userAgent, 'Windows') => 'Windows',
            str_contains($userAgent, 'Mac OS X') || str_contains($userAgent, 'Macintosh') => 'macOS',
            str_contains($userAgent, 'CrOS') => 'ChromeOS',
            str_contains($userAgent, 'Linux') => 'Linux',
            default => null,
        };

        return match (true) {
            $browser !== null && $os !== null => "{$browser} on {$os}",
            $browser !== null || $os !== null => (string) ($browser ?? $os),
            default => 'an unknown device',
        };
    }
}
