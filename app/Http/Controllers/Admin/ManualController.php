<?php

namespace App\Http\Controllers\Admin;

use App\Concerns\GeneratesUniqueSlug;
use App\Concerns\HandlesMediaUploads;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreManualRequest;
use App\Http\Requests\Admin\UpdateManualRequest;
use App\Models\Manual;
use App\Models\ManualCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ManualController extends Controller
{
    use GeneratesUniqueSlug, HandlesMediaUploads;

    public function index(): Response
    {
        return Inertia::render('admin/manuals/index', [
            'manuals' => Manual::with(['category', 'creator'])
                ->inReadingOrder()
                ->paginate(15)
                ->withQueryString(),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/manuals/create', [
            'categories' => ManualCategory::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(StoreManualRequest $request): RedirectResponse
    {
        $data = $request->safe()->except('images');
        $data['slug'] = $this->generateUniqueSlug(Manual::class, $data['title']);
        $data['created_by'] = $request->user()->id;
        $data['published_at'] = $data['status'] === 'published' ? Carbon::now() : null;
        $data['sort_order'] = $this->nextPosition($data['manual_category_id']);

        $manual = Manual::create($data);

        foreach ($request->file('images', []) as $image) {
            $this->attachMedia($manual, $image, null);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Manual created.')]);

        return to_route('admin.manuals.index');
    }

    public function edit(Manual $manual): Response
    {
        return Inertia::render('admin/manuals/edit', [
            'manual' => $manual->load('media'),
            'categories' => ManualCategory::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function update(UpdateManualRequest $request, Manual $manual): RedirectResponse
    {
        $data = $request->validated();

        if ($data['status'] === 'published' && $manual->published_at === null) {
            $data['published_at'] = Carbon::now();
        } elseif ($data['status'] === 'draft') {
            $data['published_at'] = null;
        }

        $previousCategory = $manual->manual_category_id;

        // A manual moved to another category goes to the end of it.
        if ((int) $data['manual_category_id'] !== $previousCategory) {
            $data['sort_order'] = $this->nextPosition($data['manual_category_id']);
        }

        $manual->update($data);

        if ($manual->manual_category_id !== $previousCategory) {
            Manual::renumber($previousCategory);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Manual updated.')]);

        return to_route('admin.manuals.index');
    }

    public function destroy(Manual $manual): RedirectResponse
    {
        $manual->media->each(fn ($media) => $this->detachMedia($media));

        $manual->delete();
        Manual::renumber($manual->manual_category_id);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Manual deleted.')]);

        return to_route('admin.manuals.index');
    }

    /**
     * Swap a manual with the one before or after it in its category.
     */
    public function move(Request $request, Manual $manual): RedirectResponse
    {
        $direction = $request->validate(['direction' => ['required', Rule::in(['up', 'down'])]])['direction'];

        Manual::renumber($manual->manual_category_id);
        $manual->refresh();

        $neighbor = Manual::where('manual_category_id', $manual->manual_category_id)
            ->where('sort_order', $direction === 'up' ? $manual->sort_order - 1 : $manual->sort_order + 1)
            ->first();

        if ($neighbor !== null) {
            [$manual->sort_order, $neighbor->sort_order] = [$neighbor->sort_order, $manual->sort_order];
            $manual->save();
            $neighbor->save();
        }

        return back();
    }

    private function nextPosition(int|string $categoryId): int
    {
        return (int) Manual::where('manual_category_id', $categoryId)->max('sort_order') + 1;
    }
}
