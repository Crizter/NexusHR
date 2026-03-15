import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { ShieldCheck, Building2, LogOut, LayoutDashboard } from 'lucide-react';

interface Props { children: ReactNode; }

const NAV = [
  { href: '/super-admin',         label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/super-admin/tenants', label: 'Tenant Directory', icon: Building2       },
];

export function SuperAdminLayout({ children }: Props) {
  const navigate     = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/super-admin/login');
  };

  const isActive = (href: string) =>
    href === '/super-admin'
      ? pathname === '/super-admin'
      : pathname.startsWith(href);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gray-50">

        <Sidebar collapsible="icon" className="border-r border-gray-800 bg-gray-900">

          {/* Brand */}
          <SidebarHeader className="border-b border-gray-800 px-4 py-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild size="lg" className="hover:bg-gray-800">
                  <Link to="/super-admin" className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-600">
                      <ShieldCheck className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-400">
                        NexusHR
                      </span>
                      <span className="text-xs text-gray-500">Super Admin</span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          {/* Nav */}
          <SidebarContent className="px-2 py-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-gray-600 uppercase tracking-wider px-2 mb-1">
                Console
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.map(({ href, label, icon: Icon }) => {
                    const active = isActive(href);
                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton
                          asChild
                          className={`rounded-md transition-colors ${
                            active
                              ? 'bg-violet-600/20 text-violet-300 hover:bg-violet-600/20 hover:text-violet-300'
                              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                          }`}
                        >
                          <Link to={href} className="flex items-center gap-3">
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="text-sm">{label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Logout */}
          <SidebarFooter className="border-t border-gray-800 p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleLogout}
                  className="rounded-md text-gray-500 transition-colors hover:bg-gray-800 hover:text-red-400"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="text-sm">Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>

        </Sidebar>

        {/* Main content */}
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-gray-800 bg-gray-900 px-4">
            <SidebarTrigger className="text-gray-400 hover:text-gray-200" />
            <div className="h-4 w-px bg-gray-700" />
            <span className="text-sm text-gray-400">NexusHR Super Admin</span>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>

      </div>
    </SidebarProvider>
  );
}