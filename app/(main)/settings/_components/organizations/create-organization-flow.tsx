'use client';

import { authClient } from '@/lib/auth/auth-client';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { GitHubOrgPicker } from './github-org-picker';
import { OrganizationTypeSelector } from './organization-type-selector';
import { StandaloneOrgForm } from './standalone-org-form';

/**
 * CreateOrganizationFlow - Multi-step organization creation
 *
 * Extracted from CreateOrganizationModal for reuse in:
 * - Dialog modal (full page settings)
 * - Inline view (modal settings)
 *
 * Steps:
 * 1. select-type: Choose GitHub-linked or standalone
 * 2. github-picker: Select GitHub org (if GitHub chosen)
 * 2. standalone-form: Enter name/slug (if standalone chosen)
 */

type CreateOrganizationFlowProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
  showHeader?: boolean;
};

type Step = 'select-type' | 'github-picker' | 'standalone-form';

export function CreateOrganizationFlow({
  onSuccess,
  onCancel,
  showHeader = true,
}: CreateOrganizationFlowProps) {
  const [step, setStep] = useState<Step>('select-type');
  const [error, setError] = useState<string | null>(null);

  function handleSelectType(type: 'github' | 'standalone') {
    setError(null);
    if (type === 'github') {
      setStep('github-picker');
    } else {
      setStep('standalone-form');
    }
  }

  async function handleGitHubOrgSelect(githubOrg: {
    id: number;
    login: string;
    avatar_url: string;
    name: string | null;
  }) {
    try {
      setError(null);

      const result = await authClient.organization.create({
        name: githubOrg.name || githubOrg.login,
        slug: githubOrg.login.toLowerCase(),
        logo: githubOrg.avatar_url,
        githubOrgId: githubOrg.id.toString(),
        githubOrgLogin: githubOrg.login,
        syncMembership: true,
      });

      if (result.data?.id) {
        await authClient.organization.setActive({
          organizationId: result.data.id,
        });
      }

      onSuccess?.();
    } catch (error) {
      console.error('Failed to create GitHub-linked org:', error);
      setError('Failed to create organization. Please try again.');
    }
  }

  async function handleStandaloneSubmit(data: { name: string; slug: string }) {
    try {
      setError(null);

      const result = await authClient.organization.create({
        name: data.name,
        slug: data.slug,
        syncMembership: false,
      });

      if (result.data?.id) {
        await authClient.organization.setActive({
          organizationId: result.data.id,
        });
      }

      onSuccess?.();
    } catch (error) {
      console.error('Failed to create standalone org:', error);
      setError('Failed to create organization. Please try again.');
    }
  }

  function handleBack() {
    setError(null);
    setStep('select-type');
  }

  const title = {
    'select-type': 'Create Organization',
    'github-picker': 'Select GitHub Organization',
    'standalone-form': 'Organization Details',
  }[step];

  const description = {
    'select-type': 'Choose how to create your organization',
    'github-picker': 'Select an organization you admin on GitHub',
    'standalone-form': 'Enter your organization details',
  }[step];

  return (
    <div className="space-y-4">
      {showHeader && (
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {step === 'select-type' && <OrganizationTypeSelector onSelectType={handleSelectType} />}

      {step === 'github-picker' && (
        <GitHubOrgPicker onSelect={handleGitHubOrgSelect} onBack={handleBack} />
      )}

      {step === 'standalone-form' && (
        <StandaloneOrgForm onSubmit={handleStandaloneSubmit} onBack={handleBack} />
      )}
    </div>
  );
}
