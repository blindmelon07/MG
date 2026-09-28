import { Form } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/student/login';

export default function StudentLoginForm({ kiosk }: { kiosk: boolean }) {
    return (
        <Form
            {...store.form()}
            resetOnSuccess={['password']}
            resetOnError={['password']}
            className="flex flex-col gap-6"
        >
            {({ processing, errors }) => (
                <>
                    {kiosk && <input type="hidden" name="kiosk" value="1" />}

                    <div className="grid gap-2">
                        <Label htmlFor="student_number">Student number</Label>
                        <Input
                            id="student_number"
                            name="student_number"
                            required
                            autoFocus
                            autoComplete={kiosk ? 'off' : 'username'}
                            placeholder="e.g. LRN-00012345"
                            className={kiosk ? 'h-12 text-lg' : undefined}
                        />
                        <InputError message={errors.student_number} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <PasswordInput
                            id="password"
                            name="password"
                            required
                            autoComplete={kiosk ? 'off' : 'current-password'}
                            placeholder="Password"
                            className={kiosk ? 'h-12 text-lg' : undefined}
                        />
                        <InputError message={errors.password} />
                    </div>

                    {!kiosk && (
                        <div className="flex items-center space-x-3">
                            <Checkbox id="remember" name="remember" />
                            <Label htmlFor="remember">Remember me</Label>
                        </div>
                    )}

                    <Button
                        type="submit"
                        size={kiosk ? 'lg' : 'default'}
                        className="w-full"
                        disabled={processing}
                    >
                        {processing && <Spinner />}
                        Sign in
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                        First time? Use the temporary password from the
                        Registrar&apos;s Office. Forgot it? Ask them for a new
                        one.
                    </p>
                </>
            )}
        </Form>
    );
}
