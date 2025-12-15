'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { GeneralSettings } from './general-settings';
import { TreasurySettings } from './treasury-settings';
import { WebhookSettings } from './webhook-settings';

interface SettingsLayoutProps {
  githubRepoId: number;
  owner: string;
  repo: string;
}

/**
 * Settings page layout with tabs
 *
 * Client component to handle tab state.
 * Each tab renders its own settings section.
 */
export function SettingsLayout({ githubRepoId, owner, repo }: SettingsLayoutProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href={`/${owner}/${repo}`} className="hover:text-foreground transition-colors">
            {owner}/{repo}
          </Link>
          <span>/</span>
          <span className="text-foreground">Settings</span>
        </div>
        <h1 className="text-2xl font-bold">Repo Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your bounty program settings</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="treasury" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="treasury">Treasury</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettings githubRepoId={githubRepoId} />
        </TabsContent>

        <TabsContent value="treasury">
          <TreasurySettings githubRepoId={githubRepoId} />
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhookSettings githubRepoId={githubRepoId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
