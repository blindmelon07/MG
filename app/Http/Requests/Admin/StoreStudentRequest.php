<?php

namespace App\Http\Requests\Admin;

use App\Rules\PhilippineMobileNumber;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStudentRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'student_number' => ['nullable', 'string', 'max:255', 'unique:students,student_number'],
            'grade_level' => ['nullable', 'string', 'max:255'],
            'section' => ['nullable', 'string', 'max:255'],
            'phone_number' => ['nullable', 'string', new PhilippineMobileNumber],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'guardians' => ['required', 'array', 'min:1'],
            'guardians.*.name' => ['required', 'string', 'max:255'],
            'guardians.*.relationship' => ['required', 'string', 'max:100'],
            'guardians.*.phone_number' => ['required', 'string', new PhilippineMobileNumber],
        ];
    }
}
