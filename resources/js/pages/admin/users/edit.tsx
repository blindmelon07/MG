import { Form, Head } from '@inertiajs/react';
import UserController from '@/actions/App/Http/Controllers/Admin/UserController';
import UserTwoFactorController from '@/actions/App/Http/Controllers/Admin/UserTwoFactorController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { PhoneInput } from '@/components/phone-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { roleLabels } from '@/lib/roles';
import { edit, index as usersIndex } from '@/routes/admin/users';
import type { UserRole } from '@/types/auth';

type ManagedUser = {
    id: number;
    name: string;
    email: string;
    phone_number: string | null;
    role: UserRole;
    two_factor_enabled: boolean;
};

export default function UsersEdit({ editedUser }: { editedUser: ManagedUser }) {
    return (
        <>
            <Head title={`Edit ${editedUser.name}`} />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <Heading
                    title="Edit User"
                    description="Update this user's details, role, or password."
                />

                <Form
                    {...UserController.update.form(editedUser.id)}
                    resetOnSuccess={['password', 'password_confirmation']}
                    className="max-w-md space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    autoComplete="name"
                                    defaultValue={editedUser.name}
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoComplete="email"
                                    defaultValue={editedUser.email}
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="phone_number">
                                    Mobile number (optional)
                                </Label>
                                <PhoneInput
                                    id="phone_number"
                                    name="phone_number"
                                    defaultValue={editedUser.phone_number ?? ''}
                                />
                                <p className="text-sm text-muted-foreground">
                                    Used to text announcements and events sent
                                    to personnel.
                                </p>
                                <InputError message={errors.phone_number} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="role">Role</Label>
                                <Select
                                    name="role"
                                    defaultValue={editedUser.role}
                                >
                                    <SelectTrigger id="role" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(roleLabels).map(
                                            ([value, label]) => (
                                                <SelectItem
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.role} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password">New password</Label>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    autoComplete="new-password"
                                    placeholder="Leave blank to keep current password"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation">
                                    Confirm new password
                                </Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    autoComplete="new-password"
                                />
                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <Button type="submit" disabled={processing}>
                                    Save Changes
                                </Button>
                            </div>
                        </>
                    )}
                </Form>

                {editedUser.two_factor_enabled && (
                    <div className="max-w-md space-y-3 border-t border-sidebar-border/70 pt-6 dark:border-sidebar-border">
                        <Heading
                            variant="small"
                            title="Two-factor authentication"
                            description="Reset it if this person lost their phone and recovery codes. Confirm who they are first; anyone with their password could then sign in without a code until 2FA is set up again."
                        />
                        <Form
                            {...UserTwoFactorController.destroy.form(
                                editedUser.id,
                            )}
                            options={{ preserveScroll: true }}
                            onBefore={() =>
                                confirm(
                                    `Reset two-factor authentication for ${editedUser.name}?`,
                                )
                            }
                        >
                            {({ processing }) => (
                                <Button
                                    type="submit"
                                    variant="destructive"
                                    disabled={processing}
                                >
                                    Reset two-factor
                                </Button>
                            )}
                        </Form>
                    </div>
                )}
            </div>
        </>
    );
}

UsersEdit.layout = (page: { editedUser: ManagedUser }) => ({
    breadcrumbs: [
        { title: 'Users', href: usersIndex() },
        { title: 'Edit', href: edit(page.editedUser.id) },
    ],
});
