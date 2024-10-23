import boto3
import time
from flask import Flask, jsonify, request, render_template

app = Flask(__name__, template_folder='frontend', static_folder='frontend')

# Initialize S3, Transcribe, and Rekognition clients
s3 = boto3.client('s3')
transcribe = boto3.client('transcribe')
rekognition = boto3.client('rekognition', region_name='eu-west-2')

# S3 bucket name where the videos are stored
BUCKET_NAME = 'rekognition45-london'

# Custom label keywords for UK audience
ABUSIVE_KEYWORDS = [
    'fuck', 'shit', 'cunt', 'fucking', 'asshole', 'whack','ass',
    'bitch', 'slut', 'whore', 't***', 'dickhead', 'pussy', 'retard', 'm*****',
    'idiot', 'stupid', 'moron', 'loser'
]

HATE_SPEECH_KEYWORDS = [
    'nigga', 'p***', 'ch***', 'g**k', 'k***', 'w**back', 'j**',
    'f*****', 'd***', 'tranny', 'h****', 'm****', 't*****', 'sandn*****',
    'k***', 'zionist scum', 'go back to your country', 'illegal immigrant',
    'feminazi', 'misogynist'
]




# Route to serve the index.html file (Frontend)
@app.route('/')
def index():
    return render_template('index.html')


# Route to list all video files in the S3 bucket
@app.route('/list_videos', methods=['GET'])
def list_videos():
    video_files = []
    folders = ['aggressive', 'non_aggressive']

    for folder in folders:
        response = s3.list_objects_v2(Bucket=BUCKET_NAME, Prefix=folder + '/')
        if 'Contents' in response:
            for obj in response['Contents']:
                if obj['Key'].endswith('.mp4'):
                    video_files.append(obj['Key'])

    return jsonify(video_files)


# Route to handle moderation requests
@app.route('/moderate', methods=['POST'])
def moderate_video():
    data = request.get_json()
    video_key = data['video_key']
    video_s3_path = f"{video_key}"

    # Rekognition moderation
    rekognition_results = start_rekognition_moderation(video_s3_path)

    # Transcription job
    transcribe_job_name = f"transcribe-{int(time.time())}"
    try:
        transcribe.start_transcription_job(
            TranscriptionJobName=transcribe_job_name,
            Media={'MediaFileUri': f's3://{BUCKET_NAME}/{video_key}'},
            MediaFormat='mp4',
            LanguageCode='en-US',
            OutputBucketName=BUCKET_NAME,
            OutputKey=f'transcription/{transcribe_job_name}.json'
        )

        # Polling for transcription job completion
        transcription_result = poll_transcription_completion(transcribe_job_name)

        if transcription_result:
            sentiment_analysis_result = perform_sentiment_analysis(transcription_result)
            custom_label_detection = check_custom_labels(transcription_result)
        else:
            sentiment_analysis_result = {"message": "No audio detected or transcription failed"}
            custom_label_detection = {"Abusive": False, "Hate Speech": False}

    except Exception as e:
        print(f"Error starting Transcription job: {e}")
        sentiment_analysis_result = {"message": f"Transcription job failed: {e}"}
        custom_label_detection = {"Abusive": False, "Hate Speech": False}

    return jsonify({
        'rekognition_results': rekognition_results or "No Rekognition results available",
        'sentiment_analysis': sentiment_analysis_result or "No sentiment analysis available",
        'custom_labels': custom_label_detection
    })


def start_rekognition_moderation(video_s3_path):
    try:
        response = rekognition.start_content_moderation(
            Video={'S3Object': {'Bucket': BUCKET_NAME, 'Name': video_s3_path}},
            MinConfidence=70
        )
        job_id = response['JobId']

        # Poll for Rekognition job completion
        while True:
            result = rekognition.get_content_moderation(JobId=job_id)
            if result['JobStatus'] == 'SUCCEEDED':
                return result
            elif result['JobStatus'] == 'FAILED':
                return None
            time.sleep(5)
    except Exception as e:
        print(f"Error during Rekognition: {e}")
        return None


def poll_transcription_completion(transcribe_job_name):
    while True:
        status = transcribe.get_transcription_job(TranscriptionJobName=transcribe_job_name)
        job_status = status['TranscriptionJob']['TranscriptionJobStatus']

        if job_status == 'COMPLETED':
            transcript_uri = status['TranscriptionJob']['Transcript']['TranscriptFileUri']
            transcription_result = s3.get_object(Bucket=BUCKET_NAME, Key=f'transcription/{transcribe_job_name}.json')
            transcript_text = transcription_result['Body'].read().decode('utf-8')
            return transcript_text
        elif job_status == 'FAILED':
            failure_reason = status['TranscriptionJob'].get('FailureReason', 'Unknown failure reason')
            print(f"Transcription job failed: {failure_reason}")
            return None
        time.sleep(5)


def perform_sentiment_analysis(transcription_text):
    try:
        comprehend = boto3.client('comprehend')
        if len(transcription_text) > 5000:
            transcription_text = transcription_text[:5000]

        response = comprehend.detect_sentiment(Text=transcription_text, LanguageCode='en')
        return response
    except Exception as e:
        print(f"Error during sentiment analysis: {e}")
        return {"message": "Sentiment analysis failed"}


def check_custom_labels(transcription_text):
    results = {"Abusive": False, "Hate Speech": False, "Child Abuse": False}

    if any(keyword in transcription_text.lower() for keyword in ABUSIVE_KEYWORDS):
        results["Abusive"] = True

    if any(keyword in transcription_text.lower() for keyword in HATE_SPEECH_KEYWORDS):
        results["Hate Speech"] = True



    return results


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
