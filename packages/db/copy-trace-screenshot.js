const fs = require('fs');
const path = require('path');

function findJpegs(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findJpegs(filePath));
    } else if (file.endsWith('.jpeg')) {
      results.push(filePath);
    }
  }
  return results;
}

const trace2Dir =
  'C:/Users/AVITA/.gemini/antigravity/brain/c47693be-5628-4f37-9015-d55239d943d0/scratch/temp-trace/trace-2';
if (fs.existsSync(trace2Dir)) {
  const jpegs = findJpegs(trace2Dir);
  console.log(`Found ${jpegs.length} jpegs in trace-2`);
  if (jpegs.length > 0) {
    // Sort by timestamp in filename
    jpegs.sort((a, b) => {
      const matchA = a.match(/-(\d+)\.jpeg$/);
      const matchB = b.match(/-(\d+)\.jpeg$/);
      const tA = matchA ? parseInt(matchA[1], 10) : 0;
      const tB = matchB ? parseInt(matchB[1], 10) : 0;
      return tA - tB;
    });

    // Copy the last 3 jpegs to see progress
    for (let i = 1; i <= Math.min(3, jpegs.length); i++) {
      const lastJpeg = jpegs[jpegs.length - i];
      const dest = `C:/Users/AVITA/.gemini/antigravity/brain/c47693be-5628-4f37-9015-d55239d943d0/trace-screenshot-restore-${i}.jpg`;
      fs.copyFileSync(lastJpeg, dest);
      console.log(`Copied ${lastJpeg} to ${dest}`);
    }
  }
} else {
  console.error(`Dir ${trace2Dir} does not exist.`);
}
