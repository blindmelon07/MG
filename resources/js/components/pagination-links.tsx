import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import type { Paginated } from '@/types/pagination';

/**
 * "Showing 1–15 of 40" plus the page buttons. Hidden when everything fits on
 * one page.
 */
export function PaginationLinks<T>({
    page,
    noun = 'results',
}: {
    page: Paginated<T>;
    noun?: string;
}) {
    if (page.last_page <= 1) {
        return null;
    }

    const from = (page.current_page - 1) * page.per_page + 1;
    const to = from + page.data.length - 1;

    return (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
                Showing {from}–{to} of {page.total} {noun}
            </p>
            <div className="flex flex-wrap gap-1">
                {page.links.map((link, i) => (
                    <Button
                        key={i}
                        variant={link.active ? 'default' : 'outline'}
                        size="sm"
                        disabled={!link.url}
                        asChild={!!link.url}
                    >
                        {link.url ? (
                            <Link
                                href={link.url}
                                preserveScroll
                                preserveState
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ) : (
                            <span
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        )}
                    </Button>
                ))}
            </div>
        </div>
    );
}
