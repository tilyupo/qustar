import axios from 'axios';
import {exec, spawn} from 'child_process';
import {resolve as _resolve} from 'path';
import {inc} from 'semver';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import {copyFileSync, readFileSync, rmSync} from 'fs';
import {run} from './common/utils';

const packageJsonPath = _resolve(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const packageName = packageJson.name;

async function getCurrentVersion() {
  try {
    const response = await axios.get(
      `https://registry.npmjs.org/${packageName}`
    );
    return response.data['dist-tags'].latest;
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      console.log('Package not found. Setting initial version to 0.0.1.');
      return '0.0.1';
    } else {
      console.error('Error fetching the current version:', error);
      // eslint-disable-next-line n/no-process-exit
      process.exit(1);
    }
  }
}
function updatePackageVersion(newVersion) {
  return new Promise<void>((resolve, reject) => {
    exec(`npm version ${newVersion}`, error => {
      if (error) {
        console.error(`Error updating the package version: ${error}`);
        // eslint-disable-next-line n/no-process-exit
        reject(error);
      }

      resolve();
    });
  });
}

function publishPackage() {
  return new Promise<void>((resolve, reject) => {
    const publishProcess = spawn('npm', ['publish'], {stdio: 'inherit'});

    publishProcess.on('error', error => {
      console.error(`Error publishing the package: ${error}`);
      reject(error);
    });

    publishProcess.on('close', code => {
      if (code !== 0) {
        reject(new Error(`npm publish process exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function publishPatch() {
  try {
    const currentVersion = await getCurrentVersion();
    const nextVersion = inc(currentVersion, 'patch');

    console.log(`Next version: ${nextVersion}`);

    await run('npm', 'run', 'build');
    copyFileSync('../../LICENSE', './LICENSE');

    console.log('Updating package.json...');
    await updatePackageVersion(nextVersion);
    console.log('Publishing new version...');
    await publishPackage();

    console.log('Package published successfully!');
  } catch (error) {
    console.log(`Failed to publish the package: ${error}`);
    // eslint-disable-next-line n/no-process-exit
    process.exit(1);
  } finally {
    try {
      rmSync('./LICENSE');
    } finally {
      console.log('Reverting package.json...');
      await updatePackageVersion('0.0.1');
    }
  }
}

await publishPatch();
