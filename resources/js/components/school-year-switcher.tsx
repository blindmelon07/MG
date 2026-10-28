import { router, usePage } from '@inertiajs/react';
import { CalendarRange } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { select } from '@/routes/admin/school-year';

/**
 * Picks the school year staff are viewing. Students, grades and teaching
 * assignments follow it, so past years stay readable.
 */
export function SchoolYearSwitcher() {
    const { schoolYear } = usePage().props;

    if (!schoolYear) {
        return null;
    }

    const lookingBack = schoolYear.selected !== schoolYear.current;

    return (
        <Select
            value={schoolYear.selected}
            onValueChange={(value) =>
                router.post(
                    select().url,
                    { school_year: value },
                    { preserveScroll: true },
                )
            }
        >
            <SelectTrigger
                aria-label="School year"
                className={cn(
                    'h-8 w-auto gap-2',
                    lookingBack &&
                        'border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-200',
                )}
            >
                <CalendarRange className="size-4 opacity-70" />
                <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
                {schoolYear.options.map((year) => (
                    <SelectItem key={year} value={year}>
                        S.Y. {year}
                        {year === schoolYear.current ? ' (current)' : ''}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
