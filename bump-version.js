#!/usr/bin/env node
/**
 * bump-version.js - يغيّر رقم النسخة في كل الأماكن بأمر واحد
 * ===========================================================
 * الاستخدام (من جوه مجلد الموقع، جنب index.html):
 *   node bump-version.js        → يزوّد الرقم 1 (17 → 18)
 *   node bump-version.js 25     → يحط رقم معيّن
 *
 * بيغيّر:
 *   - sw.js:        CACHE_NAME ('elforat-cache-vN') + كل ?v=N
 *   - index.html:   كل ?v=N
 *   - analysis.js:  كل ?v=N (ملفات الـ lazy: store-product / store-checkout / instapay ...)
 *
 * لو ضفتي ملف تاني فيه ?v= ضيفي اسمه في FILES تحت.
 */
const fs = require('fs');
const path = require('path');

const FILES = ['sw.js', 'index.html', 'analysis.js'];
const SW = 'sw.js';
const CACHE_RE = /(const\s+CACHE_NAME\s*=\s*'elforat-cache-v)(\d+)(')/;

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}
function write(file, content) {
  fs.writeFileSync(path.join(__dirname, file), content, 'utf8');
}

// الرقم الحالي بيتقرا من sw.js (المصدر الوحيد)
const swMatch = read(SW).match(CACHE_RE);
if (!swMatch) {
  console.error('✗ مش لاقي CACHE_NAME بالشكل ده في sw.js: const CACHE_NAME = \'elforat-cache-vN\'');
  process.exit(1);
}
const current = parseInt(swMatch[2], 10);

const arg = process.argv[2];
const next = arg === undefined ? current + 1 : parseInt(arg, 10);
if (!Number.isInteger(next) || next < 1) {
  console.error('✗ الرقم لازم يكون عدد صحيح موجب، اتكتب: ' + arg);
  process.exit(1);
}
if (next === current) {
  console.error('✗ الرقم الجديد (' + next + ') نفس الحالي. مفيش حاجة اتغيّرت.');
  process.exit(1);
}

console.log('النسخة: v' + current + ' → v' + next + '\n');

let total = 0;
for (const file of FILES) {
  if (!fs.existsSync(path.join(__dirname, file))) {
    console.warn('! ' + file + ' مش موجود، اتخطّى');
    continue;
  }
  let content = read(file);
  let count = 0;

  content = content.replace(/\?v=\d+/g, () => { count++; return '?v=' + next; });

  if (file === SW) {
    content = content.replace(CACHE_RE, (_, a, __, c) => { count++; return a + next + c; });
  }

  write(file, content);
  total += count;
  console.log('✓ ' + file.padEnd(14) + count + ' تغيير');
}

// فحص أخير: لو فاضل أي رقم قديم في أي ملف يبان فوراً
const stale = [];
for (const file of FILES) {
  if (!fs.existsSync(path.join(__dirname, file))) continue;
  const content = read(file);
  const olds = (content.match(/\?v=\d+/g) || []).filter((v) => v !== '?v=' + next);
  if (olds.length) stale.push(file + ': ' + olds.join(', '));
}
if (stale.length) {
  console.error('\n✗ لسه فيه أرقام مختلفة:\n  ' + stale.join('\n  '));
  process.exit(1);
}

console.log('\nتم: ' + total + ' تغيير. ارفعي الملفات.');
