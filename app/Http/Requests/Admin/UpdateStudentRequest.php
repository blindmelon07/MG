<?php

namespace App\Http\Requests\Admin;

use App\Models\Student;
use App\Rules\PhilippineMobileNumber;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStudentRequest extends FormRequest
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
        $student = $this->route('student');
        $studentId = $student instanceof Student ? $student->id : null;

        return [
            'name' => ['required', 'string', 'max:255'],
            'student_number' => ['nullable', 'string', 'max:255', Rule::unique('students', 'student_number')->ignore($student)],
            'grade_level' => ['nullable', 'string', 'max:255'],
            'section' => ['nullable', 'string', 'max:255'],
            'phone_number' => ['nullable', 'string', new PhilippineMobileNumber],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'guardians' => ['required', 'array', 'min:1'],
            'guardians.*.id' => ['nullable', 'integer', Rule::exists('guardians', 'id')->where('student_id', $studentId)],
            'guardians.*.name' => ['required', 'string', 'max:255'],
            'guardians.*.relationship' => ['required', 'string', 'max:100'],
            'guardians.*.phone_number' => ['required', 'string', new PhilippineMobileNumber],
        ];
    }
}
