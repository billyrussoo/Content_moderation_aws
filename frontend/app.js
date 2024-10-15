const moderateButton = document.getElementById('moderate-btn');
const moderationBar = document.getElementById('moderation-bar');
const videoElement = document.getElementById('video');
const folderSelect = document.getElementById('folder-select');
const videoFileName = 'test-video.mp4';  // Example video filename

folderSelect.addEventListener('change', () => {
    const folder = folderSelect.value;
    document.getElementById('video-source').src = `https://rekognitionmoderate.s3.amazonaws.com/${folder}/${videoFileName}`;
    videoElement.load();
});

moderateButton.addEventListener('click', () => {
    const selectedFolder = folderSelect.value;

    fetch('http://localhost:5000/moderate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            folder: selectedFolder,
            video_key: videoFileName
        })
    })
    .then(response => response.json())
    .then(results => {
        console.log('Moderation results received');
        displayModerationResults(results);
    })
    .catch(error => console.error('Error starting moderation:', error));
});

function displayModerationResults(results) {
    const labels = results.ModerationLabels;
    const videoDuration = videoElement.duration * 1000;

    labels.forEach(label => {
        const start = label.Timestamp;
        const end = start + 5000;
        const segment = document.createElement('div');

        const widthPercentage = ((end - start) / videoDuration) * 100;
        segment.style.width = `${widthPercentage}%`;
        segment.style.height = '5px';
        segment.style.position = 'absolute';

        switch (label.ModerationLabel.Name) {
            case 'Explicit Nudity':
            case 'Graphic Violence':
                segment.style.backgroundColor = 'red';
                break;
            case 'Suggestive':
            case 'Violence':
                segment.style.backgroundColor = 'yellow';
                break;
            default:
                segment.style.backgroundColor = 'green';
        }

        moderationBar.appendChild(segment);
    });
}
