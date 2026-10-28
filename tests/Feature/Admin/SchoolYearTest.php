<?php

use App\Models\Grade;
use App\Models\SchoolYear;
use App\Models\Student;
use App\Models\User;

beforeEach(function () {
    schoolYears('2026-2027', '2025-2026');
});

test('registrar can add a school year and make it current', function () {
    $registrar = User::factory()->withTwoFactor()->create(['role' => 'registrar']);

    $this->actingAs($registrar)->post(route('admin.school-years.store'), ['name' => '2027-2028'])
        ->assertRedirect(route('admin.school-years.index'));

    $this->post(route('admin.school-years.store'), ['name' => '2027-2029'])->assertSessionHasErrors('name');
    $this->post(route('admin.school-years.store'), ['name' => '2027-2028'])->assertSessionHasErrors('name');

    $this->post(route('admin.school-years.current', SchoolYear::where('name', '2027-2028')->firstOrFail()));

    expect(SchoolYear::current())->toBe('2027-2028')
        ->and(SchoolYear::where('is_current', true)->count())->toBe(1);
});

test('new students join the current school year once it changes', function () {
    SchoolYear::where('name', '2025-2026')->firstOrFail()->makeCurrent();

    $student = Student::factory()->create();

    expect($student->enrollments()->pluck('school_year')->all())->toBe(['2025-2026']);
});

test('staff can switch the school year they are viewing', function () {
    $teacher = User::factory()->withTwoFactor()->create(['role' => 'teacher']);

    $this->actingAs($teacher)->get(route('admin.grades.index'))
        ->assertInertia(fn ($page) => $page->where('schoolYear.selected', '2026-2027'));

    $this->post(route('admin.school-year.select'), ['school_year' => '2025-2026'])->assertRedirect();

    $this->get(route('admin.grades.index'))
        ->assertInertia(fn ($page) => $page
            ->where('schoolYear.selected', '2025-2026')
            ->where('schoolYear.current', '2026-2027')
            ->where('filters.school_year', '2025-2026'));

    $this->post(route('admin.school-year.select'), ['school_year' => '1999-2000'])->assertSessionHasErrors('school_year');
});

test('a school year in use cannot be removed', function () {
    $admin = User::factory()->withTwoFactor()->create(['role' => 'admin']);
    Grade::factory()->create(['school_year' => '2025-2026']);
    $unused = SchoolYear::create(['name' => '2030-2031']);

    $this->actingAs($admin)->delete(route('admin.school-years.destroy', SchoolYear::where('name', '2025-2026')->firstOrFail()));
    $this->delete(route('admin.school-years.destroy', SchoolYear::where('name', '2026-2027')->firstOrFail()));
    $this->delete(route('admin.school-years.destroy', $unused));

    expect(SchoolYear::orderBy('name')->pluck('name')->all())->toBe(['2025-2026', '2026-2027']);
});

test('teachers cannot manage school years', function () {
    $this->actingAs(User::factory()->withTwoFactor()->create(['role' => 'teacher']))
        ->get(route('admin.school-years.index'))
        ->assertForbidden();
});
