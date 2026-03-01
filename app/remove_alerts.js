const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/alert\([^)]*Success[^)]*\);?\s*/gi, '');
    content = content.replace(/alert\([^)]*tokenCopied[^)]*\);?\s*/g, '');
    content = content.replace(/alert\([^)]*Successfully[^)]*\);?\s*/gi, '');
    content = content.replace(/alert\([^)]*added to vocabulary[^)]*\);?\s*/g, '');
    content = content.replace(/alert\([^)]*defaultTemplateUpdatedAlert[^)]*\);?\s*/g, '');
    content = content.replace(/alert\(.Song shared to community successfully!.\);?\s*/g, '');
    content = content.replace(/alert\(.Deleted from community successfully..\);?\s*/g, '');
    content = content.replace(/alert\(.Import successful! The application will now reload..\);?\s*/g, '');
    content = content.replace(/alert\(.*successfully.*\);?\s*/gi, '');
    content = content.replace(/alert\(`"\$\{surface\}" added to vocabulary!`\);?\s*/g, '');
    
    // extra full Lyrics Editor specifically uses .then(() => alert(t('settings.tokenCopied')))
    content = content.replace(/\.then\(\(\) => alert\(t\('settings\.tokenCopied'\)\)\)/g, '');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
