#!/usr/bin/env node

/**
 * Compile JavaScript files to V8 bytecode (.jsc files)
 * This makes the code harder to reverse engineer
 */

import bytenode from 'bytenode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let compiledCount = 0;

function compileDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`❌ Directory ${dir} does not exist`);
    return;
  }

  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Recursively compile subdirectories
      compileDirectory(filePath);
    } else if (file.endsWith('.js') && !file.endsWith('.jsc')) {
      try {
        console.log(`🔒 Compiling ${filePath}...`);

        // Compile to bytecode
        const outputPath = filePath.replace('.js', '.jsc');
        bytenode.compileFile({
          filename: filePath,
          output: outputPath
        });

        // Remove original JS file
        fs.unlinkSync(filePath);
        compiledCount++;

        console.log(`   ✅ Created ${outputPath}`);
      } catch (error) {
        console.error(`   ❌ Failed to compile ${filePath}:`, error.message);
      }
    }
  });
}

console.log('🔄 Starting bytecode compilation...\n');

const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory does not exist. Run "yarn build" first.');
  process.exit(1);
}

// Compile all JS files in dist directory
compileDirectory(distDir);

console.log(`\n✅ Bytecode compilation complete! Compiled ${compiledCount} file(s).`);
console.log('📦 Your code is now obfuscated as V8 bytecode (.jsc files)');
