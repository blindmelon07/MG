<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * A school year such as "2026-2027". One is marked current; staff can pick
 * another to look back at that year's enrollment and grades.
 *
 * @property int $id
 * @property string $name
 * @property bool $is_current
 */
#[Fillable(['name', 'is_current'])]
class SchoolYear extends Model
{
    /** Session key holding the school year a staff member is viewing. */
    public const SESSION_KEY = 'school_year';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_current' => 'boolean',
        ];
    }

    public static function isValidName(?string $name): bool
    {
        if ($name === null || ! preg_match('/^(\d{4})-(\d{4})$/', $name, $matches)) {
            return false;
        }

        return (int) $matches[2] === (int) $matches[1] + 1;
    }

    /**
     * The school year a date falls in. Classes start in June, so June 2026 to May 2027 is 2026-2027.
     */
    public static function nameFor(Carbon $date): string
    {
        $start = $date->month >= 6 ? $date->year : $date->year - 1;

        return $start.'-'.($start + 1);
    }

    /**
     * The school year marked current, or today's when none is.
     */
    public static function current(): string
    {
        return static::where('is_current', true)->value('name') ?? self::nameFor(now());
    }

    /**
     * The school year the signed-in staff member chose to view, or the current one.
     */
    public static function selected(): string
    {
        $chosen = session(self::SESSION_KEY);

        if (is_string($chosen) && static::where('name', $chosen)->exists()) {
            return $chosen;
        }

        return self::current();
    }

    /**
     * Every school year, newest first, always including the current one.
     *
     * @return Collection<int, string>
     */
    public static function names(): Collection
    {
        return static::pluck('name')->push(self::current())->unique()->sortDesc()->values();
    }

    public function makeCurrent(): void
    {
        DB::transaction(function (): void {
            static::where('is_current', true)->update(['is_current' => false]);
            $this->forceFill(['is_current' => true])->save();
        });
    }
}
