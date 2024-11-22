const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 4000;

// Enable CORS
app.use(cors());

// Set up file upload destination
const upload = multer({ dest: 'uploads/' });

// Function to convert WebM to MP4
function convertWebmToMp4(inputWebmPath, outputMp4Path) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputWebmPath,
      '-c:v', 'libx264',
      outputMp4Path
    ]);

    ffmpeg.on('error', (err) => {
      console.error('FFmpeg error:', err);
      reject(err);
});

    ffmpeg.on('exit', (code) => {
      if (code !== 0) {
        console.error('FFmpeg exited with non-zero code:', code);
        reject(new Error(`FFmpeg exited with non-zero code: ${code}`));
      } else {
        console.log('Video conversion complete!');
        resolve();
      }
    });
  });
}

// Convert video endpoint
app.post('/convert', upload.single('video'), async (req, res) => {
  const inputFilePath = req.file.path; // Uploaded file path
  const outputFilePath = path.join(__dirname, 'outputs', `${Date.now()}.mp4`);

  // Ensure the outputs directory exists
  if (!fs.existsSync('outputs')) {
    fs.mkdirSync('outputs');
  }

  try {
    await convertWebmToMp4(inputFilePath, outputFilePath);
    res.download(outputFilePath, 'converted-video.mp4', (err) => {if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up files after download
      fs.unlinkSync(inputFilePath);
      fs.unlinkSync(outputFilePath);
    });
  } catch (error) {
    console.error('Error during conversion:', error);
    res.status(500).json({ error: 'Video conversion failed' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Node.js backend is working!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});


