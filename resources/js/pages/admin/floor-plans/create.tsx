import { Head } from '@inertiajs/react';
import { FloorPlanEditor } from '@/components/floor-plan-editor';
import type {
    EditorLocation,
    EditorOffice,
} from '@/components/floor-plan-editor';
import Heading from '@/components/heading';
import { create, index as floorPlansIndex } from '@/routes/admin/floor-plans';

export default function FloorPlansCreate({
    locations,
    offices,
}: {
    locations: EditorLocation[];
    offices: EditorOffice[];
}) {
    return (
        <>
            <Head title="New Floor Plan" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title="New Floor Plan"
                    description="Upload the floor sign, trace the rooms, hallways and entrances, then line the building up on the campus map."
                />
                <FloorPlanEditor locations={locations} offices={offices} />
            </div>
        </>
    );
}

FloorPlansCreate.layout = {
    breadcrumbs: [
        { title: 'Floor Plans', href: floorPlansIndex() },
        { title: 'New', href: create() },
    ],
};
