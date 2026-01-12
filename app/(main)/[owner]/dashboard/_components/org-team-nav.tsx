'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface OrgMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    image: string | null;
  } | null;
}

interface OrgTeamNavProps {
  members: OrgMember[];
}

export function OrgTeamNav({ members }: OrgTeamNavProps) {
  // Filter out members without user data and take first 5
  const displayMembers = members
    .filter((m): m is OrgMember & { user: NonNullable<OrgMember['user']> } => m.user !== null)
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-muted-foreground">Team</h3>
      </div>

      {displayMembers.length === 0 ? (
        <p className="text-xs text-muted-foreground px-2">No team members.</p>
      ) : (
        <div className="space-y-1">
          {displayMembers.map((member) => (
            <Button
              key={member.id}
              variant="ghost"
              className="w-full justify-start gap-2 h-9 px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
              nativeButton={false}
              render={<Link href={`/${member.user.name}`} />}
            >
              <Avatar className="size-5">
                <AvatarImage src={member.user.image ?? ''} alt={member.user.name} />
                <AvatarFallback className="text-[9px]">
                  {member.user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{member.user.name}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
