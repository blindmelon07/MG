<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreStudentRequest;
use App\Http\Requests\Admin\UpdateStudentRequest;
use App\Models\Student;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StudentController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();

        return Inertia::render('admin/students/index', [
            'students' => Student::with('guardians')
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('student_number', 'like', "%{$search}%");
                })
                ->orderBy('name')
                ->paginate(15)
                ->withQueryString(),
            'search' => $search,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/students/create');
    }

    public function store(StoreStudentRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $guardians = $data['guardians'];
        unset($data['guardians']);

        $student = Student::create($data);
        $student->guardians()->createMany($guardians);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Student created.')]);

        return to_route('admin.students.index');
    }

    public function edit(Student $student): Response
    {
        return Inertia::render('admin/students/edit', [
            'student' => $student->load('guardians'),
        ]);
    }

    public function update(UpdateStudentRequest $request, Student $student): RedirectResponse
    {
        $data = $request->validated();
        $guardians = $data['guardians'];
        unset($data['guardians']);

        $student->update($data);

        $submittedIds = array_filter(array_column($guardians, 'id'));
        $student->guardians()->whereNotIn('id', $submittedIds)->delete();

        foreach ($guardians as $guardian) {
            if (! empty($guardian['id'])) {
                $student->guardians()->whereKey($guardian['id'])->update([
                    'name' => $guardian['name'],
                    'relationship' => $guardian['relationship'],
                    'phone_number' => $guardian['phone_number'],
                ]);
            } else {
                $student->guardians()->create([
                    'name' => $guardian['name'],
                    'relationship' => $guardian['relationship'],
                    'phone_number' => $guardian['phone_number'],
                ]);
            }
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Student updated.')]);

        return to_route('admin.students.index');
    }

    public function destroy(Student $student): RedirectResponse
    {
        $student->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Student deleted.')]);

        return to_route('admin.students.index');
    }
}
