<?php

use App\Models\Grade;
use App\Models\GradeAudit;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\UploadedFile;

test('importing, re-importing and deleting grades leaves an audit trail', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);
    Student::factory()->create(['student_number' => 'LRN-0001']);
    $header = "student_number,student_name,school_year,subject,term_1,term_2,term_3,final_grade,remarks\n";

    foreach (['85,86,87', '85,86,95'] as $terms) {
        $this->actingAs($registrar)->post(route('admin.grades.import.store'), [
            'grading_system' => 'k12',
            'file' => UploadedFile::fake()->createWithContent('g.csv', $header."LRN-0001,,2026-2027,Mathematics,{$terms},,\n"),
        ]);
    }

    $grade = Grade::firstOrFail();
    $this->actingAs($registrar)->delete(route('admin.grades.destroy', $grade));

    $audits = GradeAudit::orderBy('id')->get();

    expect($audits->pluck('event')->all())->toBe(['created', 'updated', 'deleted'])
        ->and($audits->pluck('user_id')->unique()->all())->toBe([$registrar->id])
        ->and($audits[1]->old_values)->toMatchArray(['q3' => '87.00'])
        ->and((float) $audits[1]->new_values['q3'])->toBe(95.0)
        ->and(GradeAudit::where('grade_id', $grade->id)->count())->toBe(3);
});

test('only registrar staff and admins can view grade history', function () {
    $this->actingAs(User::factory()->withTwoFactor()->create(['role' => 'registrar']))
        ->get(route('admin.grades.history'))->assertOk();

    $this->actingAs(User::factory()->withTwoFactor()->create(['role' => 'teacher']))
        ->get(route('admin.grades.history'))->assertForbidden();
});

test('the audit trail still names who changed a grade after their account is deleted', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar', 'name' => 'Rita Registrar']);
    Student::factory()->create(['student_number' => 'LRN-0001']);

    $this->actingAs($registrar)->post(route('admin.grades.import.store'), [
        'grading_system' => 'k12',
        'file' => UploadedFile::fake()->createWithContent('g.csv', "student_number,student_name,school_year,subject,q1,q2,q3,q4,final_grade,remarks\nLRN-0001,,2026-2027,Mathematics,85,86,87,88,,\n"),
    ]);

    $registrar->delete();

    expect(GradeAudit::sole())
        ->user_id->toBeNull()
        ->user_name->toBe('Rita Registrar')
        ->user_role->toBe('registrar');
});
