const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { MediaConvertClient, CreateJobCommand, GetJobCommand } = require("@aws-sdk/client-mediaconvert");

const app = express();
const port = process.env.PORT || 3000;

// AWS Configuration
const REGION = 'us-east-2'; // Replace with your region
const S3_BUCKET = 'arstorage-ar'; // Replace with your bucket name
const MEDIA_CONVERT_ENDPOINT = 'https://wa11sy9gb.mediaconvert.us-east-2.amazonaws.com'; // Replace with your MediaConvert endpoint
const MEDIA_CONVERT_ROLE = 'arn:aws:iam::051826719391:role/MediaConvertS3Access'; // Replace with your IAM role ARN

// AWS Clients
const s3Client = new S3Client({ region: REGION });
const mediaConvertClient = new MediaConvertClient({ endpoint: MEDIA_CONVERT_ENDPOINT, region: REGION });

// Enable CORS
app.use(cors());

// Set up file upload destination
const upload = multer({ dest: 'uploads/' });

// Function to wait for MediaConvert job completion
async function waitForMediaConvertJob(jobId) {
    let jobStatus = null;

    while (true) {
        const getJobCommand = new GetJobCommand({ Id: jobId });
        const jobResponse = await mediaConvertClient.send(getJobCommand);
        jobStatus = jobResponse.Job.Status;

        console.log(`MediaConvert Job Status: ${jobStatus}`);
        if (jobStatus === 'COMPLETE') {
            return jobResponse;
        } else if (jobStatus === 'ERROR') {
            throw new Error('MediaConvert job failed');
        }

        // Wait for 5 seconds before polling again
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

// Upload endpoint
app.post('/upload', upload.single('video'), async (req, res) => {
    const inputFilePath = req.file.path; // Path to the uploaded file
    const s3InputKey = `uploads/${Date.now()}_${req.file.originalname}`;
    const s3OutputPrefix = `outputs/${Date.now()}/`;

    try {
        // Upload file to S3
        const fileContent = fs.readFileSync(inputFilePath);
        const uploadCommand = new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3InputKey,
            Body: fileContent,
            ContentType: req.file.mimetype,
        });
        await s3Client.send(uploadCommand);

        console.log(`File uploaded to S3: ${s3InputKey}`);

        // Trigger MediaConvert job
        const jobParams = {
            Role: MEDIA_CONVERT_ROLE,
            Settings: {
                Inputs: [
                    {
                        FileInput: `s3://${S3_BUCKET}/${s3InputKey}`,
                    },
                ],
                OutputGroups: [
                    {
                        OutputGroupSettings: {
                            Type: 'FILE_GROUP_SETTINGS',
                            FileGroupSettings: {
                                Destination: `s3://${S3_BUCKET}/${s3OutputPrefix}`,
                            },
                        },
                        Outputs: [
                            {
                                ContainerSettings: {
                                    Container: 'MP4',
                                },
                                VideoDescription: {
                                    CodecSettings: {
                                        Codec: 'H_264',
                                        H264Settings: {
                                            MaxBitrate: 5000000,
                                            RateControlMode: 'QVBR',
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        };

        const createJobCommand = new CreateJobCommand(jobParams);
        const job = await mediaConvertClient.send(createJobCommand);
        console.log(`MediaConvert job created: ${job.Job.Id}`);

        // Wait for MediaConvert job to complete
        const jobResponse = await waitForMediaConvertJob(job.Job.Id);

        // Extract the output file location
        const outputFilePath = `${s3OutputPrefix}output.mp4`; // Update if MediaConvert appends filenames automatically

        // Send the MP4 file's S3 URL back to the client
        const mp4Url = `https://${S3_BUCKET}.s3.${REGION}.amazonaws.com/${outputFilePath}`;
        res.json({ message: 'Video processed successfully', mp4Url });

        // Cleanup: Delete local file
        fs.unlinkSync(inputFilePath);
    } catch (error) {
        console.error('Error processing video:', error);
        res.status(500).json({
            error: 'Error processing video',
            details: error.message,
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.send('MediaConvert integration is working!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
