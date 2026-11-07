import { Link, usePage } from '@inertiajs/react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SortState = { sort: string; direction: 'asc' | 'desc' };

/**
 * A table header that sorts by its column on click, and flips the direction
 * when clicked again. Sorting goes back to the first page of that table.
 */
export function SortableHeader({
    column,
    state,
    children,
    sortKey = 'sort',
    directionKey = 'direction',
    pageKey = 'page',
    defaultDirection = 'asc',
    className,
}: {
    column: string;
    state: SortState;
    children: ReactNode;
    sortKey?: string;
    directionKey?: string;
    pageKey?: string;
    defaultDirection?: 'asc' | 'desc';
    className?: string;
}) {
    const { url } = usePage();
    const active = state.sort === column;
    const next = active
        ? state.direction === 'asc'
            ? 'desc'
            : 'asc'
        : defaultDirection;

    const target = new URL(url, 'http://localhost');
    target.searchParams.set(sortKey, column);
    target.searchParams.set(directionKey, next);
    target.searchParams.delete(pageKey);

    const Icon = active
        ? state.direction === 'asc'
            ? ArrowUp
            : ArrowDown
        : ArrowUpDown;

    return (
        <th
            className={cn('px-4 py-2 font-medium', className)}
            aria-sort={
                active
                    ? state.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                    : 'none'
            }
        >
            <Link
                href={target.pathname + target.search}
                preserveScroll
                preserveState
                className={cn(
                    'inline-flex items-center gap-1 hover:text-foreground',
                    className?.includes('text-right') && 'flex-row-reverse',
                )}
            >
                {children}
                <Icon
                    className={cn(
                        'size-3.5',
                        active ? 'text-foreground' : 'text-muted-foreground/60',
                    )}
                />
            </Link>
        </th>
    );
}
