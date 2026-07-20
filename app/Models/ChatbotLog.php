<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['session_id', 'question', 'matched_faq_id', 'answer', 'was_helpful'])]
class ChatbotLog extends Model
{
    public const UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'was_helpful' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<ChatbotFaq, $this>
     */
    public function matchedFaq(): BelongsTo
    {
        return $this->belongsTo(ChatbotFaq::class, 'matched_faq_id');
    }
}
