const videoSelect = document.getElementById('video-select');
const videoElement = document.getElementById('video');
const moderateButton = document.getElementById('moderate-btn');
const moderationBar = document.getElementById('moderation-bar');
const moderationLabelsDiv = document.getElementById('moderationLabels');
const loader = document.createElement('div'); // Loader element
const timeline = document.createElement('div'); // Timeline for time markers

// Create and style the loader
loader.id = 'loader';
loader.textContent = 'Processing video...';
loader.style.display = 'none';  // Initially hidden
loader.style.textAlign = 'center';
loader.style.fontSize = '18px';
loader.style.marginTop = '20px';

// Add the loader to the page (after moderation bar)
moderationBar.after(loader);

// Add the timeline beneath the moderation bar
timeline.id = 'timeline';
timeline.style.width = '100%';
timeline.style.height = '30px';
timeline.style.position = 'relative';
timeline.style.marginTop = '10px';
timeline.style.display = 'flex';
moderationBar.after(timeline);

// Fetch the list of videos from the backend
fetch('/list_videos')
    .then(response => response.json())
    .then(videos => {
        // Clear existing options
        videoSelect.innerHTML = '<option value="">Select a video</option>';

        // Populate the dropdown with the video files
        videos.forEach(video => {
            const option = document.createElement('option');
            option.value = video;
            option.textContent = video; // Display the full path
            videoSelect.appendChild(option);
        });
    })
    .catch(error => console.error('Error fetching video list:', error));

// When a video is selected
videoSelect.addEventListener('change', () => {
    const selectedVideo = videoSelect.value;
    if (selectedVideo) {
        // Construct the video URL with the correct folder path
        const videoUrl = `https://rekognition45-london.s3.eu-west-2.amazonaws.com/${selectedVideo}`;
        document.getElementById('video-source').src = videoUrl;
        videoElement.load();
        moderateButton.disabled = false;  // Enable the "Start Moderation" button
        moderationBar.innerHTML = '';  // Clear previous moderation bar
        moderationLabelsDiv.innerHTML = '';  // Clear previous labels
        timeline.innerHTML = '';  // Clear the timeline
    }
});

// When the "Start Moderation" button is clicked
moderateButton.addEventListener('click', () => {
    const selectedVideo = videoSelect.value;

    // Show the loader
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

        if (moderationResponse && moderationResponse.ModerationLabels.length > 0) {
            displayModerationResults(moderationResponse);
        } else {
            moderationBar.innerHTML = '';  // Clear the moderation bar
            moderationLabelsDiv.innerHTML = 'No inappropriate content detected in the video.';
        }
    })
    .catch(error => console.error('Error starting moderation:', error))
    .finally(() => {
        // Hide the loader once the moderation process is complete
        loader.style.display = 'none';
    });
});

// Function to display moderation results in the moderation bar
function displayModerationResults(results) {
    console.log('Moderation Results:', results);  // Log the moderation results for debugging

    const moderationBar = document.getElementById('moderation-bar');
    const moderationLabelsDiv = document.getElementById('moderationLabels');

    // Clear previous content
    moderationBar.innerHTML = '';
    moderationLabelsDiv.innerHTML = '';
    timeline.innerHTML = '';

    // Get the moderation labels and video duration
    const labels = results.ModerationLabels;
    const videoDuration = videoElement.duration * 1000;  // Duration in milliseconds

    console.log('Labels:', labels);  // Log the labels for debugging

    // If there are no labels, display a message
    if (!labels || labels.length === 0) {
        moderationLabelsDiv.innerHTML = 'No inappropriate content detected in the video.';
        return;
    }

    // Loop through each moderation label and add it to the timeline
    labels.forEach(labelData => {
        const start = labelData.Timestamp;
        const moderationLabel = labelData.ModerationLabel.Name;
        const confidence = labelData.ModerationLabel.Confidence.toFixed(2);

        const end = start + 5000;  // Assuming each segment is 5 seconds long

        // Create the timeline segment
        const segment = document.createElement('div');
        const widthPercentage = ((end - start) / videoDuration) * 100;

        segment.style.width = `${widthPercentage}%`;
        segment.style.height = '30px';
        segment.style.position = 'absolute';
        segment.style.left = `${(start / videoDuration) * 100}%`;

        // Set the color of the segment based on the confidence and content type
        if (confidence >= 85) {
            segment.style.backgroundColor = 'red'; // Inappropriate content
        } else if (confidence >= 70) {
            segment.style.backgroundColor = 'yellow'; // Moderate content
        } else {
            segment.style.backgroundColor = 'green'; // Safe content
        }

        moderationBar.appendChild(segment);

        // Display the moderation labels beside the bar
        const labelElement = document.createElement('p');
        labelElement.textContent = `${moderationLabel} (Confidence: ${confidence}%) - Time: ${start / 1000}s`;
        moderationLabelsDiv.appendChild(labelElement);
    });

    // Create the time markers beneath the video timeline
    createTimeMarkers(videoDuration);
    // Create the legend beside the moderation bar
    createLegend();
}

// Function to create a legend for the color codes (positioned beside the bar)
function createLegend() {
    const legend = document.createElement('div');
    legend.id = 'legend-container';
    legend.innerHTML = `
        <p><span style="color:red">■</span> Inappropriate Content</p>
        <p><span style="color:yellow">■</span> Moderate Content</p>
        <p><span style="color:green">■</span> Safe Content</p>
    `;
    document.querySelector('.moderation-container').appendChild(legend);
}

// Function to create time markers below the timeline
function createTimeMarkers(videoDuration) {
    const totalDurationInSeconds = videoDuration / 1000;
    const markerInterval = totalDurationInSeconds / 10;  // Create 10 markers

    for (let i = 0; i <= 10; i++) {
        const timeMarker = document.createElement('div');
        timeMarker.style.position = 'absolute';
        timeMarker.style.left = `${(i * 10)}%`;
        timeMarker.textContent = `${(markerInterval * i).toFixed(1)}s`;
        timeMarker.style.fontSize = '12px';
        timeMarker.style.color = '#000';
        timeline.appendChild(timeMarker);
    }
}
