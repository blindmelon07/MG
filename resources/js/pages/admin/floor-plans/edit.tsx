import { Head } from '@inertiajs/react';
import { FloorPlanEditor } from '@/components/floor-plan-editor';
import type {
    EditorLocation,
    EditorOffice,
    EditorPlan,
} from '@/components/floor-plan-editor';
import Heading from '@/components/heading';
import { edit, index as floorPlansIndex } from '@/routes/admin/floor-plans';

export default function FloorPlansEdit({
    plan,
    locations,
    offices,
}: {
    plan: EditorPlan;
    locations: EditorLocation[];
    offices: EditorOffice[];
}) {
    return (
        <>
            <Head title={`${plan.building} Floor Plan`} />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title={`${plan.building} · ${plan.floor}`}
                    description="Trace the rooms, hallways and entrances. Saved changes show on the kiosk right away."
                />
                <FloorPlanEditor
                    key={plan.id}
                    plan={plan}
                    locations={locations}
                    offices={offices}
                />
            </div>
        </>
    );
}

FloorPlansEdit.layout = (page: { plan: EditorPlan }) => ({
    breadcrumbs: [
        { title: 'Floor Plans', href: floorPlansIndex() },
        { title: page.plan.building, href: edit(page.plan.id) },
    ],
});
