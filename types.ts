import { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  subItems?: { label: string; href: string }[];
}

export interface User {
  id: string;
  username: string;
  avatar: string;
  bannerGradient?: string;
  role?: string;
  roleColor?: string;
  isOnline?: boolean;
}

export interface Article {
  id: string;
  title: string;
  summary?: string;
  content: string;
  author: User;
  date: string;
  image: string;
  category?: string;
}

export interface ScheduleItem {
  time: string;
  showName: string;
  dj?: User;
  cover?: string;
}

export interface StaffMember extends User {
  position: string;
  department: 'Leadership' | 'Management' | 'Radio' | 'Development';
  badge?: LucideIcon;
}