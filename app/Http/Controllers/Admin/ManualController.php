<?php

namespace App\Http\Controllers\Admin;

use App\Concerns\GeneratesUniqueSlug;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreManualRequest;
use App\Http\Requests\Admin\UpdateManualRequest;
use App\Models\Manual;
use App\Models\ManualCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class ManualController extends Controller
{
    use GeneratesUniqueSlug;

    public function index(): Response
    {
        return Inertia::render('admin/manuals/index', [
            'manuals' => Manual::with(['category', 'creator'])
                ->latest()
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
        $data = $request->validated();
        $data['slug'] = $this->generateUniqueSlug(Manual::class, $data['title']);
        $data['created_by'] = $request->user()->id;
        $data['published_at'] = $data['status'] === 'published' ? Carbon::now() : null;

        Manual::create($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Manual created.')]);

        return to_route('admin.manuals.index');
    }

    public function edit(Manual $manual): Response
    {
        return Inertia::render('admin/manuals/edit', [
            'manual' => $manual,
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

        $manual->update($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Manual updated.')]);

        return to_route('admin.manuals.index');
    }

    public function destroy(Manual $manual): RedirectResponse
    {
        $manual->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Manual deleted.')]);

        return to_route('admin.manuals.index');
    }
}
