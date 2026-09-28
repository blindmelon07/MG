export type UserRole = 'super_admin' | 'admin' | 'registrar' | 'teacher';

export type GradingSystem = 'k12' | 'college';

export type User = {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
    student: StudentAccount | null;
};

export type StudentAccount = {
    id: number;
    name: string;
    student_number: string;
    grade_level: string | null;
    section: string | null;
    grading_system: GradingSystem;
};

/* @chisel-passkeys */
export type Passkey = {
    id: number;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};
/* @end-chisel-passkeys */

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
