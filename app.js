const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 4000;


// Enable CORS
// Enable CORS with specific origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://127.0.0.1:5500');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(cors());

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
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})