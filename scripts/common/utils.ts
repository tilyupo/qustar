import {spawn} from 'child_process';

export function run(command: string, ...args: string[]): Promise<void> {
  console.log(['>', command].concat(args).join(' '), '\n');
  return new Promise((resolve, reject) => {
    const publishProcess = spawn(command, args, {stdio: 'inherit'});

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
