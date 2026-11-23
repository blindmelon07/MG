<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['category', 'question', 'answer', 'keywords', 'is_active'])]
class ChatbotFaq extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'keywords' => 'array',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return HasMany<ChatbotLog, $this>
     */
    public function logs(): HasMany
    {
        return $this->hasMany(ChatbotLog::class, 'matched_faq_id');
    }
}
