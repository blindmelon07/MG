<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Translation\PotentiallyTranslatedString;

class PhilippineMobileNumber implements ValidationRule
{
    /** Exactly 11 digits, as written locally: 09XXXXXXXXX. */
    public const PATTERN = '/^09\d{9}$/';

    /**
     * Run the validation rule.
     *
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! preg_match(self::PATTERN, $value)) {
            $fail('The :attribute must be exactly 11 digits, starting with 09 (e.g. 09171234567).');
        }
    }
}
