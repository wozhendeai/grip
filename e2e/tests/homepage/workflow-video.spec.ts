import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Homepage Workflow Video Player E2E Tests
 *
 * These tests verify the video player synchronization behavior.
 * Several tests are designed to EXPOSE BUGS in the current implementation.
 */

const STEP_DURATIONS = {
  fund: 10000,
  settle: 12000,
  build: 12000,
};

const locators = (page: Page) => ({
  section: page.locator('[data-testid="unified-workflow"]'),
  // Steps (left column)
  fundStep: page.locator('[data-testid="workflow-step-fund"]'),
  settleStep: page.locator('[data-testid="workflow-step-settle"]'),
  buildStep: page.locator('[data-testid="workflow-step-build"]'),
  // Videos (right column)
  fundVideo: page.locator('[data-testid="workflow-video-fund"]'),
  settleVideo: page.locator('[data-testid="workflow-video-settle"]'),
  buildVideo: page.locator('[data-testid="workflow-video-build"]'),
  // Progress ring (on active step)
  progressRing: page.locator('[data-testid="progress-ring"]'),
  progressCircle: page.locator('[data-testid="progress-ring"] circle:nth-child(2)'),
});

test.describe('Workflow Video Player', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Scroll to workflow section (it's below the fold)
    const workflowSection = page.locator('[data-testid="unified-workflow"]');
    await workflowSection.scrollIntoViewIfNeeded();
    await workflowSection.waitFor({ state: 'visible' });
    // Wait for videos to load
    await page.waitForTimeout(500);
  });

  test.describe('Initial State', () => {
    test('first step is active on load', async ({ page }) => {
      const $ = locators(page);

      // Reset to first step to avoid race with auto-advance
      await $.fundStep.click();
      await page.waitForTimeout(100);

      await expect($.fundStep).toHaveAttribute('data-active', 'true');
      await expect($.settleStep).toHaveAttribute('data-active', 'false');
      await expect($.buildStep).toHaveAttribute('data-active', 'false');
    });

    test('first video is visible, others are hidden', async ({ page }) => {
      const $ = locators(page);

      // Reset to first step to avoid race with auto-advance
      await $.fundStep.click();

      // Wait for any initial transitions to complete (opacity transition is 500ms)
      await page.waitForTimeout(600);

      // Check opacity values - use evaluate for more reliable numeric comparison
      const fundOpacity = await $.fundVideo.evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).opacity)
      );
      const settleOpacity = await $.settleVideo.evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).opacity)
      );
      const buildOpacity = await $.buildVideo.evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).opacity)
      );

      expect(fundOpacity).toBeGreaterThan(0.9); // Should be visible (opacity ~1)
      expect(settleOpacity).toBeLessThan(0.1); // Should be hidden (opacity ~0)
      expect(buildOpacity).toBeLessThan(0.1); // Should be hidden (opacity ~0)
    });

    test('first video is playing', async ({ page }) => {
      const $ = locators(page);
      const isPlaying = await $.fundVideo.evaluate((v: HTMLVideoElement) => !v.paused);
      expect(isPlaying).toBe(true);
    });

    test('progress ring is visible on active step', async ({ page }) => {
      const $ = locators(page);
      await expect($.progressRing).toBeVisible();
    });
  });

  test.describe('Manual Step Selection', () => {
    test('clicking step changes active state', async ({ page }) => {
      const $ = locators(page);

      await $.settleStep.click();

      await expect($.fundStep).toHaveAttribute('data-active', 'false');
      await expect($.settleStep).toHaveAttribute('data-active', 'true');
    });

    test('clicking step shows corresponding video', async ({ page }) => {
      const $ = locators(page);

      await $.buildStep.click();

      await expect($.fundVideo).toHaveCSS('opacity', '0');
      await expect($.buildVideo).toHaveCSS('opacity', '1');
    });

    test('video restarts from beginning on step change', async ({ page }) => {
      const $ = locators(page);

      // Let first video play a bit
      await page.waitForTimeout(2000);

      // Switch to second step
      await $.settleStep.click();
      await page.waitForTimeout(100);

      const currentTime = await $.settleVideo.evaluate((v: HTMLVideoElement) => v.currentTime);
      // Video should be near the start (within 0.5s tolerance)
      expect(currentTime).toBeLessThan(0.5);
    });

    test('clicking same step does NOT restart video', async ({ page }) => {
      const $ = locators(page);

      // Let video play 2s
      await page.waitForTimeout(2000);

      const timeBefore = await $.fundVideo.evaluate((v: HTMLVideoElement) => v.currentTime);

      // Click same step
      await $.fundStep.click();
      await page.waitForTimeout(100);

      const timeAfter = await $.fundVideo.evaluate((v: HTMLVideoElement) => v.currentTime);

      // Video should NOT have restarted - time should be similar or advanced (not reset to 0)
      // Allow small tolerance since video keeps playing
      // If video restarted, timeAfter would be near 0 while timeBefore was ~2s
      expect(timeAfter).toBeGreaterThan(1.5); // Should not have reset to beginning
    });

    test('rapid clicking does not break state', async ({ page }) => {
      const $ = locators(page);

      // Rapid clicks
      await $.settleStep.click();
      await $.buildStep.click();
      await $.fundStep.click();
      await $.settleStep.click();

      // Should end on settle
      await expect($.settleStep).toHaveAttribute('data-active', 'true');
      await expect($.settleVideo).toHaveCSS('opacity', '1');

      // Video should be playing
      const isPlaying = await $.settleVideo.evaluate((v: HTMLVideoElement) => !v.paused);
      expect(isPlaying).toBe(true);
    });
  });

  test.describe('Auto-Advance', () => {
    test('advances to next step after duration', async ({ page }) => {
      const $ = locators(page);

      // First step duration is 10s
      await expect($.fundStep).toHaveAttribute('data-active', 'true');

      // Wait for auto-advance (10s + buffer)
      await page.waitForTimeout(STEP_DURATIONS.fund + 500);

      // Second step should now be active
      await expect($.settleStep).toHaveAttribute('data-active', 'true');
    });

    test('loops back to first step after last', async ({ page }) => {
      const $ = locators(page);

      // Jump to last step
      await $.buildStep.click();
      await expect($.buildStep).toHaveAttribute('data-active', 'true');

      // Move mouse far away from the workflow section to ensure no hover pause
      // The workflow section is scrolled into view, so move to top-right corner
      const viewport = page.viewportSize();
      await page.mouse.move(viewport?.width ?? 1200, 0);

      // Wait for auto-advance (12s + generous buffer for CI)
      await page.waitForTimeout(STEP_DURATIONS.build + 2000);

      // Should loop back to first
      await expect($.fundStep).toHaveAttribute('data-active', 'true');
    });
  });

  test.describe('Pause on Hover', () => {
    test('hovering pauses auto-advance timer', async ({ page }) => {
      const $ = locators(page);

      // Click to reset timer and ensure we're on step 1
      await $.fundStep.click();

      // Get bounding box and hover in center of element
      const box = await $.fundStep.boundingBox();
      if (!box) throw new Error('Could not get bounding box');

      // Move mouse to center of step 1 and keep it there
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      // Wait longer than step duration (timer should be paused)
      await page.waitForTimeout(STEP_DURATIONS.fund + 2000);

      // Should still be on first step (auto-advance paused)
      await expect($.fundStep).toHaveAttribute('data-active', 'true');
    });

    test('mouse leave resumes auto-advance', async ({ page }) => {
      const $ = locators(page);

      // Hover for 5s
      await $.fundStep.hover();
      await page.waitForTimeout(5000);

      // Move away to resume
      await page.mouse.move(0, 0);

      // Wait for remaining duration + buffer (full 10s since timer resets)
      await page.waitForTimeout(STEP_DURATIONS.fund + 500);

      // Should have advanced
      await expect($.settleStep).toHaveAttribute('data-active', 'true');
    });

    test('progress ring animation pauses on hover', async ({ page }) => {
      const $ = locators(page);

      await $.fundStep.hover();
      await page.waitForTimeout(100);

      // Progress ring should NOT have animation class when paused
      await expect($.progressCircle).not.toHaveClass(/animate-progress-ring/);
    });

    test('progress ring animation resumes after hover', async ({ page }) => {
      const $ = locators(page);

      // Hover then leave
      await $.fundStep.hover();
      await page.waitForTimeout(100);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(100);

      // Progress ring should have animation class again
      await expect($.progressCircle).toHaveClass(/animate-progress-ring/);
    });
  });

  /**
   * BUG EXPOSURE TESTS
   *
   * The following tests expose bugs in the current implementation.
   * They document the EXPECTED behavior that is currently broken.
   */

  test.describe('BUG: Video looping is not synced with step advance', () => {
    /**
     * EXPECTED: Step should advance exactly when video ends (not before, not after)
     * ACTUAL: Video has loop=true and plays independently of the setTimeout timer
     *
     * Root cause: Three independent timing mechanisms:
     * 1. Video playback (loops continuously via loop attribute)
     * 2. setTimeout (advances step after hardcoded duration)
     * 3. CSS animation (fills progress ring over hardcoded duration)
     *
     * These can all drift from each other.
     */
    test('step should advance when video ends, not on arbitrary timer', async ({ page }) => {
      const $ = locators(page);

      // Get actual video duration
      const videoDuration = await $.fundVideo.evaluate((v: HTMLVideoElement) => {
        return new Promise<number>((resolve) => {
          if (v.duration && !Number.isNaN(v.duration)) {
            resolve(v.duration);
          } else {
            v.addEventListener('loadedmetadata', () => resolve(v.duration), { once: true });
          }
        });
      });

      // Record when video actually ends
      const videoEndedPromise = $.fundVideo.evaluate((v: HTMLVideoElement) => {
        return new Promise<number>((resolve) => {
          const start = Date.now();
          // Listen for when video reaches near end (within 100ms of duration)
          const checkEnd = () => {
            if (v.currentTime >= v.duration - 0.1) {
              resolve(Date.now() - start);
            } else {
              requestAnimationFrame(checkEnd);
            }
          };
          checkEnd();
        });
      });

      // Wait for step to change
      const stepChangePromise = page
        .waitForFunction(() => {
          const settleStep = document.querySelector('[data-testid="workflow-step-settle"]');
          return settleStep?.getAttribute('data-active') === 'true';
        })
        .then(() => Date.now());

      const startTime = Date.now();
      const [videoEndTime, stepChangeTime] = await Promise.all([
        videoEndedPromise,
        stepChangePromise,
      ]);

      const videoEndedAt = videoEndTime;
      const stepChangedAt = stepChangeTime - startTime;

      // BUG: Step change timing is based on hardcoded duration, not video end
      // The difference between video end and step change should be < 500ms
      const drift = Math.abs(stepChangedAt - videoEndedAt);

      console.log(`Video duration: ${videoDuration}s`);
      console.log(`Video ended at: ${videoEndedAt}ms`);
      console.log(`Step changed at: ${stepChangedAt}ms`);
      console.log(`Drift: ${drift}ms`);

      // This will likely fail because the timer uses hardcoded 10000ms
      // while video might be slightly different length
      expect(drift).toBeLessThan(500);
    });

    test('video should not loop while step is still active', async ({ page }) => {
      const $ = locators(page);

      // Track if video loops (currentTime resets to 0)
      let loopCount = 0;
      const lastTime = 0;

      await $.fundVideo.evaluate((v: HTMLVideoElement) => {
        (window as unknown as { loopCount: number }).loopCount = 0;
        let lastTime = 0;
        v.addEventListener('timeupdate', () => {
          if (v.currentTime < lastTime - 1) {
            // Video looped (time jumped backwards)
            (window as unknown as { loopCount: number }).loopCount++;
          }
          lastTime = v.currentTime;
        });
      });

      // Wait for the full step duration
      await page.waitForTimeout(STEP_DURATIONS.fund + 500);

      loopCount = await page.evaluate(() => (window as unknown as { loopCount: number }).loopCount);

      // BUG: Video loops because it has loop=true attribute
      // EXPECTED: Video should play exactly once per step, then step advances
      // If video loops, it means video finished before step advanced
      expect(loopCount).toBe(0);
    });

    test('video duration should match step duration', async ({ page }) => {
      const $ = locators(page);

      // Get actual video durations
      const fundDuration = await $.fundVideo.evaluate((v: HTMLVideoElement) => {
        return new Promise<number>((resolve) => {
          if (v.duration && !Number.isNaN(v.duration)) {
            resolve(v.duration * 1000); // Convert to ms
          } else {
            v.addEventListener('loadedmetadata', () => resolve(v.duration * 1000), { once: true });
          }
        });
      });

      // Compare to hardcoded step duration
      const stepDuration = STEP_DURATIONS.fund; // 10000ms

      const difference = Math.abs(fundDuration - stepDuration);

      console.log(`Video duration: ${fundDuration}ms`);
      console.log(`Step duration: ${stepDuration}ms`);
      console.log(`Difference: ${difference}ms`);

      // BUG: If these don't match exactly, video will loop or be cut off
      // Allow 100ms tolerance for encoding variance
      expect(difference).toBeLessThan(100);
    });
  });

  test.describe('BUG: Video does not pause when hovering', () => {
    /**
     * EXPECTED: When user hovers over a step, the video should pause
     * ACTUAL: Video continues playing even when isPaused is true
     *
     * Root cause: The isPaused state only controls:
     * - setTimeout for auto-advance (line 46-52)
     * - CSS animation class (line 134)
     *
     * But it does NOT call video.pause() - see lines 59-66
     */
    test('video should pause when hovering over step', async ({ page }) => {
      const $ = locators(page);

      // Let video play a bit first
      await page.waitForTimeout(1000);

      // Hover to pause
      await $.fundStep.hover();
      await page.waitForTimeout(500);

      // BUG: Video continues playing
      const isPaused = await $.fundVideo.evaluate((v: HTMLVideoElement) => v.paused);

      // This SHOULD be true, but will fail because video.pause() is never called
      expect(isPaused).toBe(true);
    });

    test('video time should not advance while hovering', async ({ page }) => {
      const $ = locators(page);

      // Hover to pause
      await $.fundStep.hover();

      const timeBefore = await $.fundVideo.evaluate((v: HTMLVideoElement) => v.currentTime);
      await page.waitForTimeout(1000);
      const timeAfter = await $.fundVideo.evaluate((v: HTMLVideoElement) => v.currentTime);

      // BUG: Time continues advancing because video keeps playing
      // This SHOULD pass (times should be equal), but will fail
      expect(timeAfter - timeBefore).toBeLessThan(0.1);
    });
  });

  test.describe('BUG: Progress ring does not sync with video', () => {
    /**
     * EXPECTED: Progress ring should reflect actual video playback position
     * ACTUAL: Progress ring uses independent CSS animation that can drift
     *
     * Root cause: The progress ring uses CSS animation with a fixed duration
     * that runs independently of video.currentTime (lines 114-141)
     */
    test('progress ring should match video progress at 50%', async ({ page }) => {
      const $ = locators(page);

      // Wait for ~50% of the first video (5s of 10s)
      await page.waitForTimeout(5000);

      // Get video progress
      const videoProgress = await $.fundVideo.evaluate((v: HTMLVideoElement) => {
        return (v.currentTime / v.duration) * 100;
      });

      // Get ring progress from stroke-dashoffset
      // Full circle = 113.1, empty = 113.1, full = 0
      const dashOffset = await $.progressCircle.evaluate((el) => {
        const computed = getComputedStyle(el);
        return Number.parseFloat(computed.strokeDashoffset);
      });
      const ringProgress = ((113.1 - dashOffset) / 113.1) * 100;

      // BUG: These values can drift significantly
      // Allow 10% tolerance - this is still likely to fail due to desync
      expect(Math.abs(videoProgress - ringProgress)).toBeLessThan(10);
    });

    test('progress ring should pause at current position when video buffers', async ({ page }) => {
      const $ = locators(page);

      // Simulate network slowdown by throttling
      const client = await page.context().newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 1000, // Very slow
        uploadThroughput: 1000,
        latency: 2000,
      });

      // Force video to buffer by seeking
      await $.fundVideo.evaluate((v: HTMLVideoElement) => {
        v.currentTime = 5; // Jump to middle
      });

      await page.waitForTimeout(500);

      // Check if video is actually buffering
      const isBuffering = await $.fundVideo.evaluate((v: HTMLVideoElement) => {
        return v.readyState < 3; // HAVE_FUTURE_DATA
      });

      if (isBuffering) {
        // BUG: Progress ring continues animating even when video buffers
        // The CSS animation doesn't know about video state
        const hasAnimation = await $.progressCircle.evaluate((el) => {
          return el.classList.contains('animate-progress-ring');
        });

        // This SHOULD be false when buffering, but will likely be true
        expect(hasAnimation).toBe(false);
      }
    });
  });

  test.describe('BUG: Timer and animation can drift', () => {
    /**
     * EXPECTED: Auto-advance should happen exactly when progress ring completes
     * ACTUAL: CSS animation and setTimeout run independently and can desync
     *
     * This is especially noticeable:
     * - When browser tab is backgrounded (timers throttled differently than CSS)
     * - Under CPU load
     * - After pause/resume cycles
     */
    test('auto-advance should happen exactly when ring completes', async ({ page }) => {
      const $ = locators(page);

      // Wait for near the end of the animation
      await page.waitForTimeout(STEP_DURATIONS.fund - 200);

      // Check ring is nearly complete
      const dashOffsetBefore = await $.progressCircle.evaluate((el) => {
        return Number.parseFloat(getComputedStyle(el).strokeDashoffset);
      });

      // Ring should be nearly full (offset near 0)
      expect(dashOffsetBefore).toBeLessThan(20);

      // Wait for transition
      await page.waitForTimeout(400);

      // Now step should have changed AND ring should have reset
      await expect($.settleStep).toHaveAttribute('data-active', 'true');

      // New ring should be at start (offset near 113.1)
      const dashOffsetAfter = await $.progressCircle.evaluate((el) => {
        return Number.parseFloat(getComputedStyle(el).strokeDashoffset);
      });

      // BUG: Due to timing differences, the ring offset may not match expected state
      // The CSS animation continues independently of the JS timer
      expect(dashOffsetAfter).toBeGreaterThan(100);
    });

    test('pause/resume should not cause cumulative drift', async ({ page }) => {
      const $ = locators(page);

      const startTime = Date.now();

      // Multiple pause/resume cycles
      for (let i = 0; i < 3; i++) {
        await $.fundStep.hover();
        await page.waitForTimeout(500);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(500);
      }

      // Wait for auto-advance
      // Each cycle is 1s, so we've been running ~3s
      // Need to wait remaining ~7s + buffer
      await page.waitForTimeout(8000);

      const elapsed = Date.now() - startTime;

      // Should have advanced to step 2
      await expect($.settleStep).toHaveAttribute('data-active', 'true');

      // BUG: The actual time may not match expected due to timer resets
      // Timer restarts fresh after each pause/resume, so total time should be ~10s + 3s pause = ~13s
      // But CSS animation doesn't restart, only the timer does
      // This inconsistency is the bug
      expect(elapsed).toBeLessThan(15000);
    });
  });

  test.describe('Edge Cases', () => {
    test('handles video load failure gracefully - navigation still works', async ({ page }) => {
      // Block video requests
      await page.route('**/*.mp4', (route) => route.abort());

      await page.goto('/');
      await page.locator('[data-testid="unified-workflow"]').waitFor({ state: 'visible' });

      const $ = locators(page);

      // Navigation should still work even when videos fail to load
      await $.settleStep.click();
      await expect($.settleStep).toHaveAttribute('data-active', 'true');

      await $.buildStep.click();
      await expect($.buildStep).toHaveAttribute('data-active', 'true');

      await $.fundStep.click();
      await expect($.fundStep).toHaveAttribute('data-active', 'true');
    });

    test('auto-advance continues even when videos fail to load', async ({ page }) => {
      // Block video requests
      await page.route('**/*.mp4', (route) => route.abort());

      await page.goto('/');
      await page.locator('[data-testid="unified-workflow"]').waitFor({ state: 'visible' });

      const $ = locators(page);

      // Move mouse away to ensure auto-advance isn't paused
      await page.mouse.move(0, 0);

      // Auto-advance should still work (setTimeout not dependent on video)
      await page.waitForTimeout(STEP_DURATIONS.fund + 1000);
      await expect($.settleStep).toHaveAttribute('data-active', 'true');
    });
  });
});
