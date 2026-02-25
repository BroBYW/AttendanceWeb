const { execSync } = require('child_process');
try {
    execSync('npm run build', { encoding: 'utf8', stdio: 'pipe' });
} catch (e) {
    require('fs').writeFileSync('err.txt', e.stdout + '\n' + e.stderr);
}
