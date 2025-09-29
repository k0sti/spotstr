#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function checkVersions() {
  const errors = [];

  // Read package.json version
  const pkg = readJson(path.join(ROOT_DIR, 'package.json'));
  const packageVersion = pkg.version;
  console.log(`\n📦 Checking version consistency...`);
  console.log(`   package.json: ${packageVersion}`);

  // Check Android build.gradle
  const gradlePath = path.join(ROOT_DIR, 'android', 'app', 'build.gradle');
  const gradle = fs.readFileSync(gradlePath, 'utf8');

  const versionNameMatch = gradle.match(/versionName\s+"([^"]+)"/);
  const gradleVersion = versionNameMatch ? versionNameMatch[1] : null;

  const versionCodeMatch = gradle.match(/versionCode\s+(\d+)/);
  const versionCode = versionCodeMatch ? parseInt(versionCodeMatch[1]) : null;

  // Calculate expected versionCode
  const [major, minor, patch] = packageVersion.split('.').map(Number);
  const expectedVersionCode = major * 10000 + minor * 100 + patch;

  console.log(`   build.gradle: ${gradleVersion} (code: ${versionCode})`);

  if (gradleVersion !== packageVersion) {
    errors.push(`❌ Version mismatch in build.gradle: ${gradleVersion} (expected ${packageVersion})`);
  }

  if (versionCode !== expectedVersionCode) {
    errors.push(`❌ Version code mismatch in build.gradle: ${versionCode} (expected ${expectedVersionCode})`);
  }

  // Check config.xml if it exists (note: this file is gitignored by Capacitor)
  const configPath = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res', 'xml', 'config.xml');
  if (fs.existsSync(configPath)) {
    const config = fs.readFileSync(configPath, 'utf8');
    const configVersionMatch = config.match(/version="([^"]+)"/);
    const configVersion = configVersionMatch ? configVersionMatch[1] : null;
    console.log(`   config.xml: ${configVersion} (gitignored)`);

    // Don't treat config.xml version mismatch as an error since it's gitignored
    if (configVersion !== packageVersion) {
      console.log(`   Note: config.xml has different version but is gitignored`);
    }
  }

  // Check if current version has a git tag
  try {
    const tags = execSync('git tag --list', { encoding: 'utf8' }).trim().split('\n');
    const expectedTag = `v${packageVersion}`;
    const hasTag = tags.includes(expectedTag);

    if (!hasTag) {
      console.log(`\n⚠️  No git tag found for version ${packageVersion}`);
      console.log(`   Run 'bun run version:patch' to create a new version with tag`);
      console.log(`   Or manually tag: git tag v${packageVersion}`);
    } else {
      console.log(`   git tag: ${expectedTag} ✓`);
    }
  } catch (error) {
    console.log(`   git: Unable to check tags`);
  }

  if (errors.length > 0) {
    console.log('\n❌ Version inconsistencies found:');
    errors.forEach(error => console.log(`   ${error}`));
    console.log('\n💡 Run "bun run version:set <version>" to fix all versions');
    process.exit(1);
  } else {
    console.log('\n✅ All versions are consistent!');
  }
}

checkVersions();