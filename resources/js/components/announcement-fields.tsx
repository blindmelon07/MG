import { useState } from 'react';
import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export type CampusLocationOption = { id: number; name: string };
export type PersonnelRoleOption = { value: string; label: string };

const NO_AREA = 'none';

/**
 * The spot on the campus map where an event happens. SMS and email links
 * open the kiosk map at this area.
 */
export function EventAreaField({
    locations,
    defaultValue,
    error,
}: {
    locations: CampusLocationOption[];
    defaultValue?: number | null;
    error?: string;
}) {
    const [value, setValue] = useState(
        defaultValue ? String(defaultValue) : NO_AREA,
    );

    return (
        <div className="grid gap-2">
            <Label htmlFor="campus_location_id">Area on the campus map</Label>
            <input
                type="hidden"
                name="campus_location_id"
                value={value === NO_AREA ? '' : value}
            />
            <Select value={value} onValueChange={setValue}>
                <SelectTrigger id="campus_location_id" className="w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={NO_AREA}>Not on the map</SelectItem>
                    {locations.map((location) => (
                        <SelectItem
                            key={location.id}
                            value={String(location.id)}
                        >
                            {location.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
                The link in the SMS and email opens the campus map at this area.
                {locations.length === 0 &&
                    ' Add places under Campus Map first.'}
            </p>
            <InputError message={error} />
        </div>
    );
}

/** ACI personnel groups who also receive the announcement by SMS and email. */
export function PersonnelAudienceField({
    roles,
    defaultValue = [],
    error,
}: {
    roles: PersonnelRoleOption[];
    defaultValue?: string[] | null;
    error?: string;
}) {
    return (
        <div className="grid gap-2">
            <Label>Also send to ACI personnel</Label>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
                {roles.map((role) => (
                    <label key={role.value} className="flex items-center gap-2">
                        <Checkbox
                            name="personnel_roles[]"
                            value={role.value}
                            defaultChecked={defaultValue?.includes(role.value)}
                        />
                        <span className="text-sm">{role.label}</span>
                    </label>
                ))}
            </div>
            <p className="text-sm text-muted-foreground">
                Personnel get an SMS (if their account has a phone number) and
                an email.
            </p>
            <InputError message={error} />
        </div>
    );
}

/** Pictures or videos to attach when saving. */
export function MediaUploadField({
    errors,
    label = 'Photos & videos (optional)',
}: {
    errors: Partial<Record<string, string>>;
    label?: string;
}) {
    const fileError = Object.entries(errors).find(([key]) =>
        key.startsWith('media.'),
    )?.[1];

    return (
        <div className="grid gap-2">
            <Label htmlFor="media">{label}</Label>
            <Input
                id="media"
                name="media[]"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
            />
            <p className="text-sm text-muted-foreground">
                Up to 10 files, 20 MB each. Images (JPG, PNG, GIF, WebP) or
                videos (MP4, WebM, MOV).
            </p>
            <InputError message={errors.media ?? fileError} />
        </div>
    );
}
