<?php

use App\Http\Controllers\Student\AuthController;
use App\Http\Controllers\Student\GradeController;
use App\Http\Controllers\Student\PasswordController;
use Illuminate\Support\Facades\Route;

Route::prefix('student')->name('student.')->group(function () {
    Route::middleware('guest:student')->group(function () {
        Route::get('login', [AuthController::class, 'create'])->name('login');
        Route::post('login', [AuthController::class, 'store'])
            ->middleware('throttle:student-login')
            ->name('login.store');
    });

    // auth.session signs out every other session when the password changes or is reset.
    Route::middleware(['auth:student', 'auth.session', 'student.secure'])->group(function () {
        Route::post('logout', [AuthController::class, 'destroy'])->name('logout');

        Route::get('password', [PasswordController::class, 'edit'])->name('password.edit');
        Route::put('password', [PasswordController::class, 'update'])
            ->middleware('throttle:6,1')
            ->name('password.update');

        Route::get('grades', [GradeController::class, 'index'])
            ->middleware('student.password_changed')
            ->name('grades');
    });
});
