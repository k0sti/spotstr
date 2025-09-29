#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function updatePackageJson(version) {
  const pkgPath = path.join(ROOT_DIR, 'package.json');
  const pkg = readJson(pkgPath);
  const oldVersion = pkg.version;
  pkg.version = version;
  writeJson(pkgPath, pkg);
  console.log(`✓ Updated package.json: ${oldVersion} → ${version}`);
  return oldVersion;
}

function updateAndroidBuildGradle(version) {
  const gradlePath = path.join(ROOT_DIR, 'android', 'app', 'build.gradle');
  let gradle = fs.readFileSync(gradlePath, 'utf8');

  // Parse version into major.minor.patch
  const [major, minor, patch] = version.split('.').map(Number);
  // Generate versionCode: major * 10000 + minor * 100 + patch
  const versionCode = major * 10000 + minor * 100 + patch;

  // Update versionCode
  gradle = gradle.replace(
    /versionCode\s+\d+/,
    `versionCode ${versionCode}`
  );

  // Update versionName
  gradle = gradle.replace(
    /versionName\s+"[^"]+"/,
    `versionName "${version}"`
  );

  fs.writeFileSync(gradlePath, gradle);
  console.log(`✓ Updated android/app/build.gradle: versionCode=${versionCode}, versionName="${version}"`);
}

function updateAndroidConfigXml(version) {
  const configPath = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res', 'xml', 'config.xml');
  if (fs.existsSync(configPath)) {
    let config = fs.readFileSync(configPath, 'utf8');
    config = config.replace(
      /version="[^"]+"/,
      `version="${version}"`
    );
    fs.writeFileSync(configPath, config);
    console.log(`✓ Updated android config.xml: version="${version}"`);
  }
}

function gitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    return status.trim();
  } catch (error) {
    console.error('Error checking git status:', error.message);
    return '';
  }
}

function gitCommitAndTag(version, oldVersion) {
  try {
    // Check if we're in a git repository
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });

    // Add version files
    execSync('git add package.json android/app/build.gradle android/app/src/main/res/xml/config.xml', {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    // Commit
    const commitMessage = `chore: bump version from ${oldVersion} to ${version}`;
    execSync(`git commit -m "${commitMessage}"`, {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    console.log(`✓ Created commit: ${commitMessage}`);

    // Create tag
    const tagName = `v${version}`;
    execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
    console.log(`✓ Created tag: ${tagName}`);

    console.log('\n📦 Version bump complete!');
    console.log(`To push changes and trigger release build:`);
    console.log(`  git push && git push origin v${version}`);

  } catch (error) {
    console.error('Git operations failed:', error.message);
    console.log('\n⚠️  Version files updated but not committed.');
    console.log('You can manually commit and tag with:');
    console.log(`  git add -A && git commit -m "chore: bump version to ${version}"`);
    console.log(`  git tag v${version}`);
  }
}

function bumpVersion(currentVersion, type) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid version bump type: ${type}`);
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node version-bump.js <version|major|minor|patch>');
    console.error('  version: specific version like 0.2.0');
    console.error('  major/minor/patch: auto-increment from current version');
    process.exit(1);
  }

  const arg = args[0];
  const pkg = readJson(path.join(ROOT_DIR, 'package.json'));
  const currentVersion = pkg.version;

  let newVersion;
  if (arg === 'major' || arg === 'minor' || arg === 'patch') {
    newVersion = bumpVersion(currentVersion, arg);
  } else if (/^\d+\.\d+\.\d+$/.test(arg)) {
    newVersion = arg;
  } else {
    console.error('Invalid version format. Use x.x.x or major/minor/patch');
    process.exit(1);
  }

  console.log(`\n📋 Bumping version: ${currentVersion} → ${newVersion}\n`);

  // Check for uncommitted changes
  const status = gitStatus();
  if (status && !status.includes('package.json') && !status.includes('build.gradle')) {
    console.warn('⚠️  Warning: You have uncommitted changes. Consider committing them first.\n');
  }

  // Update all version files
  const oldVersion = updatePackageJson(newVersion);
  updateAndroidBuildGradle(newVersion);
  updateAndroidConfigXml(newVersion);

  // Commit and tag
  gitCommitAndTag(newVersion, oldVersion);
}

main();