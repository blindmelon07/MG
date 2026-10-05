<?php

namespace App\Http\Requests\Admin;

use App\Models\Announcement;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAnnouncementRequest extends FormRequest
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
            'campus_location_id' => ['nullable', 'integer', 'exists:campus_locations,id'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'audience' => ['required', Rule::in(['all', 'targeted', 'none'])],
            'student_ids' => ['required_if:audience,targeted', 'array'],
            'student_ids.*' => ['integer', 'exists:students,id'],
            'personnel_roles' => ['required_if:audience,none', 'array'],
            'personnel_roles.*' => [Rule::in(array_keys(Announcement::PERSONNEL_ROLES))],
            'media' => ['nullable', 'array', 'max:10'],
            'media.*' => ['file', 'mimes:jpeg,jpg,png,gif,webp,mp4,webm,mov', 'max:20480'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'personnel_roles.required_if' => 'Choose at least one personnel group when no students receive this.',
        ];
    }
}
