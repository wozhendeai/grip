'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { authClient } from '@/lib/auth/auth-client';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface GeneralSettingsProps {
  githubRepoId: number;
}

type ContributorEligibility = 'anyone' | 'collaborators';

interface RepoSettingsData {
  repoSettings: {
    autoPayEnabled: boolean;
    requireOwnerApproval: boolean;
    contributorEligibility: ContributorEligibility;
    showAmountsPublicly: boolean;
    emailOnSubmission: boolean;
    emailOnMerge: boolean;
    emailOnPaymentFailure: boolean;
  };
}

/**
 * General repo settings
 *
 * Allows repo owners to configure:
 * - Auto-pay on PR merge
 * - Contributor eligibility
 * - Privacy settings
 * - Email notifications
 */
export function GeneralSettings({ githubRepoId }: GeneralSettingsProps) {
  // Payout settings
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [requireOwnerApproval, setRequireOwnerApproval] = useState(false);
  const [hasAccessKey, setHasAccessKey] = useState(false);

  // Contributor eligibility
  const [contributorEligibility, setContributorEligibility] =
    useState<ContributorEligibility>('anyone');

  // Privacy
  const [showAmountsPublicly, setShowAmountsPublicly] = useState(true);

  // Email notifications
  const [emailOnSubmission, setEmailOnSubmission] = useState(true);
  const [emailOnMerge, setEmailOnMerge] = useState(true);
  const [emailOnPaymentFailure, setEmailOnPaymentFailure] = useState(true);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current settings and access key status
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        const [settingsRes, accessKeysResult] = await Promise.all([
          fetch(`/api/repo-settings/${githubRepoId}`),
          authClient.listAccessKeys(),
        ]);

        if (settingsRes.ok) {
          const data: RepoSettingsData = await settingsRes.json();
          setAutoPayEnabled(data.repoSettings?.autoPayEnabled ?? false);
          setRequireOwnerApproval(data.repoSettings?.requireOwnerApproval ?? false);
          setContributorEligibility(data.repoSettings?.contributorEligibility ?? 'anyone');
          setShowAmountsPublicly(data.repoSettings?.showAmountsPublicly ?? true);
          setEmailOnSubmission(data.repoSettings?.emailOnSubmission ?? true);
          setEmailOnMerge(data.repoSettings?.emailOnMerge ?? true);
          setEmailOnPaymentFailure(data.repoSettings?.emailOnPaymentFailure ?? true);
        }

        if (accessKeysResult.data) {
          const activeKey = accessKeysResult.data.accessKeys?.find(
            (key) => key.status === 'active'
          );
          setHasAccessKey(!!activeKey);
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
        setError('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [githubRepoId]);

  const updateSetting = useCallback(
    async (updates: Record<string, unknown>) => {
      try {
        setIsUpdating(true);
        setError(null);

        const res = await fetch(`/api/repo-settings/${githubRepoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update settings');
        }
      } catch (err) {
        console.error('Failed to update setting:', err);
        setError(err instanceof Error ? err.message : 'Failed to update settings');
      } finally {
        setIsUpdating(false);
      }
    },
    [githubRepoId]
  );

  const handleAutoPayToggle = useCallback(
    async (checked: boolean) => {
      setAutoPayEnabled(checked);
      await updateSetting({ autoPayEnabled: checked });
    },
    [updateSetting]
  );

  const handleRequireOwnerApprovalToggle = useCallback(
    async (checked: boolean) => {
      setRequireOwnerApproval(checked);
      await updateSetting({ requireOwnerApproval: checked });
    },
    [updateSetting]
  );

  const handleContributorEligibilityChange = useCallback(
    async (value: ContributorEligibility) => {
      setContributorEligibility(value);
      await updateSetting({ contributorEligibility: value });
    },
    [updateSetting]
  );

  const handleShowAmountsToggle = useCallback(
    async (checked: boolean) => {
      setShowAmountsPublicly(checked);
      await updateSetting({ showAmountsPublicly: checked });
    },
    [updateSetting]
  );

  const handleEmailOnSubmissionToggle = useCallback(
    async (checked: boolean) => {
      setEmailOnSubmission(checked);
      await updateSetting({ emailOnSubmission: checked });
    },
    [updateSetting]
  );

  const handleEmailOnMergeToggle = useCallback(
    async (checked: boolean) => {
      setEmailOnMerge(checked);
      await updateSetting({ emailOnMerge: checked });
    },
    [updateSetting]
  );

  const handleEmailOnPaymentFailureToggle = useCallback(
    async (checked: boolean) => {
      setEmailOnPaymentFailure(checked);
      await updateSetting({ emailOnPaymentFailure: checked });
    },
    [updateSetting]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Configure bounty and notification settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Bounty Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Bounty Configuration</CardTitle>
          <CardDescription>Configure how bounties work for this repository</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field orientation="horizontal">
            <FieldLabel htmlFor="auto-pay">
              <FieldContent>
                <span className="font-medium">Auto-pay on PR merge</span>
                <FieldDescription>
                  Automatically pay contributors when their linked PR is merged.
                </FieldDescription>
              </FieldContent>
            </FieldLabel>
            <Switch
              id="auto-pay"
              checked={autoPayEnabled}
              onCheckedChange={handleAutoPayToggle}
              disabled={isUpdating}
            />
          </Field>

          {autoPayEnabled && !hasAccessKey && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Auto-pay is enabled but won&apos;t work until you create an Access Key in the
                Treasury tab. Access Keys allow secure automated signing without requiring biometric
                confirmation for each payout.
              </AlertDescription>
            </Alert>
          )}

          <Field orientation="horizontal">
            <FieldLabel htmlFor="require-owner-approval">
              <FieldContent>
                <span className="font-medium">Require owner approval</span>
                <FieldDescription>
                  When enabled, bounty payouts require your explicit approval before processing.
                </FieldDescription>
              </FieldContent>
            </FieldLabel>
            <Switch
              id="require-owner-approval"
              checked={requireOwnerApproval}
              onCheckedChange={handleRequireOwnerApprovalToggle}
              disabled={isUpdating}
            />
          </Field>

          <div className="border-t pt-6">
            <div className="space-y-3">
              <div>
                <span className="font-medium">Contributor Eligibility</span>
                <p className="text-sm text-muted-foreground">
                  Control who can submit work for bounties on this repository.
                </p>
              </div>
              <RadioGroup
                value={contributorEligibility}
                onValueChange={(value) =>
                  handleContributorEligibilityChange(value as ContributorEligibility)
                }
                disabled={isUpdating}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="anyone" id="eligibility-anyone" />
                  <Label htmlFor="eligibility-anyone" className="font-normal cursor-pointer">
                    Anyone can submit
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="collaborators" id="eligibility-collaborators" />
                  <Label htmlFor="eligibility-collaborators" className="font-normal cursor-pointer">
                    Repository collaborators only
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
          <CardDescription>Control what information is publicly visible</CardDescription>
        </CardHeader>
        <CardContent>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="show-amounts">
              <FieldContent>
                <span className="font-medium">Show bounty amounts publicly</span>
                <FieldDescription>
                  When enabled, bounty amounts are visible to all users. When disabled, amounts are
                  only visible to the repo owner and bounty funders.
                </FieldDescription>
              </FieldContent>
            </FieldLabel>
            <Switch
              id="show-amounts"
              checked={showAmountsPublicly}
              onCheckedChange={handleShowAmountsToggle}
              disabled={isUpdating}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Configure when you receive email notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field orientation="horizontal">
            <FieldLabel htmlFor="email-submission">
              <FieldContent>
                <span className="font-medium">Email on new submission</span>
                <FieldDescription>
                  Receive an email when someone submits work for a bounty.
                </FieldDescription>
              </FieldContent>
            </FieldLabel>
            <Switch
              id="email-submission"
              checked={emailOnSubmission}
              onCheckedChange={handleEmailOnSubmissionToggle}
              disabled={isUpdating}
            />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="email-merge">
              <FieldContent>
                <span className="font-medium">Email on PR merge</span>
                <FieldDescription>
                  Receive an email when a linked pull request is merged.
                </FieldDescription>
              </FieldContent>
            </FieldLabel>
            <Switch
              id="email-merge"
              checked={emailOnMerge}
              onCheckedChange={handleEmailOnMergeToggle}
              disabled={isUpdating}
            />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="email-payment-failure">
              <FieldContent>
                <span className="font-medium">Email on payment failure</span>
                <FieldDescription>
                  Receive an email if a bounty payment fails to process.
                </FieldDescription>
              </FieldContent>
            </FieldLabel>
            <Switch
              id="email-payment-failure"
              checked={emailOnPaymentFailure}
              onCheckedChange={handleEmailOnPaymentFailureToggle}
              disabled={isUpdating}
            />
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}
