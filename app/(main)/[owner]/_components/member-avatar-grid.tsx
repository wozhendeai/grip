import Link from 'next/link';
import { UserAvatar } from '@/components/user/user-avatar';

interface MemberAvatarGridProps {
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      image: string | null;
    } | null;
  }>;
}

/**
 * Member avatar grid - displays organization members with avatars
 *
 * Shows up to 6 member avatars with "+N more" badge for additional members.
 * Each avatar links to the member's profile.
 */
export function MemberAvatarGrid({ members }: MemberAvatarGridProps) {
  console.log('[MemberAvatarGrid] Rendering with members:', {
    totalMembers: members.length,
    displayCount: Math.min(members.length, 6),
    remainingCount: Math.max(0, members.length - 6),
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      hasUser: !!m.user,
      userName: m.user?.name,
    })),
  });

  const displayMembers = members.slice(0, 6);
  const remainingCount = members.length - 6;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {displayMembers.map((membership) => {
        if (!membership.user) return null;

        return (
          <Link
            key={membership.id}
            href={`/${membership.user.name}`}
            className="group relative"
            title={membership.user.name}
          >
            <UserAvatar
              user={membership.user}
              size="lg"
              className="border-2 border-border transition-transform group-hover:scale-110"
            />
          </Link>
        );
      })}

      {remainingCount > 0 && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border bg-muted text-sm font-medium text-muted-foreground">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
