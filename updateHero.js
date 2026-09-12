const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');
const heroText = fs.readFileSync('hero.txt', 'utf8');

const homeStart = content.indexOf('<section id="home"');
const catalogStart = content.indexOf('<section id="catalog"');

if (homeStart !== -1 && catalogStart !== -1) {
    content = content.substring(0, homeStart) + heroText + "\n" + content.substring(catalogStart);
    fs.writeFileSync('index.html', content);
    console.log('Hero and categories updated successfully!');
} else {
    console.error('Could not find start or end tags.');
}
