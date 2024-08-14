const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

const port = 3000;
const hostname = "localhost";
const url = "http://sportshub:Dontbeadick!@sportshub.hopto.org/SHUB/fixtures/creator/tools/fixtureschannel/live.php";
const frameRate = 30;

// Create an output directory for HLS segments
const outputDir = 'hls';
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}



app.use('/hls', express.static(path.join(__dirname, 'hls')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.listen(port, hostname, () => {
    console.log(`Server is running on http://localhost:${port}`);
});



const startServer = async () => {
    let ffmpeg;
    let browser;
    let page;
    let browserCrashed = false;

    const restartBrowser = async () => {
        if (browser) await browser.close();
        browser = await chromium.launch();
        page = await browser.newPage();
        page.on('close', () => {
            console.error('Browser page closed unexpectedly.');
            browserCrashed = true;
        });
        await page.goto(url); // Replace with your URL
        await page.setViewportSize({ width: 1920, height: 1080 });
    };

    const restartFFmpeg = () => {
        if (ffmpeg) ffmpeg.kill();
        ffmpeg = spawn('ffmpeg', [
            '-f', 'image2pipe',
            '-framerate', frameRate,
            '-i', '-', // Input from stdin
            '-c:v', 'libx264',
            '-r', frameRate,
            '-pix_fmt', 'yuv420p',
            '-hls_time', '10', // Segment duration
            '-hls_list_size', '60', // Maximum number of playlist entries
            '-hls_flags', 'delete_segments+append_list', // Automatically delete old segments and append new ones
            '-hls_segment_filename', path.join(outputDir, 'segment_%03d.ts'), // Segment file pattern
            path.join(outputDir, 'playlist.m3u8') // Output playlist file
        ]);

        ffmpeg.stderr.on('data', (data) => {
            // console.error(`ffmpeg stderr: ${data}`);
        });

        ffmpeg.on('close', (code) => {
            console.log(`ffmpeg process exited with code ${code}`);
            setTimeout(restartFFmpeg, 1000); // Restart ffmpeg after 1 second
        });

        ffmpeg.on('error', (err) => {
            console.error('Error with ffmpeg process:', err);
            setTimeout(restartFFmpeg, 1000); // Restart ffmpeg after 1 second
        });
    };

    let lastScreenshotBuffer = null;

    const captureScreenshot = async () => {
        try {
            const screenshotBuffer = await page.screenshot({ encoding: 'binary' });
            if (screenshotBuffer.length > 0) {
                lastScreenshotBuffer = screenshotBuffer;
            }
        } catch (err) {
            console.error('Error capturing screenshot:', err);
            browserCrashed = true; // Mark browser as crashed if screenshot fails
        }
    };

    const startCapturing = async () => {
        while (true) {
            await captureScreenshot();
            await new Promise(resolve => setTimeout(resolve, 100)); // Adjust delay according to your screen generation time
        }
    };

    const startStreaming = async () => {
        while (true) {
            if (lastScreenshotBuffer) {
                try {
                    ffmpeg.stdin.write(lastScreenshotBuffer);
                } catch (err) {
                    console.error('Error writing to ffmpeg stdin:', err);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 30)); // Adjust delay according to your screen generation time
        }
    };

    const monitorProcesses = async () => {
        while (true) {
            if (browserCrashed) {
                await restartBrowser();
                browserCrashed = false; // Reset the flag
                console.log('Browser restarted');
            }
            await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
        }
    };

    process.on('SIGINT', async () => {
        console.log('Caught interrupt signal');
        if (browser) await browser.close();
        if (ffmpeg) ffmpeg.stdin.end();
        process.exit();
    });




    await restartBrowser();
    restartFFmpeg();
    startCapturing();
    startStreaming();
    monitorProcesses();
};

startServer();