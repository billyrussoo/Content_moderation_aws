from flask import Flask, render_template, jsonify, request
import boto3
import time

app = Flask(__name__, template_folder='frontend', static_folder='frontend')

# Initialize S3 client for the new bucket in London (eu-west-2)
s3 = boto3.client('s3', region_name='eu-west-2')
BUCKET_NAME = 'rekognition45-london'  # Updated to the new S3 bucket name

# Route to list all video files in the S3 bucket
@app.route('/list_videos', methods=['GET'])
def list_videos():
    video_files = []
    folders = ['aggressive', 'non_aggressive']

    # Iterate over both folders to get video files
    for folder in folders:
        response = s3.list_objects_v2(Bucket=BUCKET_NAME, Prefix=folder + '/')
        if 'Contents' in response:
            for obj in response['Contents']:
                if obj['Key'].endswith('.mp4'):  # Only add MP4 files
                    video_files.append(obj['Key'])  # Include the folder name in the key

    return jsonify(video_files)

# Route to handle video moderation requests
@app.route('/moderate', methods=['POST'])
def moderate_video():
    data = request.get_json()
    video_key = data['video_key']
    video_s3_path = f"{video_key}"

    # Initialize Rekognition client in London (eu-west-2)
    rekognition = boto3.client('rekognition', region_name='eu-west-2')

    # Start Rekognition moderation job
    response = rekognition.start_content_moderation(
        Video={'S3Object': {'Bucket': BUCKET_NAME, 'Name': video_s3_path}},
        MinConfidence=70  # Confidence threshold for moderation
    )
    job_id = response['JobId']

    # Poll for job completion
    while True:
        result = rekognition.get_content_moderation(JobId=job_id)
        if result['JobStatus'] == 'SUCCEEDED':
            print(result)
            return jsonify(result)  # Return the moderation results to the frontend
        time.sleep(5)  # Wait before polling again

# Route to serve the index.html file
@app.route('/')
def home():
    return render_template('index.html')

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
