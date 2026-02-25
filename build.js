const { execSync } = require('child_process');
try {
    execSync('npm run build', { encoding: 'utf8' });
    console.log('Build succeeded');
} catch (e) {
    require('fs').writeFileSync('err.txt', e.stdout + '\n' + e.stderr);
    console.log('Build failed, wrote to err.txt');
}
