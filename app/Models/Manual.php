<?php

namespace App\Models;

use Database\Factories\ManualFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Fillable(['manual_category_id', 'created_by', 'title', 'slug', 'content', 'status', 'sort_order', 'published_at'])]
class Manual extends Model
{
    /** @use HasFactory<ManualFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<Manual>  $query
     * @return Builder<Manual>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }

    /**
     * Category by category, each in the order the admin set.
     *
     * @param  Builder<Manual>  $query
     * @return Builder<Manual>
     */
    public function scopeInReadingOrder(Builder $query): Builder
    {
        $category = fn (string $column) => ManualCategory::select($column)->whereColumn('manual_categories.id', 'manuals.manual_category_id');

        return $query->orderBy($category('sort_order'))
            ->orderBy($category('name'))
            ->orderBy('sort_order')
            ->orderBy('title');
    }

    /**
     * Number the manuals of a category 1, 2, 3... in their current order.
     */
    public static function renumber(int $categoryId): void
    {
        static::where('manual_category_id', $categoryId)
            ->orderBy('sort_order')
            ->orderBy('title')
            ->pluck('id')
            ->each(fn (int $id, int $index) => static::whereKey($id)->update(['sort_order' => $index + 1]));
    }

    /**
     * @return BelongsTo<ManualCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(ManualCategory::class, 'manual_category_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return MorphMany<Media, $this>
     */
    public function media(): MorphMany
    {
        return $this->morphMany(Media::class, 'mediable');
    }
}
