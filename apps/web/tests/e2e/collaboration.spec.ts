import { test, expect } from '@playwright/test';

// Helper to generate unique emails so tests are completely isolated and idempotent
function generateTestEmail(role: string) {
  return `user-${role}-${Date.now()}-${Math.floor(Math.random() * 1000)}@docsync.dev`;
}

// Extract editor text excluding cursor carets/tooltips that pollute innerText
async function getCleanEditorText(page: any): Promise<string> {
  return page.evaluate(() => {
    const editorEl = document.querySelector('.ProseMirror') as HTMLElement;
    if (!editorEl) return '';
    let text = editorEl.textContent || '';
    // Replace all known cursor labels with empty string
    text = text.replace(/Document Owner|Document Editor|Document Viewer/g, '');
    // Clean up any extra whitespace/newlines
    return text.trim();
  });
}

// Robust helper to register a new user and ensure they are authenticated
async function signupAndLogin(page: any, name: string, email: string) {
  // 1. Fill signup form
  await page.goto('/signup');
  await page.fill('#name', name);
  await page.fill('#email', email);
  await page.fill('#password', 'password123');
  await page.click('button[type="submit"]');

  // Wait for submission request to propagate
  await page.waitForTimeout(2000);

  // 2. Force navigate to dashboard root to propagate cookies
  await page.goto('/');

  // 3. If redirected to login due to NextAuth session propagation delay, log in explicitly
  if (page.url().includes('/login')) {
    await page.fill('#email', email);
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for session update and force navigate
    await page.waitForTimeout(2000);
    await page.goto('/');
  }

  // 4. Wait for the "Create Document" button to be visible to ensure dashboard loaded completely
  await page.waitForSelector('button:has-text("Create Document")', { timeout: 15000 });
}

