<?php

use App\Http\Controllers\Admin\AnnouncementController;
use App\Http\Controllers\Admin\ManualCategoryController;
use App\Http\Controllers\Admin\ManualController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->prefix('admin')->name('admin.')->group(function () {
    Route::resource('manual-categories', ManualCategoryController::class)
        ->only(['index', 'store', 'update', 'destroy']);

    Route::resource('manuals', ManualController::class)
        ->except(['show']);

    Route::resource('announcements', AnnouncementController::class)
        ->except(['show']);
});
