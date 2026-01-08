import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { ExternalLink } from 'lucide-react';

export interface ProfileContentProps {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export function ProfileContent({ user }: ProfileContentProps) {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Your account information from GitHub</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Profile information is managed through your GitHub account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <UserAvatar user={user} size="xl" />
            <div className="space-y-1">
              <p className="text-lg font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="grid gap-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Display Name</p>
                <p className="text-sm text-muted-foreground">{user.name || 'Not set'}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user.email || 'Not set'}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a
                  href="https://github.com/settings/profile"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Edit on GitHub
                  <ExternalLink className="ml-2 size-4" />
                </a>
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
