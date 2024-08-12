const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create an output directory for HLS segments
const outputDir = 'hls';
if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir);
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://sportshub:Dontbeadick!@sportshub.hopto.org/SHUB/fixtures/creator/tools/fixtureschannel/live.php'); // Replace with your URL
    await page.setViewportSize({ width: 1920, height: 1080 });



    // Spawn ffmpeg process to create an HLS stream
    const ffmpeg = spawn('ffmpeg', [
        '-f', 'image2pipe',
        '-framerate', '30',
        '-i', '-', // Input from stdin
        '-c:v', 'libx264',
        '-r', '30',
        '-pix_fmt', 'yuv420p',
        '-hls_time', '10', // Segment duration
        '-hls_list_size', '0', // Include all segments in the playlist
        '-hls_flags', 'delete_segments', // Automatically delete old segments
        '-hls_segment_filename', path.join(outputDir, 'segment_%03d.ts'), // Segment file pattern
        path.join(outputDir, 'playlist.m3u8') // Output playlist file
    ]);

    let lastScreenshotBuffer = null;

    const captureScreenshot = async () => {
        try {
            const screenshotBuffer = await page.screenshot({ encoding: 'binary' });
            if (screenshotBuffer.length > 0) {
                lastScreenshotBuffer = screenshotBuffer
            }
        } catch (err) {
            console.error('Error capturing screenshot:', err);
        }
    };
    const startCapturing = async () => {
        while (true) {
            await captureScreenshot();
            // Wait for the next screenshot, adjust delay as needed
            await new Promise(resolve => setTimeout(resolve, 100)); // Adjust delay according to your screen generation time
        }
    };

    startCapturing();
    // Capture screenshots and stream them to ffmpeg
    while (true) {
        if (lastScreenshotBuffer) {
            ffmpeg.stdin.write(lastScreenshotBuffer);
        }
        await new Promise(resolve => setTimeout(resolve, 30)); // Adjust delay according to your screen generation time
    }
})();

