import os
import re
from loguru import logger
import hydra
from omegaconf import DictConfig, OmegaConf
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
from ratelimit import limits

# Create Flask app
app = Flask(__name__)

# Constants
MAX_TEXT_LENGTH = 10000  # Characters
MIN_TEXT_LENGTH = 50     # Characters
SUMMARY_PROMPT = """
Please provide a concise summary of the following text. 
Focus on key points and main ideas. 
Return only the summary text without any introductory phrases.

Text:
{text}
"""

def sanitize_input(text: str) -> str:
    """Remove excessive whitespace and potentially harmful patterns"""
    cleaned = re.sub(r'\s+', ' ', text).strip()
    return cleaned[:MAX_TEXT_LENGTH]

@app.route("/summarize", methods=["POST"])
@limits(calls=100, period=60)
def summarize():
    """Summarize text endpoint"""
    # Content type check
    if not request.is_json:
        logger.warning("Non-JSON request received")
        return jsonify({"error": "Request must be JSON"}), 415

    # Get and validate text
    data = request.get_json()
    text = data.get("text")
    
    if not text:
        logger.warning("Missing text in request")
        return jsonify({"error": "Missing 'text' field"}), 400
    
    if not isinstance(text, str):
        logger.warning("Non-string text received")
        return jsonify({"error": "'text' must be a string"}), 400
    
    # Sanitize and validate length
    text = sanitize_input(text)
    if len(text) < MIN_TEXT_LENGTH:
        logger.warning(f"Text too short ({len(text)} characters)")
        return jsonify({"error": f"Text must be at least {MIN_TEXT_LENGTH} characters"}), 400

    try:
        # Generate summary
        prompt = SUMMARY_PROMPT.format(text=text)
        response = app.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=app.config['MODEL_TEMPERATURE'],
                max_output_tokens=app.config['MODEL_MAX_TOKENS'],
                top_p=0.95
            ),
            safety_settings={
                'HARASSMENT': 'block_none',
                'HATE_SPEECH': 'block_none',
                'SEXUAL': 'block_none',
                'DANGEROUS': 'block_none'
            }
        )
        
        # Handle empty response
        if not response.text:
            logger.error("Empty response from Gemini API")
            return jsonify({"error": "Summary generation failed"}), 500
        
        logger.info(f"Summarized {len(text)} characters to {len(response.text)} characters")
        return jsonify({"summary": response.text})

    except genai.types.BlockedPromptException as e:
        logger.error(f"Blocked prompt: {str(e)}")
        return jsonify({"error": "Content blocked by safety filters"}), 400
        
    except Exception as e:
        logger.exception("Unexpected error during summarization")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "model": app.config.get('MODEL_NAME')
    })

@hydra.main(version_base=None, config_path="../conf", config_name="config")
def main(cfg: DictConfig) -> None:
    """Main function to run the Flask app"""
    from dotenv import load_dotenv
    load_dotenv()

    # Validate environment configuration
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY environment variable not set")
        exit(1)

    # Configure Gemini API
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as e:
        logger.error(f"Gemini configuration failed: {str(e)}")
        exit(1)

    # Initialize model
    try:
        app.model = genai.GenerativeModel(cfg.model.name)
    except Exception as e:
        logger.error(f"Model initialization failed: {str(e)}")
        exit(1)
    
    app.config['MODEL_NAME'] = cfg.model.name
    app.config['MODEL_TEMPERATURE'] = cfg.model.temperature
    app.config['MODEL_MAX_TOKENS'] = cfg.model.max_tokens

    CORS(app, resources={r"/summarize": {"origins": "*"}})  # Restrict in production
    
    app.run(
        host="0.0.0.0",
        port=10000,
        debug=True
    )

if __name__ == "__main__":
    main()
