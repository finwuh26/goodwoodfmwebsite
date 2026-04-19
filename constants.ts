import { 
  Home, Radio, FileText, MessageCircle, Send, Mail, 
  ShoppingBag, User, Music, Mic, Code, Shield, Star, 
  Settings, Heart, Headphones
} from 'lucide-react';
import { NavItem, StaffMember, Article, ScheduleItem } from './types';

export const NAV_ITEMS: NavItem[] = [
  { 
    label: 'HOME', 
    href: '/', 
    icon: Home,
    subItems: [
      { label: 'Home', href: '/' },
      { label: 'Meet the Team', href: '/team' }
    ]
  },
  { 
    label: 'Radio', 
    href: '/timetable', 
    icon: Radio,
    subItems: [
      { label: 'Timetable', href: '/timetable' },
      { label: 'Presenter Applications', href: '/apply/presenter' }
    ]
  },
  { 
    label: 'Content', 
    href: '/content', 
    icon: FileText,
    subItems: [
      { label: 'Articles', href: '/content' },
      { label: 'Reporter Applications', href: '/apply/reporter' }
    ]
  },
  { 
    label: 'Community', 
    href: '/community/all', 
    icon: MessageCircle,
    subItems: [
      { label: 'Verified Members', href: '/community/verified' },
      { label: 'All Members', href: '/community/all' },
      { label: 'Discord Server', href: 'https://discord.gg/goodwood' }
    ]
  },
  { label: 'Jobs', href: '/jobs', icon: Send },
  { 
    label: 'Contact', 
    href: '/contact/general', 
    icon: Mail,
    subItems: [
      { label: 'Standard Enquiry', href: '/contact/general' },
      { label: 'Partnership Enquiry', href: '/contact/partnership' },
      { label: 'Site Feedback', href: '/contact/feedback' }
    ]
  },
];

export const STAFF: StaffMember[] = [];
export const ARTICLES: Article[] = [];
export const SCHEDULE: ScheduleItem[] = [];

export const LEGAL_NOTICE_VERSION = '2026-04-uk-legal-v1';
export const LEGAL_NOTICE_REASON = 'We updated our UK-focused Terms, Privacy Policy, and cookie information and require renewed acceptance.';
