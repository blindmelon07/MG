<?php

namespace App\Http\Requests\Admin;

use App\Support\KioskTheme;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateKioskThemeRequest extends FormRequest
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
        $rules = [];

        foreach (['light', 'dark'] as $mode) {
            foreach (KioskTheme::keys() as $key) {
                $rules["{$mode}.{$key}"] = ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'];
            }
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            '*.*.regex' => __('Use a color like #1e3a8a.'),
        ];
    }
}
