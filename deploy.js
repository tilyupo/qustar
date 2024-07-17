const axios = require('axios');
const {exec, spawn} = require('child_process');
const semver = require('semver');
const path = require('path');

const packageJsonPath = path.resolve(process.cwd(), 'package.json');
const packageJson = require(packageJsonPath);
const packageName = packageJson.name;

async function getCurrentVersion() {
  try {
    const response = await axios.get(
      `https://registry.npmjs.org/${packageName}`
    );
    return response.data['dist-tags'].latest;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('Package not found. Setting initial version to 0.0.1.');
      return '0.0.0';
    } else {
      console.error('Error fetching the current version:', error);
      // eslint-disable-next-line n/no-process-exit
      process.exit(1);
    }
  }
}
function updatePackageVersion(newVersion) {
  return new Promise((resolve, reject) => {
    exec(`npm version ${newVersion}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error updating the package version: ${error}`);
        // eslint-disable-next-line n/no-process-exit
        reject(error);
      }
      console.log(stdout);
      console.error(stderr);

      resolve();
    });
  });
}

function publishPackage() {
  return new Promise((resolve, reject) => {
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
    const nextVersion = semver.inc(currentVersion, 'patch');

    console.log(`Next version: ${nextVersion}`);

    console.log('Updating package.json...');
    await updatePackageVersion(nextVersion);
    console.log('Publishing new version...');
    await publishPackage();
    console.log('Reverting package.json...');
    await updatePackageVersion(packageJson.version);

    console.log('Package published successfully!');
  } catch (error) {
    console.log(`Failed to publish the package: ${error}`);
    // eslint-disable-next-line n/no-process-exit
    process.exit(1);
  }
}

publishPatch();