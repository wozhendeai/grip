import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';

const locators = (page: Page) => ({
  hero: page.getByRole('heading', { name: 'Wallet' }),
  createWalletCard: page.getByText('Create Your Wallet'),
  createButton: page.getByRole('button', { name: 'Create Wallet' }),

  // Wallet Active State
  balanceSection: page.locator('.text-3xl'),
  fundButton: page.getByRole('button', { name: 'Fund' }),
  withdrawButton: page.getByRole('button', { name: 'Withdraw' }),
  settingsButton: page.locator('button:has(.lucide-settings)'),

  // Modal/Inline Views - Back button has arrow prefix
  backButton: page.getByRole('button', { name: /Back/ }),
  // Fund content - look for instruction text (heading is sr-only)
  fundContent: page.getByText(/Send USDC to this address/),
  withdrawContent: page.getByText(/Withdraw funds/i),

  // Settings View
  passkeyManager: page.getByText('Address'),

  // Dialog elements - don't use name constraint as dialog title changes during operation
  createWalletDialogButton: page.getByRole('dialog').getByRole('button', { name: 'Create Wallet' }),
});

test.describe('Wallet Settings', () => {
  test.describe('No Wallet State', () => {
    test.beforeEach(async ({ authenticatedPage, cleanUserWallet }) => {
      await cleanUserWallet();
      await authenticatedPage.goto('/settings/wallet');
    });

    test('shows create wallet CTA', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      const $ = locators(page);
      await expect($.createWalletCard).toBeVisible();
      await expect($.createButton).toBeVisible();
    });

    test('creates wallet via WebAuthn', async ({ authenticatedPage, virtualAuthenticator }) => {
      test.skip(!virtualAuthenticator, 'WebAuthn requires Chromium');

      const page = authenticatedPage;
      const $ = locators(page);

      // Click first Create Wallet button to open dialog
      await $.createButton.click();

      // Wait for dialog - use generic dialog role without name constraint
      // since dialog title changes during operation
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      // Click Create Wallet button inside the dialog
      await $.createWalletDialogButton.click();

      // Virtual authenticator handles WebAuthn automatically
      // Wait for wallet creation to complete (Fund button appears when wallet exists)
      await expect($.fundButton).toBeVisible({ timeout: 20000 });
    });
  });

  // Run serially to avoid race conditions with shared test user database state
  test.describe
    .serial('Has Wallet State', () => {
      test.beforeEach(async ({ authenticatedPage, virtualAuthenticator, cleanUserWallet }) => {
        // Skip if no virtual authenticator (required for wallet creation)
        if (!virtualAuthenticator) {
          // Wallet creation requires WebAuthn, skip this suite in non-Chromium
          return;
        }

        // Clean up any existing wallet to ensure consistent state (like onboarding tests do)
        await cleanUserWallet();
        console.log('[wallet.spec.ts] Cleaned user wallet, navigating to /settings/wallet');

        // Navigate to wallet page - should show Create Wallet since we just cleaned
        await authenticatedPage.goto('/settings/wallet');

        const createBtn = authenticatedPage.getByRole('button', { name: 'Create Wallet' });
        const isBtnVisible = await createBtn.isVisible({ timeout: 5000 });
        console.log('[wallet.spec.ts] Create Wallet button visible:', isBtnVisible);

        if (!isBtnVisible) {
          throw new Error('Create Wallet button should be visible after cleanUserWallet()');
        }

        // Click to open dialog
        console.log('[wallet.spec.ts] Clicking Create Wallet button to open dialog');
        await createBtn.click();
        await expect(authenticatedPage.getByRole('dialog')).toBeVisible({ timeout: 5000 });
        console.log('[wallet.spec.ts] Dialog is visible');

        // Click button inside dialog to start WebAuthn
        const dialogBtn = authenticatedPage
          .getByRole('dialog')
          .getByRole('button', { name: 'Create Wallet' });
        console.log('[wallet.spec.ts] Clicking dialog Create Wallet button to start WebAuthn');
        await dialogBtn.click();

        // Wait for wallet creation to complete
        console.log('[wallet.spec.ts] Waiting for Fund button (wallet creation complete)');
        await expect(authenticatedPage.getByRole('button', { name: 'Fund' })).toBeVisible({
          timeout: 20000,
        });
        console.log('[wallet.spec.ts] Wallet created successfully');
      });

      test('displays balance and actions', async ({ authenticatedPage, virtualAuthenticator }) => {
        test.skip(!virtualAuthenticator, 'WebAuthn requires Chromium');

        const page = authenticatedPage;
        const $ = locators(page);

        // Balance is fetched client-side via SDK (RPC to Tempo network)
        // Just verify balance section renders with dollar format
        await expect($.balanceSection).toBeVisible();
        await expect($.balanceSection).toContainText('$');
        await expect($.fundButton).toBeVisible();
        await expect($.withdrawButton).toBeVisible();
      });

      test('Fund flow (modal context)', async ({ authenticatedPage, virtualAuthenticator }) => {
        test.skip(!virtualAuthenticator, 'WebAuthn requires Chromium');

        const page = authenticatedPage;
        const $ = locators(page);

        // Trigger modal context - use /explore which has navbar
        await page.goto('/explore');
        await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();

        // Open settings via user dropdown (use testid - button shows org name when org is active)
        await page.getByTestId('user-menu-trigger').click();
        await page.getByRole('menuitem', { name: 'Settings' }).click();
        await expect(page.locator('[data-slot="dialog-content"]')).toBeVisible();

        // Navigate to Wallet
        await page.getByRole('link', { name: 'Wallet' }).click();

        await $.fundButton.click();

        // Verify inline view (fund content visible)
        await expect($.fundContent).toBeVisible();
        await expect($.backButton).toBeVisible();

        // Verify Back navigation
        await $.backButton.click();
        await expect($.fundContent).toBeHidden();
        await expect($.fundButton).toBeVisible();
      });

      test('Fund flow (full page context)', async ({ authenticatedPage, virtualAuthenticator }) => {
        test.skip(!virtualAuthenticator, 'WebAuthn requires Chromium');

        const page = authenticatedPage;
        await page.goto('/settings/wallet');
        const $ = locators(page);

        await $.fundButton.click();

        // Verify Dialog (heading is sr-only, so check for dialog and content)
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect($.fundContent).toBeVisible();

        // Close dialog
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
      });
    });
});
