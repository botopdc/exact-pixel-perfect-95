import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SubNavItem, SubNavTab, isSubNavAllowed } from '@/config/modulesConfig';
import { getEffectiveRoles } from '@/lib/rbac';
import { useAuth } from '@/contexts/AuthContext';

interface SubNavigationProps {
  items: SubNavItem[];
  className?: string;
}

export function SubNavigation({ items, className }: SubNavigationProps) {
  const location = useLocation();
  const { profile, roles } = useAuth();
  const effectiveRoles = getEffectiveRoles(roles, profile);

  const filteredItems = items.filter(item => isSubNavAllowed(item, effectiveRoles));

  if (filteredItems.length === 0) return null;

  const isActive = (url: string) => {
    return location.pathname === url || location.pathname.startsWith(url + '/');
  };

  return (
    <nav className={cn("border-b border-border bg-muted/30", className)}>
      <div className="flex items-center gap-1 px-6 overflow-x-auto">
        {filteredItems.map((item) => (
          <Link
            key={item.id}
            to={item.url}
            className={cn(
              "px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2",
              isActive(item.url)
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {item.title}
          </Link>
        ))}
      </div>
    </nav>
  );
}

// ============================================================================
// TAB NAVIGATION (LEVEL 3)
// ============================================================================

interface TabNavigationProps {
  tabs: SubNavTab[];
  className?: string;
}

export function TabNavigation({ tabs, className }: TabNavigationProps) {
  const location = useLocation();
  const { profile, roles } = useAuth();
  const effectiveRoles = getEffectiveRoles(roles, profile);

  const filteredTabs = tabs.filter(tab => {
    return isSubNavAllowed(tab as any, effectiveRoles);
  });

  if (filteredTabs.length === 0) return null;

  const isActive = (url: string) => {
    return location.pathname === url;
  };

  return (
    <div className={cn("flex items-center gap-2 mb-6", className)}>
      {filteredTabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.url}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
            isActive(tab.url)
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          {tab.title}
        </Link>
      ))}
    </div>
  );
}
