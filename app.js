const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const serverless = require ("serverless-http")
const path = require('path');

const app = express();
//const PORT = 8000;

// Enable CORS
//app.use(cors());

// Set up file upload destination
const upload = multer({ dest: 'uploads/' });

// Convert video endpoint
app.post('/convert', upload.single('video'), (req, res) => {
  const inputFilePath = req.file.path; // Uploaded file path
  const outputFilePath = path.join(__dirname, 'outputs', 'output.mp4');

  // Ensure the outputs directory exists
  if (!fs.existsSync('outputs')) {
    fs.mkdirSync('outputs');
  }

  // Use FFmpeg to convert the file
  ffmpeg(inputFilePath)
    .output(outputFilePath)
    .on('end', () => {
      res.download(outputFilePath, 'converted-video.mp4', (err) => {
        // Clean up files after download
        fs.unlinkSync(inputFilePath);
        fs.unlinkSync(outputFilePath);
      });
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      res.status(500).json({ error: 'Video conversion failed' });
    })
    .run();
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Node.js backend is working!');
});

// Start the server
//app.listen(PORT, () => {
 // console.log(Server is running on http://localhost:${PORT});
//});
module.exports.handler = serverless(app)