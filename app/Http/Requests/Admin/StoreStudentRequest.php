<?php

namespace App\Http\Requests\Admin;

use App\Models\Student;
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
            'student_number' => ['required', 'string', 'max:255', 'unique:students,student_number'],
            'education_level' => ['required', Rule::in(array_keys(Student::EDUCATION_LEVELS))],
            'grade_level' => ['required', 'string', Rule::in(Student::EDUCATION_LEVELS[$this->string('education_level')->toString()]['grade_levels'] ?? [])],
            'section' => ['required', 'string', 'max:255'],
            'phone_number' => ['nullable', 'string', new PhilippineMobileNumber],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'guardians' => ['required', 'array', 'min:1'],
            'guardians.*.name' => ['required', 'string', 'max:255'],
            'guardians.*.relationship' => ['required', 'string', 'max:100'],
            'guardians.*.phone_number' => ['required', 'string', new PhilippineMobileNumber],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'grade_level.in' => 'Choose a year level that belongs to the selected education level.',
        ];
    }
}
