import type { User, UserRole } from '@/types/auth';

export const roleLabels: Record<UserRole, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    registrar: 'Registrar',
    teacher: 'Teacher',
};

/** Super admins implicitly hold every role (mirrors User::hasRole). */
export function hasRole(user: User, ...roles: UserRole[]): boolean {
    return user.role === 'super_admin' || roles.includes(user.role);
}
