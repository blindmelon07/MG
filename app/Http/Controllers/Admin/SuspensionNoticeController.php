<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Advisory;
use App\Models\SchoolYear;
use App\Models\SuspensionNotice;
use App\Services\SmsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;

class SuspensionNoticeController extends Controller
{
    /**
     * Text a class suspension notice to an adviser's section: its active
     * students and their guardians.
     */
    public function store(Request $request, Advisory $advisory, SmsService $sms): RedirectResponse
    {
        $user = $request->user('web');

        abort_unless($advisory->user_id === $user->id, 403);

        if ($advisory->school_year !== SchoolYear::current()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('Suspension notices can only be sent to this school year\'s advisory class.')]);

            return back();
        }

        $data = $request->validate([
            'starts_on' => ['required', 'date', 'after_or_equal:today'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'reason' => ['required', 'string', 'max:160'],
        ], [
            'starts_on.after_or_equal' => __('The suspension can\'t start in the past.'),
            'ends_on.after_or_equal' => __('The last day can\'t be before the first day.'),
        ]);

        $startsOn = Carbon::parse($data['starts_on']);
        $endsOn = isset($data['ends_on']) ? Carbon::parse($data['ends_on']) : null;

        $notice = $advisory->suspensionNotices()->create([
            ...SuspensionNotice::snapshot($advisory, $user),
            'starts_on' => $startsOn,
            'ends_on' => $endsOn,
            'reason' => trim($data['reason']),
            'message' => $sms->suspensionMessage($advisory, $user->name, $startsOn, $endsOn, $data['reason']),
        ]);

        $count = $sms->sendSuspensionNotice($notice);
        $notice->update(['recipient_count' => $count]);

        Inertia::flash('toast', $count > 0
            ? ['type' => 'success', 'message' => trans_choice('Suspension notice sent to :count number.|Suspension notice sent to :count numbers.', $count)]
            : ['type' => 'warning', 'message' => __('Notice saved, but no student or guardian in this section has a phone number.')]);

        return to_route('admin.advisories.mine');
    }
}
