import { Link, usePage } from '@inertiajs/react';
import {
    BookOpen,
    GraduationCap,
    LayoutGrid,
    Megaphone,
    Tags,
    Users,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { index as announcementsIndex } from '@/routes/admin/announcements';
import { index as manualCategoriesIndex } from '@/routes/admin/manual-categories';
import { index as manualsIndex } from '@/routes/admin/manuals';
import { index as studentsIndex } from '@/routes/admin/students';
import { index as usersIndex } from '@/routes/admin/users';
import type { Auth, NavItem } from '@/types';

export function AppSidebar() {
    const { auth } = usePage<{ auth: Auth }>().props;

    const mainNavItems: NavItem[] = [
        {
            title: 'Dashboard',
            href: dashboard(),
            icon: LayoutGrid,
        },
        {
            title: 'Manuals',
            href: manualsIndex(),
            icon: BookOpen,
        },
        {
            title: 'Manual Categories',
            href: manualCategoriesIndex(),
            icon: Tags,
        },
        {
            title: 'Announcements',
            href: announcementsIndex(),
            icon: Megaphone,
        },
        {
            title: 'Students',
            href: studentsIndex(),
            icon: GraduationCap,
        },
        ...(auth.user.role === 'super_admin'
            ? [
                  {
                      title: 'Users',
                      href: usersIndex(),
                      icon: Users,
                  },
              ]
            : []),
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
