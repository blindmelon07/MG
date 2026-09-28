<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GradeAudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GradeAuditController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->toString();

        return Inertia::render('admin/grades/history', [
            'audits' => GradeAudit::with(['user:id,name,role', 'student:id,name,student_number'])
                ->when($search !== '', fn (Builder $query) => $query->whereHas('student', function (Builder $query) use ($search): void {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('student_number', 'like', "%{$search}%");
                }))
                ->latest('id')
                ->paginate(30)
                ->withQueryString(),
            'search' => $search,
        ]);
    }
}
