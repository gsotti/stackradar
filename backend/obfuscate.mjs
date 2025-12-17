#!/usr/bin/env node

/**
 * Obfuscate JavaScript files using javascript-obfuscator
 * This makes the code harder to reverse engineer
 *
 * Set DISABLE_OBFUSCATION=true to skip obfuscation
 */

import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if obfuscation is disabled via environment variable
const isObfuscationDisabled = process.env.DISABLE_OBFUSCATION === 'true';

if (isObfuscationDisabled) {
  console.log('⚠️  Obfuscation DISABLED via DISABLE_OBFUSCATION environment variable');
  console.log('📦 Build complete without obfuscation\n');
  process.exit(0);
}

let obfuscatedCount = 0;

function obfuscateDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`❌ Directory ${dir} does not exist`);
    return;
  }

  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Recursively obfuscate subdirectories
      obfuscateDirectory(filePath);
    } else if (file.endsWith('.js')) {
      try {
        console.log(`🔒 Obfuscating ${filePath}...`);

        const code = fs.readFileSync(filePath, 'utf8');

        const obfuscated = JavaScriptObfuscator.obfuscate(code, {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.4,
          debugProtection: false,
          debugProtectionInterval: 0,
          disableConsoleOutput: false,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          numbersToExpressions: true,
          renameGlobals: false,
          selfDefending: true,
          simplify: true,
          splitStrings: true,
          splitStringsChunkLength: 10,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayEncoding: ['base64'],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 2,
          stringArrayWrappersChainedCalls: true,
          stringArrayWrappersParametersMaxCount: 4,
          stringArrayWrappersType: 'function',
          stringArrayThreshold: 0.75,
          transformObjectKeys: true,
          unicodeEscapeSequence: false
        });

        fs.writeFileSync(filePath, obfuscated.getObfuscatedCode());
        obfuscatedCount++;

        console.log(`   ✅ Obfuscated ${filePath}`);
      } catch (error) {
        console.error(`   ❌ Failed to obfuscate ${filePath}:`, error.message);
      }
    }
  });
}

console.log('🔄 Starting JavaScript obfuscation...\n');

const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory does not exist. Run "yarn build:no-obfuscate" first.');
  process.exit(1);
}

// Obfuscate all JS files in dist directory
obfuscateDirectory(distDir);

console.log(`\n✅ Obfuscation complete! Obfuscated ${obfuscatedCount} file(s).`);
console.log('📦 Your code is now heavily obfuscated and difficult to reverse engineer');
