<?php

use App\Models\Grade;
use App\Models\GradeAudit;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\UploadedFile;

test('importing, re-importing and deleting grades leaves an audit trail', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Student::factory()->create(['student_number' => 'LRN-0001']);
    $header = "student_number,student_name,school_year,subject,q1,q2,q3,q4,final_grade,remarks\n";

    foreach (['85,86,87,88', '85,86,87,95'] as $quarters) {
        $this->actingAs($registrar)->post(route('admin.grades.import.store'), [
            'grading_system' => 'k12',
            'file' => UploadedFile::fake()->createWithContent('g.csv', $header."LRN-0001,,2026-2027,Mathematics,{$quarters},,\n"),
        ]);
    }

    $grade = Grade::firstOrFail();
    $this->actingAs($registrar)->delete(route('admin.grades.destroy', $grade));

    $audits = GradeAudit::orderBy('id')->get();

    expect($audits->pluck('event')->all())->toBe(['created', 'updated', 'deleted'])
        ->and($audits->pluck('user_id')->unique()->all())->toBe([$registrar->id])
        ->and($audits[1]->old_values)->toMatchArray(['q4' => '88.00'])
        ->and((float) $audits[1]->new_values['q4'])->toBe(95.0)
        ->and(GradeAudit::where('grade_id', $grade->id)->count())->toBe(3);
});

test('only registrar staff and admins can view grade history', function () {
    $this->actingAs(User::factory()->withTwoFactor()->create(['role' => 'registrar']))
        ->get(route('admin.grades.history'))->assertOk();

    $this->actingAs(User::factory()->withTwoFactor()->create(['role' => 'teacher']))
        ->get(route('admin.grades.history'))->assertForbidden();
});
