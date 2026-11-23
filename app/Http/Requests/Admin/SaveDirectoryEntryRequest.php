<?php

namespace App\Http\Requests\Admin;

use App\Models\DirectoryEntry;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveDirectoryEntryRequest extends FormRequest
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
            'category' => ['required', Rule::in(DirectoryEntry::CATEGORIES)],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            // A hotline is nothing without a number.
            'phone' => ['nullable', 'required_if:category,hotline', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'office_hours' => ['nullable', 'string', 'max:255'],
            'room' => ['nullable', 'string', 'max:255'],
            'floor_room' => ['nullable', 'string', 'max:50', 'regex:/^[a-z0-9-]+$/'],
            'campus_location_id' => ['nullable', 'integer', 'exists:campus_locations,id'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function entry(): array
    {
        return [...$this->validated(), 'sort_order' => (int) $this->input('sort_order', 0)];
    }
}
