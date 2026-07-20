import { Head, Link, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { index as manualsIndex, show as manualShow } from '@/routes/manuals';

type Category = {
    id: number;
    name: string;
    slug: string;
};

type Manual = {
    id: number;
    manual_category_id: number;
    title: string;
    slug: string;
    content: string;
};

export default function KioskManualsIndex({
    manuals,
    categories,
    filters,
}: {
    manuals: Manual[];
    categories: Category[];
    filters: { category?: string; q?: string };
}) {
    const [query, setQuery] = useState(filters.q ?? '');

    function search(e: React.FormEvent) {
        e.preventDefault();
        router.get(
            manualsIndex().url,
            { q: query || undefined, category: filters.category },
            { preserveState: true, replace: true },
        );
    }

    return (
        <>
            <Head title="School Manual" />

            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        School Manual
                    </h1>
                    <p className="text-muted-foreground">
                        Browse institutional policies and student services.
                    </p>
                </div>

                <form
                    onSubmit={search}
                    className="flex max-w-lg items-center gap-2"
                >
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search the school manual..."
                        aria-label="Search manuals"
                    />
                    <Button type="submit" size="icon" variant="secondary">
                        <Search />
                        <span className="sr-only">Search</span>
                    </Button>
                </form>

                <div className="flex flex-wrap gap-2">
                    <Link
                        href={manualsIndex({
                            query: { q: filters.q || undefined },
                        })}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                            !filters.category
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-sidebar-border/70 hover:bg-accent dark:border-sidebar-border'
                        }`}
                    >
                        All
                    </Link>
                    {categories.map((category) => (
                        <Link
                            key={category.id}
                            href={manualsIndex({
                                query: {
                                    category: category.slug,
                                    q: filters.q || undefined,
                                },
                            })}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                                filters.category === category.slug
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-sidebar-border/70 hover:bg-accent dark:border-sidebar-border'
                            }`}
                        >
                            {category.name}
                        </Link>
                    ))}
                </div>

                {manuals.length === 0 ? (
                    <p className="text-muted-foreground">
                        No manuals found. Try a different search or
                        category.
                    </p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {manuals.map((manual) => (
                            <Link key={manual.id} href={manualShow(manual.slug)}>
                                <Card className="h-full transition-colors hover:border-primary">
                                    <CardHeader>
                                        <CardTitle>{manual.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="line-clamp-3 text-sm text-muted-foreground">
                                        {manual.content}
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
