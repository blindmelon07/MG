<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAnnouncementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
            'type' => ['required', Rule::in(['announcement', 'event'])],
            'event_start_at' => ['nullable', 'date', 'required_if:type,event'],
            'event_end_at' => ['nullable', 'date', 'after_or_equal:event_start_at'],
            'location' => ['nullable', 'string', 'max:255'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'audience' => ['required', Rule::in(['all', 'targeted'])],
            'student_ids' => ['required_if:audience,targeted', 'array'],
            'student_ids.*' => ['integer', 'exists:students,id'],
        ];
    }
}
