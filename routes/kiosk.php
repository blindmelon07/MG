<?php

use App\Http\Controllers\Kiosk\AnnouncementController;
use App\Http\Controllers\Kiosk\HomeController;
use App\Http\Controllers\Kiosk\ManualController;
use App\Http\Controllers\Kiosk\MapController;
use Illuminate\Support\Facades\Route;

Route::get('/', [HomeController::class, 'index'])->name('home');

Route::prefix('manuals')->name('manuals.')->group(function () {
    Route::get('/', [ManualController::class, 'index'])->name('index');
    Route::get('{slug}', [ManualController::class, 'show'])->name('show');
});

Route::prefix('announcements')->name('announcements.')->group(function () {
    Route::get('/', [AnnouncementController::class, 'index'])->name('index');
    Route::get('{slug}', [AnnouncementController::class, 'show'])->name('show');
});

Route::prefix('maps')->name('maps.')->group(function () {
    Route::get('/', [MapController::class, 'index'])->name('index');
    Route::post('presence', [MapController::class, 'presence'])
        ->middleware('throttle:30,1')
        ->name('presence');
    Route::delete('presence', [MapController::class, 'leave'])
        ->middleware('throttle:30,1')
        ->name('presence.leave');
});
