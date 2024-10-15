from flask import Flask, render_template, request, jsonify
import boto3
import time

# Initialize Flask app and set template folder to 'frontend'
app = Flask(__name__, template_folder='frontend')

# Initialize AWS Rekognition client
rekognition = boto3.client('rekognition', region_name='eu-west-2')  # Set your region (e.g., Europe (London))

# Route to serve the index.html file (frontend)
@app.route('/')
def home():
    return render_template('index.html')

# Route to handle video moderation requests
@app.route('/moderate', methods=['POST'])
def moderate_video():
    data = request.get_json()
    folder = data['folder']  # aggressive or non_aggressive
    video_key = f"{folder}/{data['video_key']}"
    bucket = 'rekognitionmoderate'  # Replace with your S3 bucket name

    # Start Rekognition moderation job
    response = rekognition.start_content_moderation(
        Video={'S3Object': {'Bucket': bucket, 'Name': video_key}},
        MinConfidence=70  # Set confidence threshold for moderation
    )
    job_id = response['JobId']

    # Poll for job completion
    while True:
        result = rekognition.get_content_moderation(JobId=job_id)
        if result['JobStatus'] == 'SUCCEEDED':
            return jsonify(result)  # Return the moderation results to the frontend
        time.sleep(5)  # Wait before polling again

# Start the Flask app
if __name__ == "__main__":
    app.run(debug=True)
