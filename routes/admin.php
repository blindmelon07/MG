<?php

use App\Http\Controllers\Admin\AnnouncementController;
use App\Http\Controllers\Admin\AnnouncementMediaController;
use App\Http\Controllers\Admin\ManualCategoryController;
use App\Http\Controllers\Admin\ManualController;
use App\Http\Controllers\Admin\ManualMediaController;
use App\Http\Controllers\Admin\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->prefix('admin')->name('admin.')->group(function () {
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

    Route::middleware('super_admin')->group(function () {
        Route::resource('users', UserController::class)->except(['show']);
    });
});
