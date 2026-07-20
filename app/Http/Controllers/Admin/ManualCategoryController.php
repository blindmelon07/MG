<?php

namespace App\Http\Controllers\Admin;

use App\Concerns\GeneratesUniqueSlug;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreManualCategoryRequest;
use App\Http\Requests\Admin\UpdateManualCategoryRequest;
use App\Models\ManualCategory;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ManualCategoryController extends Controller
{
    use GeneratesUniqueSlug;

    public function index(): Response
    {
        return Inertia::render('admin/manual-categories/index', [
            'categories' => ManualCategory::withCount('manuals')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(StoreManualCategoryRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['slug'] = $this->generateUniqueSlug(ManualCategory::class, $data['name']);

        ManualCategory::create($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Category created.')]);

        return to_route('admin.manual-categories.index');
    }

    public function update(UpdateManualCategoryRequest $request, ManualCategory $manualCategory): RedirectResponse
    {
        $manualCategory->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Category updated.')]);

        return to_route('admin.manual-categories.index');
    }

    public function destroy(ManualCategory $manualCategory): RedirectResponse
    {
        if ($manualCategory->manuals()->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('Move or delete its manuals before deleting this category.')]);

            return to_route('admin.manual-categories.index');
        }

        $manualCategory->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Category deleted.')]);

        return to_route('admin.manual-categories.index');
    }
}
