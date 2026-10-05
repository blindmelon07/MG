import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';

/** A Philippine mobile number: exactly 11 digits, starting with 09. */
export function PhoneInput(props: ComponentProps<typeof Input>) {
    return (
        <Input
            type="tel"
            inputMode="numeric"
            maxLength={11}
            pattern="09[0-9]{9}"
            title="Exactly 11 digits, starting with 09 (e.g. 09171234567)"
            placeholder="09171234567"
            autoComplete="off"
            onInput={(e) => {
                const input = e.currentTarget;
                input.value = input.value.replace(/\D/g, '').slice(0, 11);
            }}
            {...props}
        />
    );
}
