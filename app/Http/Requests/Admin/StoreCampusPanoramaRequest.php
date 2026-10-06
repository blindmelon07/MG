<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreCampusPanoramaRequest extends FormRequest
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
            'title' => ['nullable', 'string', 'max:255'],
            // 360° photos: JPEG, at least 2:1 wide, up to 40 MB.
            'image' => ['required', 'file', 'mimes:jpg,jpeg', 'max:40960', 'dimensions:min_width=1024,ratio=2/1'],
            // Only needed when the photo has no GPS of its own.
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'north_offset' => ['nullable', 'numeric', 'between:0,360'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'image.dimensions' => __('This doesn\'t look like a 360° photo. It should be exactly twice as wide as it is tall (e.g. 6080 × 3040).'),
            'image.mimes' => __('Upload the 360° photo as a JPEG.'),
        ];
    }
}
