const videoSelect = document.getElementById('video-select');
const videoElement = document.getElementById('video');
const moderateButton = document.getElementById('moderate-btn');
const moderationBar = document.getElementById('moderation-bar');
const moderationLabelsDiv = document.getElementById('moderationLabels');
const sentimentAnalysisDiv = document.getElementById('sentimentAnalysisDiv');
const customLabelsDiv = document.getElementById('customLabelsDiv');
const loader = document.createElement('div');
const timeline = document.createElement('div');

// Loader setup
loader.id = 'loader';
loader.textContent = 'Processing video...';
loader.style.display = 'none';
loader.style.textAlign = 'center';
loader.style.fontSize = '18px';
loader.style.marginTop = '20px';
moderationBar.after(loader);
moderationBar.after(sentimentAnalysisDiv);
moderationBar.after(customLabelsDiv);

// Timeline setup
timeline.id = 'timeline';
timeline.style.width = '100%';
timeline.style.height = '30px';
timeline.style.position = 'relative';
timeline.style.marginTop = '10px';
timeline.style.display = 'flex';
moderationBar.after(timeline);

fetch('/list_videos')
    .then(response => response.json())
    .then(videos => {
        videoSelect.innerHTML = '<option value="">Select a video</option>';
        videos.forEach(video => {
            const option = document.createElement('option');
            option.value = video;
            option.textContent = video;
            videoSelect.appendChild(option);
        });
    })
    .catch(error => console.error('Error fetching video list:', error));

videoSelect.addEventListener('change', () => {
    const selectedVideo = videoSelect.value;
    if (selectedVideo) {
        const videoUrl = `https://rekognition45-london.s3.eu-west-2.amazonaws.com/${selectedVideo}`;
        document.getElementById('video-source').src = videoUrl;
        videoElement.load();
        moderateButton.disabled = false;
        moderationBar.innerHTML = '';
        moderationLabelsDiv.innerHTML = '';
        timeline.innerHTML = '';
        sentimentAnalysisDiv.innerHTML = '';
        customLabelsDiv.innerHTML = '';
    }
});

moderateButton.addEventListener('click', () => {
    const selectedVideo = videoSelect.value;
    loader.style.display = 'block';

    fetch('/moderate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            video_key: selectedVideo
        })
    })
    .then(response => response.json())
    .then(moderationResponse => {
        console.log('Moderation results received:', moderationResponse);

        if (moderationResponse) {
            if (moderationResponse.rekognition_results && moderationResponse.rekognition_results.ModerationLabels.length > 0) {
                displayModerationResults(moderationResponse.rekognition_results);
            } else {
                moderationBar.innerHTML = 'No inappropriate content detected in the video.';
            }

            if (moderationResponse.sentiment_analysis) {
                displaySentimentAnalysis(moderationResponse.sentiment_analysis);
            } else {
                sentimentAnalysisDiv.innerHTML = 'No sentiment analysis results available.';
            }

            if (moderationResponse.custom_labels) {
                displayCustomLabels(moderationResponse.custom_labels);
            }
        }
    })
    .catch(error => console.error('Error starting moderation:', error))
    .finally(() => {
        loader.style.display = 'none';
    });
});

function displayModerationResults(results) {
    moderationBar.innerHTML = '';
    moderationLabelsDiv.innerHTML = '';

    if (!results || !results.ModerationLabels) {
        moderationLabelsDiv.innerHTML = 'No inappropriate content detected in the video.';
        return;
    }

    const labels = results.ModerationLabels;
    const videoDuration = videoElement.duration * 1000;

    labels.forEach(labelData => {
        const start = labelData.Timestamp;
        const moderationLabel = labelData.ModerationLabel.Name;
        const confidence = labelData.ModerationLabel.Confidence.toFixed(2);
        const end = start + 5000;
        const segment = document.createElement('div');
        segment.style.width = `${((end - start) / videoDuration) * 100}%`;
        segment.style.height = '30px';
        segment.style.position = 'absolute';
        segment.style.left = `${(start / videoDuration) * 100}%`;

        if (confidence >= 85) {
            segment.style.backgroundColor = 'red';
        } else if (confidence >= 70) {
            segment.style.backgroundColor = 'yellow';
        } else {
            segment.style.backgroundColor = 'green';
        }

        moderationBar.appendChild(segment);
        const labelElement = document.createElement('p');
        labelElement.textContent = `${moderationLabel} (Confidence: ${confidence}%) - Time: ${start / 1000}s`;
        moderationLabelsDiv.appendChild(labelElement);
    });
}

function displaySentimentAnalysis(sentimentAnalysis) {
    sentimentAnalysisDiv.innerHTML = '';

    if (sentimentAnalysis.message === "No audio detected or transcription failed") {
        sentimentAnalysisDiv.innerHTML = 'No audio detected or transcription failed.';
    } else {
        const sentimentText = `
            <h3>Sentiment Analysis</h3>
            <p>Positive: ${(sentimentAnalysis.SentimentScore.Positive * 100).toFixed(2)}%</p>
            <p>Negative: ${(sentimentAnalysis.SentimentScore.Negative * 100).toFixed(2)}%</p>
            <p>Neutral: ${(sentimentAnalysis.SentimentScore.Neutral * 100).toFixed(2)}%</p>
            <p>Mixed: ${(sentimentAnalysis.SentimentScore.Mixed * 100).toFixed(2)}%</p>
        `;
        sentimentAnalysisDiv.innerHTML = sentimentText;
    }
}

function displayCustomLabels(customLabels) {
    customLabelsDiv.innerHTML = '';

    const customLabelText = `
        <h3>Custom Label Detection</h3>
        <p>Abusive Language: ${customLabels.Abusive ? 'Detected' : 'Not Detected'}</p>
        <p>Hate Speech: ${customLabels.Hate_Speech ? 'Detected' : 'Not Detected'}</p>

    `;
    customLabelsDiv.innerHTML = customLabelText;
}
