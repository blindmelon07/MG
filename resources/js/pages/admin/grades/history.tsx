import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { roleLabels } from '@/lib/roles';
import {
    history as gradesHistory,
    index as gradesIndex,
} from '@/routes/admin/grades';
import type { UserRole } from '@/types/auth';
import type { Paginated } from '@/types/pagination';

type Values = Record<string, string | number | null>;

type Audit = {
    id: number;
    event: 'created' | 'updated' | 'deleted';
    old_values: Values | null;
    new_values: Values | null;
    ip_address: string | null;
    created_at: string;
    user: { id: number; name: string; role: UserRole } | null;
    student: { id: number; name: string; student_number: string | null } | null;
};

const eventVariant = {
    created: 'secondary',
    updated: 'default',
    deleted: 'destructive',
} as const;

function show(value: string | number | null | undefined): string {
    return value === null || value === undefined || value === ''
        ? '—'
        : String(value);
}

function describe(audit: Audit): string[] {
    const oldValues = audit.old_values ?? {};
    const newValues = audit.new_values ?? {};
    const subject = show(newValues.subject ?? oldValues.subject);

    if (audit.event !== 'updated') {
        const values = audit.event === 'created' ? newValues : oldValues;

        return [
            `${subject}, ${show(values.school_year)}${values.term ? ` ${values.term}` : ''}: final ${show(values.final_grade)}`,
        ];
    }

    return Object.keys(newValues).map(
        (key) => `${key}: ${show(oldValues[key])} → ${show(newValues[key])}`,
    );
}

export default function GradeHistory({
    audits,
    search,
}: {
    audits: Paginated<Audit>;
    search: string;
}) {
    const [searchTerm, setSearchTerm] = useState(search);

    return (
        <>
            <Head title="Grade change history" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title="Grade change history"
                    description="Every grade that was added, changed or deleted, by whom and from where. Entries can't be edited."
                />

                <form
                    className="max-w-sm"
                    onSubmit={(e) => {
                        e.preventDefault();
                        router.get(
                            gradesHistory().url,
                            searchTerm ? { search: searchTerm } : {},
                            { preserveState: true, replace: true },
                        );
                    }}
                >
                    <Input
                        placeholder="Search by student name or #"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </form>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                            <tr>
                                <th className="px-4 py-2 font-medium">When</th>
                                <th className="px-4 py-2 font-medium">
                                    Student
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Change
                                </th>
                                <th className="px-4 py-2 font-medium">By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {audits.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-4 py-6 text-center text-muted-foreground"
                                    >
                                        No grade changes recorded yet.
                                    </td>
                                </tr>
                            )}
                            {audits.data.map((audit) => (
                                <tr
                                    key={audit.id}
                                    className="border-b border-sidebar-border/70 align-top last:border-0 dark:border-sidebar-border"
                                >
                                    <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                                        {new Date(
                                            audit.created_at,
                                        ).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="font-medium">
                                            {audit.student?.name ?? '—'}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {audit.student?.student_number}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <Badge
                                            variant={eventVariant[audit.event]}
                                            className="mb-1"
                                        >
                                            {audit.event}
                                        </Badge>
                                        {describe(audit).map((line) => (
                                            <div
                                                key={line}
                                                className="tabular-nums"
                                            >
                                                {line}
                                            </div>
                                        ))}
                                    </td>
                                    <td className="px-4 py-2">
                                        {audit.user ? (
                                            <>
                                                <div>{audit.user.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {
                                                        roleLabels[
                                                            audit.user.role
                                                        ]
                                                    }
                                                    {audit.ip_address &&
                                                        ` · ${audit.ip_address}`}
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                System
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {audits.links.length > 3 && (
                    <div className="flex flex-wrap gap-1">
                        {audits.links.map((link, i) => (
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
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ) : (
                                    <span
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                )}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

GradeHistory.layout = {
    breadcrumbs: [
        { title: 'Grades', href: gradesIndex() },
        { title: 'Change history', href: gradesHistory() },
    ],
};
