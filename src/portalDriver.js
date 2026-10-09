const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

class PortalDriver {
  constructor(settingsPath) {
    const settingsData = fs.readFileSync(settingsPath, 'utf-8');
    this.settings = JSON.parse(settingsData);
    this.context = null;
    this.page = null;
    this.userDataDir = path.join(__dirname, '../chrome-profile');
  }

  async init() {
    this.context = await chromium.launchPersistentContext(this.userDataDir, {
      headless: false,
      channel: 'chrome', // Use system chrome if available, or omit to use bundled chromium
    });
    this.page = await this.context.newPage();
  }

  async checkLoginStatus() {
    if (!this.page) return false;
    const url = this.page.url();
    if (url.includes(this.settings.urls.login)) {
      return false;
    }
    return true;
  }

  async scanJob() {
    if (!this.page) throw new Error("Driver not initialized");
    
    // In a real scenario, this reads from the page. We simulate based on mock-portal.
    const url = this.page.url();
    if (!url.includes(this.settings.urls.huidList)) {
      return { error: "No HUID List is open" };
    }

    const rows = [];
    const elements = await this.page.$$(this.settings.elements.huidTable + ' tr');
    
    // Skip header row
    for (let i = 1; i < elements.length; i++) {
      const tds = await elements[i].$$('td');
      if (tds.length >= 4) {
        const tag = await tds[0].innerText();
        const category = await tds[1].innerText();
        const purity = await tds[2].innerText();
        const huid = await tds[3].innerText();
        const actionLink = await tds[4].$('a');
        const uploadLink = actionLink ? await actionLink.getAttribute('href') : null;

        rows.push({
          tag: tag.trim(),
          category: category.trim(),
          purity: purity.trim(),
          huid: huid.trim(),
          uploadLink: uploadLink
        });
      }
    }
    
    return { tagCount: rows.length, rows };
  }

  async uploadImage(row, type, filePath) {
    if (!this.page) throw new Error("Driver not initialized");
    
    if (!row.uploadLink) {
      return { status: 'failed', reason: 'No upload link for this row' };
    }

    try {
      // Navigate to the upload link
      const fullLink = row.uploadLink.startsWith('http') ? row.uploadLink : (this.settings.urls.upload.split('/upload')[0] + row.uploadLink);
      await this.page.goto(fullLink);
      
      // Select the type
      await this.page.selectOption(this.settings.elements.uploadType, { label: type === 'article' ? 'Article' : 'HUID' });
      
      // Attach the file
      await this.page.setInputFiles(this.settings.elements.uploadFile, filePath);
      
      // Submit
      await this.page.click(this.settings.elements.uploadSubmit);
      
      // Accept popup (simulated via Playwright dialog handler)
      this.page.once('dialog', dialog => dialog.accept());
      
      // Wait for image page
      await this.page.waitForURL(/image/);
      
      const successText = await this.page.locator('#status').innerText();
      if (successText.includes("Upload Successful")) {
        return { status: 'uploaded' };
      }
      return { status: 'rejected', reason: 'Upload did not succeed on portal' };
      
    } catch (e) {
      return { status: 'uncertain', reason: e.message };
    }
  }

  async close() {
    if (this.context) {
      await this.context.close();
    }
  }
}

module.exports = PortalDriver;