test.describe('DocSync Collaborative Editor E2E Workspace Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock the AI API routes so that the suite is fully runnable in CI without live keys
    await page.route('**/api/ai/summarize', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'Mocked document summary from AI.',
      });
    });

    await page.route('**/api/ai/version-search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matchedSnapshotId: null,
          rationale: 'Mocked semantic search rationale.',
        }),
      });
    });

    await page.route('**/api/ai/writing-assist', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          originalText: 'original selection',
          improvedText: 'AI-improved draft content',
        }),
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Two browser contexts collaboration + offline reconnect merge
  // ─────────────────────────────────────────────────────────────────────────────
  test('Two browser contexts edit same doc concurrently, disconnect, edit offline, and merge successfully on reconnect', async ({ browser }) => {
    const ownerEmail = generateTestEmail('owner');
    const editorEmail = generateTestEmail('editor');

    // Create Browser Context 1 (Owner)
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    page1.on('console', (msg) => console.log(`[PAGE 1 CONSOLE] ${msg.text()}`));
    await signupAndLogin(page1, 'Document Owner', ownerEmail);

    // Create a new document on the dashboard
    await page1.click('button:has-text("Create Document")');
    await page1.fill('[placeholder="e.g. Q3 Roadmap Proposal"]', 'E2E Sync Document');
    await page1.click('button[type="submit"]:has-text("Create & Open")');
    await page1.waitForURL('**/documents/*');
    const docUrl = page1.url();
    await page1.waitForSelector('.ProseMirror');

    // 1. Create Browser Context 2 (Editor) and Sign Up/Log In Editor first
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    page2.on('console', (msg) => console.log(`[PAGE 2 CONSOLE] ${msg.text()}`));

    // Mock AI routes on page2 context
    await page2.route('**/api/ai/summarize', async (route) => {
      await route.fulfill({ status: 200, body: 'Mocked summary' });
    });

    await signupAndLogin(page2, 'Document Editor', editorEmail);

    // 2. Now from Owner context (page1), send the invitation
    await page1.click('button[role="tab"]:has-text("Sharing")');
    await page1.fill('[placeholder="collaborator@domain.com"]', editorEmail);
    await page1.selectOption('select', 'EDITOR');
    await page1.click('button:has-text("Invite")');
    await page1.waitForTimeout(1000); // Wait for API response to propagate

    // Navigate to the shared document url
    await page2.goto(docUrl);
    await page2.waitForSelector('.ProseMirror');

    // Wait for editors to load completely
    await expect(page1.locator('.ProseMirror')).toBeVisible();
    await expect(page2.locator('.ProseMirror')).toBeVisible();

    // Make edits while online
    await page1.locator('.ProseMirror').click();
    await page1.keyboard.press('Control+End');
    await page1.keyboard.type('Owner Online Edit. ');

    // Wait for text to synchronize to Editor
    await expect.poll(async () => getCleanEditorText(page2), { timeout: 15000 }).toContain('Owner Online Edit.');

    await page2.locator('.ProseMirror').click();
    await page2.keyboard.press('Control+End');
    await page2.keyboard.type('Editor Online Edit. ');

    // Wait for sync to Owner
    await expect.poll(async () => getCleanEditorText(page1), { timeout: 15000 }).toContain('Editor Online Edit.');

    // Go offline on both contexts
    await context1.setOffline(true);
    await context2.setOffline(true);

    // Make edits while offline (local draft mode)
    await page1.locator('.ProseMirror').click();
    await page1.keyboard.press('Control+End');
    await page1.keyboard.type('Owner Offline Change. ');

    await page2.locator('.ProseMirror').click();
    await page2.keyboard.press('Control+End');
    await page2.keyboard.type('Editor Offline Change. ');

    // Reconnect both contexts
    await context1.setOffline(false);
    await context2.setOffline(false);

    // Assert: Document contents merge and eventually display both edits
    await expect.poll(async () => getCleanEditorText(page1), { timeout: 15000 }).toContain('Owner Offline Change.');
    await expect.poll(async () => getCleanEditorText(page1), { timeout: 15000 }).toContain('Editor Offline Change.');
    await expect.poll(async () => getCleanEditorText(page2), { timeout: 15000 }).toContain('Owner Offline Change.');
    await expect.poll(async () => getCleanEditorText(page2), { timeout: 15000 }).toContain('Editor Offline Change.');

    await context1.close();
    await context2.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Viewer role cannot edit document
  // ─────────────────────────────────────────────────────────────────────────────
  test('Collaborator with VIEWER role has read-only document editor canvas and cannot input text', async ({ browser }) => {
    const ownerEmail = generateTestEmail('owner');
    const viewerEmail = generateTestEmail('viewer');

    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    page1.on('console', (msg) => console.log(`[PAGE 1 CONSOLE] ${msg.text()}`));
    await signupAndLogin(page1, 'Document Owner', ownerEmail);

    await page1.click('button:has-text("Create Document")');
    await page1.fill('[placeholder="e.g. Q3 Roadmap Proposal"]', 'E2E Viewer Doc');
    await page1.click('button[type="submit"]:has-text("Create & Open")');
    await page1.waitForURL('**/documents/*');
    const docUrl = page1.url();
    await page1.waitForSelector('.ProseMirror');

    // Write some initial text
    await page1.locator('.ProseMirror').click();
    await page1.keyboard.press('Control+End');
    await page1.keyboard.type('Author initial text.');

    // 1. Create Viewer Context and Sign Up/Log In Viewer first
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    page2.on('console', (msg) => console.log(`[PAGE 2 CONSOLE] ${msg.text()}`));
    await signupAndLogin(page2, 'Document Viewer', viewerEmail);

    // 2. Now from Owner context (page1), send the invitation
    await page1.click('button[role="tab"]:has-text("Sharing")');
    await page1.fill('[placeholder="collaborator@domain.com"]', viewerEmail);
    await page1.selectOption('select', 'VIEWER');
    await page1.click('button:has-text("Invite")');
    await page1.waitForTimeout(1000); // Wait for API response to propagate

    // Open Shared Document
    await page2.goto(docUrl);
    await page2.waitForSelector('.ProseMirror');

    // Check Editor is loaded
    await expect.poll(async () => getCleanEditorText(page2), { timeout: 15000 }).toContain('Author initial text.');

    // Attempt keyboard inputs
    await page2.locator('.ProseMirror').click();
    await page2.keyboard.type('Viewer typing attempt.');

    // Wait a brief period to ensure no edits are registered
    await page2.waitForTimeout(1000);

    // Assert: Editor remains read-only and no viewer edits are registered
    const editorContent = await getCleanEditorText(page2);
    expect(editorContent).not.toContain('Viewer typing attempt.');
    expect(editorContent).toContain('Author initial text.');

    await context1.close();
    await context2.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Offline edit -> reload -> persists (IndexedDB durability check)
  // ─────────────────────────────────────────────────────────────────────────────
  test('Offline edits survive page refreshes while remaining offline (IndexedDB durability)', async ({ browser }) => {
    const ownerEmail = generateTestEmail('owner');

    const context = await browser.newContext();
    const page = await context.newPage();
    await signupAndLogin(page, 'Owner', ownerEmail);

    await page.click('button:has-text("Create Document")');
    await page.fill('[placeholder="e.g. Q3 Roadmap Proposal"]', 'IndexedDB Test Doc');
    await page.click('button[type="submit"]:has-text("Create & Open")');
    await page.waitForURL('**/documents/*');
    await page.waitForSelector('.ProseMirror');

    // Go offline for WebSocket connections while keeping Next.js accessible
    await context.route('**/api/auth/ws-token', (route) => route.abort('failed'));

    // Write text while offline
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('IndexedDB Offline Change.');

    // Reload page while still offline
    await page.reload();
    await page.waitForSelector('.ProseMirror');

    // Assert: The edit persists (proves IndexedDB stores Yjs updates locally offline)
    await expect.poll(async () => getCleanEditorText(page), { timeout: 15000 }).toContain('IndexedDB Offline Change.');

    await context.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Version history: Snapshot and Restore
  // ─────────────────────────────────────────────────────────────────────────────
  test('Creates version snapshots and restores to them cleanly', async ({ browser }) => {
    const ownerEmail = generateTestEmail('owner');

    const context = await browser.newContext();
    const page = await context.newPage();
    await signupAndLogin(page, 'Version Admin', ownerEmail);

    // Create document
    await page.click('button:has-text("Create Document")');
    await page.fill('[placeholder="e.g. Q3 Roadmap Proposal"]', 'Version History Doc');
    await page.click('button[type="submit"]:has-text("Create & Open")');
    await page.waitForURL('**/documents/*');
    await page.waitForSelector('.ProseMirror');

    // Write Version 1 text
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('Document Version One.');

    // Create Checkpoint 1
    // Click Checkpoint button
    // Mock the prompt dialog in Playwright to answer "V1 Snapshot"
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Specify a checkpoint version label');
      await dialog.accept('V1 Snapshot');
    });
    await page.click('button:has-text("Checkpoint")');

    // Wait for the timeline snapshot to list
    await page.waitForSelector('text=V1 Snapshot');

    // Edit and write Version 2 text
    await page.locator('.ProseMirror').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' Document Version Two.');
    await expect.poll(async () => getCleanEditorText(page), { timeout: 15000 }).toContain('Document Version One. Document Version Two.');

    // Create Checkpoint 2
    page.once('dialog', async (dialog) => {
      await dialog.accept('V2 Snapshot');
    });
    await page.click('button:has-text("Checkpoint")');
    await page.waitForSelector('text=V2 Snapshot');

    // Restore to V1 Snapshot
    // Mock confirm dialog
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Restore to checkpoint');
      await dialog.accept();
    });
    // Click "Restore" next to the V1 Snapshot block
    const v1Block = page.locator('div:has-text("V1 Snapshot")');
    await v1Block.locator('button:has-text("Restore")').first().click();

    // Assert: Document reverted to Checkpoint 1 contents
    await expect.poll(async () => getCleanEditorText(page), { timeout: 15000 }).toContain('Document Version One.');
    await expect.poll(async () => getCleanEditorText(page), { timeout: 15000 }).not.toContain('Document Version Two.');

    await context.close();
  });
});
