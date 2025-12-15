import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/user/user-avatar';
import { getSession } from '@/lib/auth-server';
import { getAccessKeysByUser } from '@/lib/db/queries/access-keys';
import { getPasskeysByUser } from '@/lib/db/queries/passkeys';
import { redirect } from 'next/navigation';
import { AccessKeyManager } from './_components/access-key-manager';
import { PasskeyManager } from './_components/passkey-manager';
import { SignOutButton } from './_components/sign-out-button';

/**
 * Settings page (protected) - Server component with small client components
 *
 * Server component pattern:
 * - Fetches user session and passkey data server-side (SSR)
 * - Renders static parts (profile info, card layouts)
 * - Embeds small client components for interactive parts:
 *   - PasskeyManager (wallet creation/deletion)
 *   - SignOutButton (sign out action)
 *
 * User account settings and passkey/wallet management.
 */

export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }

  // Fetch passkey and access key data server-side
  const passkeys = await getPasskeysByUser(session.user.id);
  const wallet = passkeys.find((p) => p.tempoAddress) ?? null;
  const accessKeysRaw = await getAccessKeysByUser(session.user.id);

  // Type assertion: limits field is JSONB in DB, typed as unknown
  // Convert BigInt expiry to number for JSON serialization
  const accessKeys = accessKeysRaw.map((key) => ({
    ...key,
    limits: key.limits as Record<string, { initial: string; remaining: string }>,
    expiry: key.expiry ? Number(key.expiry) : null,
  }));

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header - Server rendered */}
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and wallet settings.</p>
        </div>

        {/* Profile - Server rendered */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account information from GitHub</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar user={session.user} size="xl" />
              <div>
                <p className="font-medium">{session.user.name}</p>
                <p className="text-sm text-muted-foreground">{session.user.email}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Profile information is managed through your GitHub account.
            </p>
          </CardContent>
        </Card>

        {/* Wallet / Passkey - Client component for mutations */}
        <Card>
          <CardHeader>
            <CardTitle>Wallet</CardTitle>
            <CardDescription>
              Your Tempo wallet is secured by a passkey (TouchID, FaceID, or security key)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasskeyManager wallet={wallet} />
          </CardContent>
        </Card>

        {/* Access Keys - Auto-pay authorization (only show if wallet exists) */}
        {wallet && <AccessKeyManager initialKeys={accessKeys} credentialId={wallet.credentialID} />}

        {/* Danger Zone - Client component for sign out */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sign Out</p>
                <p className="text-sm text-muted-foreground">
                  Sign out of your account on this device.
                </p>
              </div>
              <SignOutButton />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
