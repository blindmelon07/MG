import { Form } from '@inertiajs/react';
import { MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import KioskPositionController from '@/actions/App/Http/Controllers/Admin/KioskPositionController';
import { CampusMap } from '@/components/campus-map';
import type { CampusMapPoint } from '@/components/campus-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Where the kiosk stands on campus. The kiosk home screen shows
 * "You are here" there and draws every route from that spot.
 */
export function KioskPositionPicker({
    position,
    saved,
    locations,
}: {
    position: { x: number; y: number };
    saved: boolean;
    locations: CampusMapPoint[];
}) {
    const [picked, setPicked] = useState<{ x: number; y: number } | null>(null);
    const shown = picked ?? position;

    return (
        <Card className="max-w-3xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MonitorSmartphone className="size-5" />
                    Kiosk position (&ldquo;You are here&rdquo;)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Click the map where the kiosk stands. Directions on the
                    kiosk home screen start from this spot.
                    {!saved && ' Not set yet, so it uses the Main Gate.'}
                </p>
            </CardHeader>
            <CardContent className="space-y-3">
                <CampusMap
                    points={locations}
                    onMapClick={setPicked}
                    userLocation={{ ...shown, label: 'You are here' }}
                />
                <div className="flex flex-wrap gap-2">
                    <Form
                        {...KioskPositionController.update.form()}
                        onSuccess={() => setPicked(null)}
                    >
                        {({ processing }) => (
                            <>
                                <input
                                    type="hidden"
                                    name="x"
                                    value={picked?.x ?? ''}
                                />
                                <input
                                    type="hidden"
                                    name="y"
                                    value={picked?.y ?? ''}
                                />
                                <Button
                                    type="submit"
                                    disabled={processing || picked === null}
                                >
                                    Save kiosk position
                                </Button>
                            </>
                        )}
                    </Form>
                    {picked && (
                        <Button
                            variant="secondary"
                            onClick={() => setPicked(null)}
                        >
                            Cancel
                        </Button>
                    )}
                    {saved && !picked && (
                        <Form {...KioskPositionController.destroy.form()}>
                            {({ processing }) => (
                                <Button
                                    type="submit"
                                    variant="ghost"
                                    disabled={processing}
                                >
                                    Reset to Main Gate
                                </Button>
                            )}
                        </Form>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
