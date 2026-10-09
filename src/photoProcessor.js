const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class PhotoProcessor {
  constructor(settingsPath) {
    const settingsData = fs.readFileSync(settingsPath, 'utf-8');
    this.settings = JSON.parse(settingsData);
  }

  async processPhoto(inputPath, outputPath) {
    const limits = this.settings.limits;
    
    // Resize, compress, and strip EXIF (rotation is auto-fixed by default in sharp)
    await sharp(inputPath)
      .rotate()
      .resize({
        width: limits.imageWidth,
        height: limits.imageHeight,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
      
    // Check size limit
    const stats = fs.statSync(outputPath);
    if (stats.size > limits.maxImageSizeKB * 1024) {
      // Re-compress if still too large
      await sharp(outputPath)
        .jpeg({ quality: 60 })
        .toFile(outputPath + '.tmp');
      fs.renameSync(outputPath + '.tmp', outputPath);
    }
    
    return true;
  }
}

module.exports = PhotoProcessor;
