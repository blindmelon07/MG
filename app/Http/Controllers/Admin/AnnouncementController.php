<?php

namespace App\Http\Controllers\Admin;

use App\Concerns\GeneratesUniqueSlug;
use App\Concerns\HandlesMediaUploads;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreAnnouncementRequest;
use App\Http\Requests\Admin\UpdateAnnouncementRequest;
use App\Models\Announcement;
use App\Models\Student;
use App\Services\SmsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class AnnouncementController extends Controller
{
    use GeneratesUniqueSlug, HandlesMediaUploads;

    public function index(): Response
    {
        return Inertia::render('admin/announcements/index', [
            'announcements' => Announcement::with('creator')
                ->latest()
                ->paginate(15)
                ->withQueryString(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/announcements/create', [
            'students' => $this->studentOptions(),
        ]);
    }

    public function store(StoreAnnouncementRequest $request, SmsService $sms): RedirectResponse
    {
        $data = $request->validated();
        $studentIds = $data['student_ids'] ?? [];
        unset($data['student_ids']);

        $data['slug'] = $this->generateUniqueSlug(Announcement::class, $data['title']);
        $data['created_by'] = $request->user()->id;
        $data['published_at'] = $data['status'] === 'published' ? Carbon::now() : null;

        $announcement = Announcement::create($data);

        if ($announcement->audience === 'targeted') {
            $announcement->students()->sync($studentIds);
        }

        if ($announcement->status === 'published' && ! $request->boolean('skip_sms')) {
            $sms->notifyForAnnouncement($announcement);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Announcement created.')]);

        return to_route('admin.announcements.index');
    }

    public function edit(Announcement $announcement): Response
    {
        return Inertia::render('admin/announcements/edit', [
            'announcement' => $announcement->load('media', 'students:id'),
            'students' => $this->studentOptions(),
        ]);
    }

    public function update(UpdateAnnouncementRequest $request, Announcement $announcement, SmsService $sms): RedirectResponse
    {
        $data = $request->validated();
        $studentIds = $data['student_ids'] ?? [];
        unset($data['student_ids']);

        $wasAlreadyPublished = $announcement->published_at !== null;

        if ($data['status'] === 'published' && ! $wasAlreadyPublished) {
            $data['published_at'] = Carbon::now();
        } elseif ($data['status'] === 'draft') {
            $data['published_at'] = null;
        }

        $announcement->update($data);

        $announcement->students()->sync($announcement->audience === 'targeted' ? $studentIds : []);

        if ($announcement->status === 'published' && ! $wasAlreadyPublished && ! $request->boolean('skip_sms')) {
            $sms->notifyForAnnouncement($announcement);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Announcement updated.')]);

        return to_route('admin.announcements.index');
    }

    public function destroy(Announcement $announcement): RedirectResponse
    {
        $announcement->media->each(fn ($media) => $this->detachMedia($media));

        $announcement->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Announcement deleted.')]);

        return to_route('admin.announcements.index');
    }

    /**
     * @return Collection<int, Student>
     */
    private function studentOptions()
    {
        return Student::active()
            ->orderBy('name')
            ->get(['id', 'name', 'grade_level', 'section']);
    }
}
