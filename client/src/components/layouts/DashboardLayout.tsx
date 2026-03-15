import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth }                         from '@/context/AuthContext';
import { api }                             from '@/lib/api';
import type { JobOpening }                 from '@/lib/api';
import {
  Sidebar, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  LayoutDashboard, Users, Calendar, FileText,
  Settings, LogOut, Building, ChevronUp, User,
  UserRoundPen, Receipt, CircleDollarSign,
  FolderKanban, Plus, ChevronRight, Loader2,
  Briefcase, ShieldCheck
} from 'lucide-react';
import type { Permission } from '@/lib/config';

interface DashboardLayoutProps { children: ReactNode }

interface NavItem {
  href:        string;
  label:       string;
  icon:        React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

// ─── Static nav ──────────────────────────────────────────────────────────────
const NAV_MAIN: NavItem[] = [
  { href: '/dashboard',  label: 'Dashboard',         icon: LayoutDashboard                          },
  { href: '/profile',    label: 'My Profile',         icon: UserRoundPen                             },
  { href: '/my-payslips',label: 'My Payslips',        icon: Receipt                                  },
  { href: '/payslips',   label: 'Employee Payslips',  icon: Receipt,          permission: 'view_record'    },
  { href: '/employees',  label: 'Employees',          icon: Users,            permission: 'view_record'    },
  { href: '/leaves',     label: 'Leaves',             icon: Calendar,         permission: 'apply_leave'    },
  { href: '/reports',    label: 'Reports',            icon: FileText,         permission: 'view_record'    },
  { href: '/payroll',    label: 'Payroll',            icon: CircleDollarSign, permission: 'payroll_record' },
];

const NAV_ADMIN: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings, permission: 'settings_view' },
  { href: '/super-admin',  label: 'Tenant Provisioning', icon: ShieldCheck, permission: 'admin_view'   },
];

// ─── Recruitment sub-menu ─────────────────────────────────────────────────────
function RecruitmentNav() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const [isOpen,    setIsOpen]    = useState(
    location.pathname.startsWith('/recruitment')
  );
  const [jobs,      setJobs]      = useState<JobOpening[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Only hr_manager / super_admin can see recruitment
  const canView =
    user?.role === 'hr_manager' || user?.role === 'super_admin';

  if (!canView) return null;

  // Fetch jobs when section is opened
  useEffect(() => {
    if (!isOpen) return;

    const load = async () => {
      try {
        setIsLoading(true);
        const data = await api.getJobOpenings();
        setJobs(data);
      } catch {
        // silent — board still navigable via Create Job
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isOpen]);

  const isActive = (href: string) => location.pathname.startsWith(href);

  return (
    <SidebarGroup>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>

        {/* Section header — acts as the toggle */}
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            className={`
              w-full rounded-md transition-colors px-2
              ${isActive('/recruitment')
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
            `}
          >
            <FolderKanban className={`h-4 w-4 shrink-0 mr-3
              ${isActive('/recruitment') ? 'text-gray-900' : 'text-gray-400'}`}
            />
            <span className="flex-1 text-sm">Recruitment</span>
            <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200
              ${isOpen ? 'rotate-90' : ''}`}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-1 ml-3 space-y-0.5 border-l border-gray-100 pl-3">

          {/* Create Job — always visible */}
          <SidebarMenuButton
            asChild
            className={`
              w-full rounded-md text-sm transition-colors
              ${isActive('/recruitment/create')
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
            `}
          >
            <Link to="/recruitment/create" className="flex items-center gap-2 py-1.5">
              <Plus className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span>Create Job</span>
            </Link>
          </SidebarMenuButton>

          {/* Divider */}
          {(isLoading || jobs.length > 0) && (
            <p className="px-1 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Active Jobs
            </p>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-2 px-1 py-2 text-xs text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading jobs...
            </div>
          )}

          {/* Job list */}
          {!isLoading && jobs.map(job => {
            const href    = `/recruitment/job/${job._id}`;
            const active  = location.pathname === href;

            return (
              <SidebarMenuButton
                key={job._id}
                asChild
                className={`
                  w-full rounded-md text-sm transition-colors
                  ${active
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                <Link to={href} className="flex items-center gap-2 py-1.5">
                  <Briefcase className="h-3.5 w-3.5 shrink-0 text-gray-400 flex-none" />
                  <span className="truncate">{job.title}</span>
                  {job.status === 'Published' && (
                    <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                  )}
                </Link>
              </SidebarMenuButton>
            );
          })}

          {/* Empty state */}
          {!isLoading && jobs.length === 0 && (
            <div className="px-1 py-2 text-xs text-gray-400">
              No active jobs.{' '}
              <button
                type="button"
                onClick={() => navigate('/recruitment/create')}
                className="text-blue-500 hover:underline"
              >
                Create one.
              </button>
            </div>
          )}

        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function AppSidebar() {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (href: string) =>
    href === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(href);

  const handleLogout = () => { logout(); navigate('/login'); };

  const visibleMain  = NAV_MAIN.filter(
    item => !item.permission || hasPermission(item.permission)
  );
  const visibleAdmin = NAV_ADMIN.filter(
    item => !item.permission || hasPermission(item.permission)
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-gray-200 bg-white">

      {/* Brand */}
      <SidebarHeader className="border-b border-gray-100 px-4 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="hover:bg-gray-50">
              <Link to="/dashboard" className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-900">
                  <Building className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-gray-900">NexusHR</span>
                  <span className="text-xs text-gray-500 truncate max-w-[120px]">
                    {user?.orgId === 'ORG-1001' ? 'Nexus Tech' : user?.orgId}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className="px-2 py-3">

        {/* Main items */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-1">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map(item => {
                const Icon   = item.icon;
                const active = isActive(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild isActive={active} tooltip={item.label}
                      className={`w-full rounded-md transition-colors
                        ${active
                          ? 'bg-gray-100 text-gray-900 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
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

        {/* Recruitment section */}
        <SidebarSeparator className="my-2 bg-gray-100" />
        <SidebarGroupLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider px-4 mb-1">
          Recruitment
        </SidebarGroupLabel>
        <RecruitmentNav />

        {/* Admin section */}
        {visibleAdmin.length > 0 && (
          <>
            <SidebarSeparator className="my-2 bg-gray-100" />
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-1">
                Administration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleAdmin.map(item => {
                    const Icon   = item.icon;
                    const active = isActive(item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild isActive={active} tooltip={item.label}
                          className={`w-full rounded-md transition-colors
                            ${active
                              ? 'bg-gray-100 text-gray-900 font-medium'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
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

      {/* User footer */}
      <SidebarFooter className="border-t border-gray-100 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="w-full rounded-md hover:bg-gray-50">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex flex-col leading-tight flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate">{user?.name}</span>
                    <span className="text-xs text-gray-500 capitalize truncate">
                      {user?.role.replace('_', ' ')}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4 text-gray-400 shrink-0" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-gray-900">{user?.name}</span>
                    <span className="text-xs text-gray-500 truncate">{user?.email}</span>
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
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4">
            <SidebarTrigger className="text-gray-500 hover:text-gray-900" />
            <div className="h-4 w-px bg-gray-200" />
            <span className="text-sm text-gray-500">NexusHR Portal</span>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}