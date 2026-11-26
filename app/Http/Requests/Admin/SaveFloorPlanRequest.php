<?php

namespace App\Http\Requests\Admin;

use App\Models\FloorPlan;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveFloorPlanRequest extends FormRequest
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
        $key = ['required', 'string', 'max:50', 'regex:/^[a-z0-9-]+$/', 'distinct'];
        $side = ['required', Rule::in(FloorPlan::SIDES)];
        $coordinate = ['required', 'numeric', 'min:0', 'max:10000'];
        $size = ['required', 'numeric', 'gt:0', 'max:10000'];

        return [
            'campus_location_id' => [
                'required',
                'integer',
                'exists:campus_locations,id',
                Rule::unique('floor_plans')->ignore($this->route('floor_plan')),
            ],
            'floor' => ['required', 'string', 'max:100'],
            // A photo or scan of the floor sign, traced over in the editor.
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
            'remove_image' => ['nullable', 'boolean'],
            'width' => ['required', 'numeric', 'gt:0', 'max:10000'],
            'depth' => ['required', 'numeric', 'gt:0', 'max:10000'],
            'meters_per_unit' => ['required', 'numeric', 'gt:0', 'max:1000'],
            'site_x0' => ['required', 'numeric', 'between:-20,120'],
            'site_y0' => ['required', 'numeric', 'between:-20,120'],
            'site_x1' => ['required', 'numeric', 'between:-20,120', 'gt:site_x0'],
            'site_y1' => ['required', 'numeric', 'between:-20,120', 'gt:site_y0'],

            'rooms' => ['nullable', 'array', 'max:300'],
            'rooms.*.key' => $key,
            'rooms.*.name' => ['required', 'string', 'max:100'],
            'rooms.*.kind' => ['required', Rule::in(FloorPlan::ROOM_KINDS)],
            'rooms.*.door' => $side,
            'rooms.*.x' => $coordinate,
            'rooms.*.y' => $coordinate,
            'rooms.*.w' => $size,
            'rooms.*.d' => $size,

            'halls' => ['nullable', 'array', 'max:300'],
            'halls.*.x' => $coordinate,
            'halls.*.y' => $coordinate,
            'halls.*.w' => $size,
            'halls.*.d' => $size,

            'entrances' => ['nullable', 'array', 'max:20'],
            'entrances.*.key' => $key,
            'entrances.*.name' => ['required', 'string', 'max:150'],
            'entrances.*.at.x' => $coordinate,
            'entrances.*.at.y' => $coordinate,
            'entrances.*.inward' => $side,
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'campus_location_id' => 'building',
            'site_x1' => 'east edge on the campus map',
            'site_y1' => 'south edge on the campus map',
            'rooms.*.name' => 'room name',
            'rooms.*.key' => 'room key',
            'entrances.*.name' => 'entrance name',
            'entrances.*.key' => 'entrance key',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'campus_location_id.unique' => 'This building already has a floor plan.',
        ];
    }

    /**
     * The validated plan, with numbers as numbers (form data sends strings).
     *
     * @return array<string, mixed>
     */
    public function plan(): array
    {
        $data = $this->validated();
        $number = fn ($value): float => round((float) $value, 3);

        return [
            'campus_location_id' => (int) $data['campus_location_id'],
            'floor' => $data['floor'],
            'width' => $number($data['width']),
            'depth' => $number($data['depth']),
            'meters_per_unit' => $number($data['meters_per_unit']),
            'site_x0' => $number($data['site_x0']),
            'site_y0' => $number($data['site_y0']),
            'site_x1' => $number($data['site_x1']),
            'site_y1' => $number($data['site_y1']),
            'rooms' => array_values(array_map(fn (array $room) => [
                'key' => $room['key'],
                'name' => $room['name'],
                'kind' => $room['kind'],
                'x' => $number($room['x']),
                'y' => $number($room['y']),
                'w' => $number($room['w']),
                'd' => $number($room['d']),
                'door' => $room['door'],
            ], $data['rooms'] ?? [])),
            'halls' => array_values(array_map(fn (array $hall) => [
                'x' => $number($hall['x']),
                'y' => $number($hall['y']),
                'w' => $number($hall['w']),
                'd' => $number($hall['d']),
            ], $data['halls'] ?? [])),
            'entrances' => array_values(array_map(fn (array $entrance) => [
                'key' => $entrance['key'],
                'name' => $entrance['name'],
                'at' => ['x' => $number($entrance['at']['x']), 'y' => $number($entrance['at']['y'])],
                'inward' => $entrance['inward'],
            ], $data['entrances'] ?? [])),
        ];
    }
}
