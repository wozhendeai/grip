import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  user: {
    name?: string | null;
    image?: string | null;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

/**
 * User avatar with fallback to initials
 *
 * Sizes:
 * - sm: 24px (inline with text)
 * - md: 32px (default, nav/cards)
 * - lg: 48px (profile headers)
 * - xl: 64px (large profile views)
 */
export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={user.image ?? undefined} alt={user.name ?? 'User'} />
      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
    </Avatar>
  );
}
