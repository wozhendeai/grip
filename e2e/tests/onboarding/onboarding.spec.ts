import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';

// Use GitHub's official demo repo - guaranteed to exist and won't conflict with real users
const TEST_REPO = { owner: 'octocat', repo: 'Hello-World' };

const locators = (page: Page) => {
  const modal = page.locator('[data-slot="dialog-content"]');
  return {
    modal,
    closeButton: modal.locator('[data-slot="dialog-close"]'),
    // Step 1: Welcome
    welcomeTitle: modal.getByText(/You've claimed/),
    welcomeNextButton: modal.getByRole('button', { name: /Next: Set Up Wallet/ }),
    // Step 2: Wallet
    walletTitle: modal.getByText('Your Bounty Wallet'),
    createWalletButton: modal.getByRole('button', { name: 'Create Wallet' }),
    walletSkipButton: modal.getByRole('button', { name: /Skip for now/ }),
    walletNextButton: modal.getByRole('button', { name: /Next: Auto-Pay/ }),
    walletCreatedTitle: modal.getByText('Wallet Created!'),
    // Step 3: Auto-pay
    autopayTitle: modal.getByText('Automatic Payments'),
    autopayAutoOption: modal.getByText('Pay automatically'),
    autopayManualOption: modal.getByText('Require my approval'),
    autopaySpendingLimitInput: modal.getByLabel(/Spending limit/),
    autopayEnableButton: modal.getByRole('button', { name: /Sign & Enable Auto-Pay/ }),
    autopayNextButton: modal.getByRole('button', { name: /Next: You're Ready/ }),
    autopaySuccessTitle: modal.getByText('Auto-Pay Enabled!'),
    // Step 4: Complete
    completeTitle: modal.getByText("You're all set!"),
    completeSummary: modal.locator('.bg-muted\\/50.rounded-lg'),
    createBountyLink: modal.getByRole('link', { name: /Create Bounty/ }),
    skipForNowButton: modal.getByRole('button', { name: /Skip for now/ }),
  };
};

async function waitForModal(page: Page) {
  await page.waitForSelector('h2:has-text("Recent Bounties")', { timeout: 15000 });
  await expect(page.locator('[data-slot="dialog-content"]')).toBeVisible({ timeout: 10000 });
}

test.describe
  .serial('Onboarding Flow', () => {
    test.describe('Happy Path', () => {
      test('completes all 4 steps with wallet creation and auto-pay', async ({
        authenticatedPage,
        testUser,
        seedClaimedRepo,
        virtualAuthenticator,
        cleanUserWallet,
      }) => {
        test.skip(!virtualAuthenticator, 'WebAuthn requires Chromium');

        // Clean up any wallet from previous tests
        await cleanUserWallet();

        const repo = await seedClaimedRepo({
          ...TEST_REPO,
          userId: testUser.id,
          onboardingCompleted: false,
        });

        const page = authenticatedPage;
        const $ = locators(page);

        await page.goto(`/${repo.owner}/${repo.repo}`);
        await waitForModal(page);

        // Step 1: Welcome
        await expect($.welcomeTitle).toContainText(repo.repo);
        await $.welcomeNextButton.click();

        // Step 2: Wallet
        await expect($.walletTitle).toBeVisible();
        await $.createWalletButton.click();
        await expect($.walletCreatedTitle).toBeVisible({ timeout: 15000 });
        await $.walletNextButton.click();

        // Step 3: Auto-pay
        await expect($.autopayTitle).toBeVisible();
        await $.autopayAutoOption.click();
        await $.autopaySpendingLimitInput.clear();
        await $.autopaySpendingLimitInput.fill('500');
        await $.autopayEnableButton.click();
        await expect($.autopaySuccessTitle).toBeVisible({ timeout: 15000 });
        await $.autopayNextButton.click();

        // Step 4: Complete
        await expect($.completeTitle).toBeVisible();
        await expect($.completeSummary).not.toContainText('Not configured');
        await expect($.completeSummary).toContainText('Automatic');
        await $.skipForNowButton.click();

        await expect($.modal).toBeHidden({ timeout: 10000 });
        expect(page.url()).not.toContain('onboarding');
      });

      test('shows onboarding on direct navigation with ?onboarding=true', async ({
        authenticatedPage,
        testUser,
        seedClaimedRepo,
      }) => {
        const repo = await seedClaimedRepo({
          ...TEST_REPO,
          userId: testUser.id,
          onboardingCompleted: true,
        });

        const page = authenticatedPage;
        const $ = locators(page);

        await page.goto(`/${repo.owner}/${repo.repo}?onboarding=true`);
        await waitForModal(page);
        await expect($.welcomeTitle).toBeVisible();
      });
    });

    test.describe('Skip Wallet Path', () => {
      test('skips wallet creation and proceeds with manual payouts', async ({
        authenticatedPage,
        testUser,
        seedClaimedRepo,
        cleanUserWallet,
      }) => {
        // This test expects user to NOT have a wallet
        await cleanUserWallet();

        const repo = await seedClaimedRepo({
          ...TEST_REPO,
          userId: testUser.id,
          onboardingCompleted: false,
        });

        const page = authenticatedPage;
        const $ = locators(page);

        await page.goto(`/${repo.owner}/${repo.repo}`);
        await waitForModal(page);

        await $.welcomeNextButton.click();
        await $.walletSkipButton.click();

        await expect($.autopayTitle).toBeVisible();
        await $.autopayManualOption.click();
        await $.autopayNextButton.click();

        await expect($.completeTitle).toBeVisible();
        await expect($.completeSummary).toContainText('Not configured');
        await expect($.completeSummary).toContainText('Manual approval');
        await $.skipForNowButton.click();
      });
    });

    test.describe('Manual Payouts Path', () => {
      test('creates wallet but chooses manual approval mode', async ({
        authenticatedPage,
        testUser,
        seedClaimedRepo,
        virtualAuthenticator,
        cleanUserWallet,
      }) => {
        test.skip(!virtualAuthenticator, 'WebAuthn requires Chromium');

        // Clean up any wallet from previous tests
        await cleanUserWallet();

        const repo = await seedClaimedRepo({
          ...TEST_REPO,
          userId: testUser.id,
          onboardingCompleted: false,
        });

        const page = authenticatedPage;
        const $ = locators(page);

        await page.goto(`/${repo.owner}/${repo.repo}`);
        await waitForModal(page);

        await $.welcomeNextButton.click();
        await $.createWalletButton.click();
        await expect($.walletCreatedTitle).toBeVisible({ timeout: 15000 });
        await $.walletNextButton.click();

        await $.autopayManualOption.click();
        await $.autopayNextButton.click();

        await expect($.completeTitle).toBeVisible();
        await expect($.completeSummary).not.toContainText('Not configured');
        await expect($.completeSummary).toContainText('Manual approval');
        await $.skipForNowButton.click();
      });
    });

    test.describe('Modal Dismissal', () => {
      test('closing modal marks onboarding as complete', async ({
        authenticatedPage,
        testUser,
        seedClaimedRepo,
        cleanUserWallet,
      }) => {
        // Clean wallet state for consistent UI
        await cleanUserWallet();

        const repo = await seedClaimedRepo({
          ...TEST_REPO,
          userId: testUser.id,
          onboardingCompleted: false,
        });

        const page = authenticatedPage;
        const $ = locators(page);

        await page.goto(`/${repo.owner}/${repo.repo}`);
        await waitForModal(page);

        await $.welcomeNextButton.click();
        await $.closeButton.click();
        await expect($.modal).toBeHidden({ timeout: 10000 });

        await page.reload();
        await page.waitForSelector('h2:has-text("Recent Bounties")');
        await expect($.modal).toBeHidden();
      });

      test('escape key closes modal after step 1', async ({
        authenticatedPage,
        testUser,
        seedClaimedRepo,
        cleanUserWallet,
      }) => {
        // Clean wallet state for consistent UI
        await cleanUserWallet();

        const repo = await seedClaimedRepo({
          ...TEST_REPO,
          userId: testUser.id,
          onboardingCompleted: false,
        });

        const page = authenticatedPage;
        const $ = locators(page);

        await page.goto(`/${repo.owner}/${repo.repo}`);
        await waitForModal(page);

        await $.welcomeNextButton.click();
        await page.keyboard.press('Escape');
        await expect($.modal).toBeHidden({ timeout: 10000 });
      });
    });

    test.describe('Complete Step Navigation', () => {
      test('Create Bounty button navigates correctly', async ({
        authenticatedPage,
        testUser,
        seedClaimedRepo,
        cleanUserWallet,
      }) => {
        // This test uses skip wallet flow, needs no wallet
        await cleanUserWallet();

        const repo = await seedClaimedRepo({
          ...TEST_REPO,
          userId: testUser.id,
          onboardingCompleted: false,
        });

        const page = authenticatedPage;
        const $ = locators(page);

        await page.goto(`/${repo.owner}/${repo.repo}`);
        await waitForModal(page);

        await $.welcomeNextButton.click();
        await $.walletSkipButton.click();
        await $.autopayManualOption.click();
        await $.autopayNextButton.click();

        await $.createBountyLink.click();
        await page.waitForURL(`**/${repo.owner}/${repo.repo}/bounties/new`);
        expect(page.url()).toContain('/bounties/new');
      });
    });
  });
