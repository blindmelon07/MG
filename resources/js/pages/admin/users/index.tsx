import { Form, Head, Link, usePage } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import UserController from '@/actions/App/Http/Controllers/Admin/UserController';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { create, edit, index as usersIndex } from '@/routes/admin/users';
import type { Auth } from '@/types';

type ManagedUser = {
    id: number;
    name: string;
    email: string;
    role: 'super_admin' | 'admin';
    created_at: string;
};

export default function UsersIndex({ users }: { users: ManagedUser[] }) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const [deleting, setDeleting] = useState<ManagedUser | null>(null);

    return (
        <>
            <Head title="Users" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <Heading
                        title="Users"
                        description="Manage admin and super admin accounts."
                    />

                    <Button asChild>
                        <Link href={create()}>
                            <Plus /> New User
                        </Link>
                    </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                    <table className="w-full text-sm">
                        <thead className="border-b border-sidebar-border/70 bg-muted/50 text-left dark:border-sidebar-border">
                            <tr>
                                <th className="px-4 py-2 font-medium">
                                    Name
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Email
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    Role
                                </th>
                                <th className="px-4 py-2 font-medium">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr
                                    key={user.id}
                                    className="border-b border-sidebar-border/70 last:border-0 dark:border-sidebar-border"
                                >
                                    <td className="px-4 py-2 font-medium">
                                        {user.name}
                                        {user.id === auth.user.id && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                (you)
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {user.email}
                                    </td>
                                    <td className="px-4 py-2">
                                        <Badge
                                            variant={
                                                user.role === 'super_admin'
                                                    ? 'default'
                                                    : 'secondary'
                                            }
                                        >
                                            {user.role === 'super_admin'
                                                ? 'Super Admin'
                                                : 'Admin'}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                            >
                                                <Link href={edit(user.id)}>
                                                    <Pencil />
                                                    <span className="sr-only">
                                                        Edit
                                                    </span>
                                                </Link>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={
                                                    user.id === auth.user.id
                                                }
                                                onClick={() =>
                                                    setDeleting(user)
                                                }
                                            >
                                                <Trash2 />
                                                <span className="sr-only">
                                                    Delete
                                                </span>
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete user?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will permanently delete &quot;{deleting?.name}
                        &quot;.
                    </p>
                    {deleting && (
                        <Form
                            {...UserController.destroy.form(deleting.id)}
                            onSuccess={() => setDeleting(null)}
                        >
                            {({ processing }) => (
                                <DialogFooter className="mt-4">
                                    <DialogClose asChild>
                                        <Button variant="secondary">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        variant="destructive"
                                        disabled={processing}
                                    >
                                        Delete
                                    </Button>
                                </DialogFooter>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

UsersIndex.layout = {
    breadcrumbs: [
        {
            title: 'Users',
            href: usersIndex(),
        },
    ],
};
