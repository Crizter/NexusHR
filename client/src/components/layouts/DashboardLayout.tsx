import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Settings,
  LogOut,
  Building,
  ChevronUp,
  User,
} from 'lucide-react';
import type { Permission } from '@/lib/config';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  href:        string;
  label:       string;
  icon:        React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

// ─── Navigation items ─────────────────────────────────────────────────────────
const NAV_MAIN: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees',  icon: Users,     permission: 'view_record'    },
  { href: '/leaves',    label: 'Leaves',     icon: Calendar,  permission: 'apply_leave'    },
  { href: '/reports',   label: 'Reports',    icon: FileText,  permission: 'view_record'    },
];

const NAV_ADMIN: NavItem[] = [
  { href: '/settings',  label: 'Settings',   icon: Settings,  permission: 'admin_view'     },
];

// ─── Inner sidebar (consumes auth) ───────────────────────────────────────────
function AppSidebar() {
  const { user, logout, hasPermission } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();

  const isActive = (href: string) =>
    href === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(href);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter nav items the current role can see
  const visibleMain  = NAV_MAIN.filter(
    item => !item.permission || hasPermission(item.permission)
  );
  const visibleAdmin = NAV_ADMIN.filter(
    item => !item.permission || hasPermission(item.permission)
  );

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-gray-200 bg-white"
    >

      {/* ── Logo / brand ──────────────────────────────────────────────── */}
      <SidebarHeader className="border-b border-gray-100 px-4 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="hover:bg-gray-50 data-[active=true]:bg-gray-50"
            >
              <Link to="/dashboard" className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-900">
                  <Building className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-gray-900">
                    NexusHR
                  </span>
                  <span className="text-xs text-gray-500 truncate max-w-[120px]">
                    {user?.orgId === 'ORG-1001' ? 'Nexus Tech' : user?.orgId}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Main navigation ───────────────────────────────────────────── */}
      <SidebarContent className="px-2 py-3">

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-1">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => {
                const Icon     = item.icon;
                const active   = isActive(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className={`
                        w-full rounded-md transition-colors
                        ${active
                          ? 'bg-gray-100 text-gray-900 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }
                      `}
                    >
                      <Link to={item.href} className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-gray-900' : 'text-gray-400'}`} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin section — only rendered when at least one item is visible */}
        {visibleAdmin.length > 0 && (
          <>
            <SidebarSeparator className="my-2 bg-gray-100" />
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-1">
                Administration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleAdmin.map((item) => {
                    const Icon   = item.icon;
                    const active = isActive(item.href);

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          className={`
                            w-full rounded-md transition-colors
                            ${active
                              ? 'bg-gray-100 text-gray-900 font-medium'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }
                          `}
                        >
                          <Link to={item.href} className="flex items-center gap-3">
                            <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-gray-900' : 'text-gray-400'}`} />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* ── User menu at the bottom ────────────────────────────────────── */}
      <SidebarFooter className="border-t border-gray-100 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="w-full rounded-md hover:bg-gray-50 data-[state=open]:bg-gray-50"
                >
                  {/* Avatar */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>

                  {/* Name + role */}
                  <div className="flex flex-col leading-tight flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {user?.name}
                    </span>
                    <span className="text-xs text-gray-500 capitalize truncate">
                      {user?.role.replace('_', ' ')}
                    </span>
                  </div>

                  <ChevronUp className="ml-auto h-4 w-4 text-gray-400 shrink-0" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side="top"
                align="start"
                className="w-56 mb-1"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-gray-900">
                      {user?.name}
                    </span>
                    <span className="text-xs text-gray-500 truncate">
                      {user?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

    </Sidebar>
  );
}

// ─── Layout wrapper ───────────────────────────────────────────────────────────
export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gray-50">

        <AppSidebar />

        {/* ── Main area ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-w-0">

          {/* Topbar — only contains the sidebar toggle + breadcrumb area */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4">
            <SidebarTrigger className="text-gray-500 hover:text-gray-900" />
            <div className="h-4 w-px bg-gray-200" />
            <span className="text-sm text-gray-500">
              {/* Breadcrumb slot — extend later */}
              NexusHR Portal
            </span>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>

        </div>
      </div>
    </SidebarProvider>
  );
}