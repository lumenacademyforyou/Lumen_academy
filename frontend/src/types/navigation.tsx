import type { ElementType } from 'react';

export interface NavItem {
  name: string;
  path: string;
  icon: ElementType;
  badge?: string;
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}
