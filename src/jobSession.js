const fs = require('fs');
const path = require('path');

class JobSession {
  constructor(jobId, dataDir) {
    this.jobId = jobId;
    this.sessionFile = path.join(dataDir, \`\${jobId}.json\`);
    this.sessionFileTemp = path.join(dataDir, \`\${jobId}.tmp.json\`);
    this.state = {
      jobId,
      status: 'scanned', // scanned, phone link on, uploading, paused, finished
      rows: [] // Contains row objects with { tag, category, purity, huid, uploadLink, article: { status, photoPath }, huidPhoto: { status, photoPath } }
    };
  }

  load() {
    if (fs.existsSync(this.sessionFile)) {
      try {
        const data = fs.readFileSync(this.sessionFile, 'utf-8');
        this.state = JSON.parse(data);
      } catch (e) {
        console.error("Failed to load session:", e);
      }
    }
  }

  save() {
    try {
      // Safe write: write to temp, then rename
      fs.writeFileSync(this.sessionFileTemp, JSON.stringify(this.state, null, 2));
      fs.renameSync(this.sessionFileTemp, this.sessionFile);
    } catch (e) {
      console.error("Failed to save session:", e);
    }
  }

  updateRows(newRows) {
    // Keep existing rows and their upload states, add new ones
    for (const newRow of newRows) {
      const existing = this.state.rows.find(r => r.huid === newRow.huid);
      if (!existing) {
        this.state.rows.push({
          ...newRow,
          article: { status: 'empty', photoPath: null },
          huidPhoto: { status: 'empty', photoPath: null }
        });
      }
    }
    this.save();
  }

  updatePhotoStatus(huid, type, status, photoPath = null) {
    const row = this.state.rows.find(r => r.huid === huid);
    if (row) {
      if (type === 'article') {
        row.article.status = status;
        if (photoPath) row.article.photoPath = photoPath;
      } else {
        row.huidPhoto.status = status;
        if (photoPath) row.huidPhoto.photoPath = photoPath;
      }
      this.save();
    }
  }

  setStatus(status) {
    this.state.status = status;
    this.save();
  }
}

module.exports = JobSession;
