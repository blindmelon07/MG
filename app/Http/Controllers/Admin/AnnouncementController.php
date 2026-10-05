<?php

namespace App\Http\Controllers\Admin;

use App\Concerns\GeneratesUniqueSlug;
use App\Concerns\HandlesMediaUploads;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreAnnouncementRequest;
use App\Http\Requests\Admin\UpdateAnnouncementRequest;
use App\Models\Announcement;
use App\Models\CampusLocation;
use App\Models\Student;
use App\Services\SmsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\UploadedFile;
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
        return Inertia::render('admin/announcements/create', $this->formOptions());
    }

    public function store(StoreAnnouncementRequest $request, SmsService $sms): RedirectResponse
    {
        [$data, $studentIds, $files] = $this->split($request->validated());

        $data['slug'] = $this->generateUniqueSlug(Announcement::class, $data['title']);
        $data['created_by'] = $request->user()->id;
        $data['published_at'] = $data['status'] === 'published' ? Carbon::now() : null;

        $announcement = Announcement::create($data);

        if ($announcement->audience === 'targeted') {
            $announcement->students()->sync($studentIds);
        }

        foreach ($files as $file) {
            $this->attachMedia($announcement, $file, null);
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
            ...$this->formOptions(),
        ]);
    }

    public function update(UpdateAnnouncementRequest $request, Announcement $announcement, SmsService $sms): RedirectResponse
    {
        [$data, $studentIds, $files] = $this->split($request->validated());

        $wasAlreadyPublished = $announcement->published_at !== null;

        if ($data['status'] === 'published' && ! $wasAlreadyPublished) {
            $data['published_at'] = Carbon::now();
        } elseif ($data['status'] === 'draft') {
            $data['published_at'] = null;
        }

        $announcement->update($data);

        $announcement->students()->sync($announcement->audience === 'targeted' ? $studentIds : []);

        foreach ($files as $file) {
            $this->attachMedia($announcement, $file, null);
        }

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
     * Separate the announcement's own columns from the students and uploads sent with it.
     *
     * @param  array<string, mixed>  $validated
     * @return array{0: array<string, mixed>, 1: array<int, int>, 2: array<int, UploadedFile>}
     */
    private function split(array $validated): array
    {
        $studentIds = $validated['student_ids'] ?? [];
        $files = $validated['media'] ?? [];
        unset($validated['student_ids'], $validated['media']);

        $validated['personnel_roles'] = array_values(array_unique($validated['personnel_roles'] ?? [])) ?: null;

        // Only events happen somewhere on the map.
        if ($validated['type'] !== 'event') {
            $validated['campus_location_id'] = null;
        }

        return [$validated, $studentIds, $files];
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'students' => $this->studentOptions(),
            'campusLocations' => CampusLocation::orderBy('sort_order')->orderBy('name')->get(['id', 'name']),
            'personnelRoles' => collect(Announcement::PERSONNEL_ROLES)
                ->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])
                ->values(),
        ];
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
