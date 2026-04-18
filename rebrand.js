import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

const fileTypes = ['.tsx', '.ts', '.html'];
const exclusions = ['node_modules', 'dist', 'migrated_prompt_history'];

walk('./', (filePath) => {
    if (!fileTypes.some(ext => filePath.endsWith(ext))) return;
    if (exclusions.some(exc => filePath.includes(exc))) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace purple with emerald for styling
    content = content.replace(/purple/g, 'emerald');

    // Replace combinations
    content = content.replace(/Rave Radio/g, 'Goodwood FM');
    content = content.replace(/Rave Music/g, 'Goodwood FM Music');
    
    // Replace standalone "Rave" with "Goodwood FM"
    content = content.replace(/\bRave\b/g, 'Goodwood FM');
    content = content.replace(/\brave\b/g, 'goodwood'); // for generic lowercase

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
});

console.log("Rebranded files.");
