<?php

namespace App\Models;

use Database\Factories\DirectoryEntryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An office or hotline in the kiosk's School Directory.
 */
#[Fillable(['category', 'name', 'description', 'phone', 'email', 'office_hours', 'room', 'floor_room', 'campus_location_id', 'sort_order'])]
class DirectoryEntry extends Model
{
    /** @use HasFactory<DirectoryEntryFactory> */
    use HasFactory;

    public const CATEGORIES = ['office', 'hotline'];

    /**
     * @return BelongsTo<CampusLocation, $this>
     */
    public function campusLocation(): BelongsTo
    {
        return $this->belongsTo(CampusLocation::class);
    }
}
