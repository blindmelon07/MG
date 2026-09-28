import { Form } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { update } from '@/routes/student/password';

export default function StudentPasswordForm({
    mustChange,
}: {
    mustChange: boolean;
}) {
    return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    {mustChange ? 'Set your password' : 'Change password'}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Use at least 8 characters. Don&apos;t use your student
                    number.
                </p>
            </div>

            {mustChange && (
                <Alert>
                    <AlertTitle>Replace your temporary password</AlertTitle>
                    <AlertDescription>
                        You signed in with your student number. Choose a new
                        password to see your grades.
                    </AlertDescription>
                </Alert>
            )}

            <Form
                {...update.form()}
                resetOnError
                resetOnSuccess
                className="flex flex-col gap-5"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-2">
                            <Label htmlFor="current_password">
                                Current password
                            </Label>
                            <PasswordInput
                                id="current_password"
                                name="current_password"
                                required
                                autoComplete="current-password"
                            />
                            <InputError message={errors.current_password} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password">New password</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                required
                                autoComplete="new-password"
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
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            Save password
                        </Button>
                    </>
                )}
            </Form>
        </div>
    );
}
