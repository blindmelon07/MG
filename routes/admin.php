<?php

use App\Http\Controllers\Admin\AnnouncementController;
use App\Http\Controllers\Admin\AnnouncementMediaController;
use App\Http\Controllers\Admin\CampusLocationController;
use App\Http\Controllers\Admin\GradeAuditController;
use App\Http\Controllers\Admin\GradeController;
use App\Http\Controllers\Admin\GradeImportController;
use App\Http\Controllers\Admin\ManualCategoryController;
use App\Http\Controllers\Admin\ManualController;
use App\Http\Controllers\Admin\ManualMediaController;
use App\Http\Controllers\Admin\MapReferencePointController;
use App\Http\Controllers\Admin\StudentController;
use App\Http\Controllers\Admin\StudentCredentialController;
use App\Http\Controllers\Admin\StudentImportController;
use App\Http\Controllers\Admin\TeachingAssignmentController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\UserTwoFactorController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'two_factor'])->prefix('admin')->name('admin.')->group(function () {
    Route::middleware('role:admin')->group(function () {
        Route::resource('manual-categories', ManualCategoryController::class)
            ->only(['index', 'store', 'update', 'destroy']);

        Route::resource('manuals', ManualController::class)
            ->except(['show']);

        Route::post('manuals/{manual}/media', [ManualMediaController::class, 'store'])->name('manuals.media.store');
        Route::delete('manuals/{manual}/media/{media}', [ManualMediaController::class, 'destroy'])->name('manuals.media.destroy');

        Route::resource('announcements', AnnouncementController::class)
            ->except(['show']);

        Route::post('announcements/{announcement}/media', [AnnouncementMediaController::class, 'store'])->name('announcements.media.store');
        Route::delete('announcements/{announcement}/media/{media}', [AnnouncementMediaController::class, 'destroy'])->name('announcements.media.destroy');

        Route::resource('campus-locations', CampusLocationController::class)
            ->only(['index', 'store', 'update', 'destroy']);

        Route::resource('map-reference-points', MapReferencePointController::class)
            ->only(['store', 'destroy']);
    });

    Route::middleware('role:admin,registrar')->group(function () {
        Route::get('students/import/template', [StudentImportController::class, 'template'])->name('students.import.template');
        Route::post('students/import', [StudentImportController::class, 'store'])->name('students.import.store');
        Route::post('students/credentials', [StudentCredentialController::class, 'batch'])
            ->middleware('throttle:10,1')
            ->name('students.credentials.batch');
        Route::post('students/{student}/credentials', [StudentCredentialController::class, 'store'])
            ->middleware('throttle:30,1')
            ->name('students.credentials.store');

        Route::resource('students', StudentController::class)
            ->except(['show']);

        Route::resource('teaching-assignments', TeachingAssignmentController::class)
            ->only(['index', 'store', 'destroy']);

        Route::get('grades/history', [GradeAuditController::class, 'index'])->name('grades.history');
    });

    Route::middleware('role:admin,registrar,teacher')->group(function () {
        Route::get('grades', [GradeController::class, 'index'])->name('grades.index');
        Route::delete('grades/{grade}', [GradeController::class, 'destroy'])->name('grades.destroy');
        Route::get('grades/import/template/{system}', [GradeImportController::class, 'template'])
            ->whereIn('system', ['k12', 'college'])
            ->name('grades.import.template');
        Route::post('grades/import', [GradeImportController::class, 'store'])->name('grades.import.store');
    });

    Route::middleware('super_admin')->group(function () {
        Route::resource('users', UserController::class)->except(['show']);
        Route::delete('users/{user}/two-factor', [UserTwoFactorController::class, 'destroy'])->name('users.two-factor.destroy');
    });
});
