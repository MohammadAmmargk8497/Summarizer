import os
import re
import json
from loguru import logger
import hydra
from omegaconf import DictConfig, OmegaConf
from flask import Flask, request, jsonify
from flask_cors import CORS
from ratelimit import limits
from langchain.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import LLMChain
from langchain.output_parsers import ResponseSchema, StructuredOutputParser
from langchain_core.exceptions import OutputParserException
from dotenv import load_dotenv
load_dotenv()
# Create Flask app
app = Flask(__name__)

# Constants
MAX_TEXT_LENGTH = 20000  # Characters
MIN_TEXT_LENGTH = 50     # Characters

# Define output schemas
summary_schema = ResponseSchema(
    name="summary",
    description="Concise summary of the text focusing on key points and main ideas"
)
keypoints_schema = ResponseSchema(
    name="keypoints",
    description="List of key sentences that capture main points",
    type="list[string]"
)

# Create output parsers
summary_parser = StructuredOutputParser.from_response_schemas([summary_schema])
keypoints_parser = StructuredOutputParser.from_response_schemas([keypoints_schema])

# Get format instructions
summary_format_instructions = summary_parser.get_format_instructions()
keypoints_format_instructions = keypoints_parser.get_format_instructions()

# Define prompts
SUMMARY_PROMPT = """
Please provide a summary of the following text. 
Focus on key points and main ideas. 
Return only the summary text without any introductory phrases.

Text:
{text}

{format_instructions}
"""

KEYPOINTS_PROMPT = """
From the following text, extract the key sentences that capture the main points. 
Return the keypoints as a JSON object with a single key "keypoints" which is a list of strings.
If no keypoints are found, return an empty list.

Text:
{text}

{format_instructions}
"""

def sanitize_input(text: str) -> str:
    """Remove excessive whitespace and truncate long text"""
    cleaned = re.sub(r'\s+', ' ', text).strip()
    return cleaned[:MAX_TEXT_LENGTH]

def create_llm_chain(prompt_template, output_parser, model_name, temperature, max_tokens):
    """Create LLM chain with safety settings"""
    prompt = PromptTemplate(
        template=prompt_template,
        input_variables=["text"],
        partial_variables={"format_instructions": output_parser.get_format_instructions()}
    )
    
    llm = ChatGoogleGenerativeAI(
        model=model_name,
        temperature=temperature,
        max_output_tokens=max_tokens
        
        
    )
    
    return LLMChain(
        llm=llm,
        prompt=prompt,
        output_parser=output_parser
    )

@app.route("/summarize", methods=["POST"])
@limits(calls=100, period=60)
def summarize():
    """Summarize text endpoint"""
    if not request.is_json:
        logger.warning("Non-JSON request received")
        return jsonify({"error": "Request must be JSON"}), 415

    data = request.get_json()
    text = data.get("text")
    
    if not text:
        return jsonify({"error": "Missing 'text' field"}), 400
    
    if not isinstance(text, str):
        return jsonify({"error": "'text' must be a string"}), 400
    
    text = sanitize_input(text)
    if len(text) < MIN_TEXT_LENGTH:
        return jsonify({"error": f"Text must be at least {MIN_TEXT_LENGTH} characters"}), 400

    try:
        result = app.summary_chain.run(text=text)
        return jsonify({"summary": result["summary"]})
    except Exception as e:
        logger.exception("Summarization error")
        return jsonify({"error": "Processing failed"}), 500

@app.route("/keypoints", methods=["POST"])
@limits(calls=100, period=60)
def keypoints():
    """Extract keypoints from text endpoint"""
    if not request.is_json:
        logger.warning("Non-JSON request received")
        return jsonify({"error": "Request must be JSON"}), 415

    data = request.get_json()
    text = data.get("text")

    if not text:
        return jsonify({"error": "Missing 'text' field"}), 400

    if not isinstance(text, str):
        return jsonify({"error": "'text' must be a string"}), 400

    text = sanitize_input(text)
    if len(text) < MIN_TEXT_LENGTH:
        return jsonify({"error": f"Text must be at least {MIN_TEXT_LENGTH} characters"}), 400

    try:
        result = app.keypoints_chain.run(text=text)
        return jsonify({"keypoints": result["keypoints"]})
    except OutputParserException as e:
        logger.error(f"Failed to parse LLM output: {e}")
        return jsonify({"error": "Failed to process output from the language model."}), 500
    except Exception as e:
        logger.exception("Keypoints extraction error")
        return jsonify({"error": "Processing failed"}), 500

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
    
    # Load environment variables
    if not os.getenv("GEMINI_API_KEY"):
        logger.error("GEMINI_API_KEY environment variable not set")
        exit(1)

    # Initialize chains
    try:
        app.config['MODEL_NAME'] = cfg.model.name
        app.config['MODEL_TEMPERATURE'] = cfg.model.temperature
        app.config['MODEL_MAX_TOKENS'] = cfg.model.max_tokens
        
        app.summary_chain = create_llm_chain(
            SUMMARY_PROMPT,
            summary_parser,
            cfg.model.name,
            cfg.model.temperature,
            cfg.model.max_tokens
        )
        
        app.keypoints_chain = create_llm_chain(
            KEYPOINTS_PROMPT,
            keypoints_parser,
            cfg.model.name,
            cfg.model.temperature,
            cfg.model.max_tokens
        )
        
        logger.info(f"Initialized model: {cfg.model.name}")
        logger.info(f"Temperature: {cfg.model.temperature}")
        logger.info(f"Max tokens: {cfg.model.max_tokens}")
        
    except Exception as e:
        logger.error(f"Initialization failed: {str(e)}")
        exit(1)

    CORS(app, resources={r"/summarize": {"origins": "*"}, r"/keypoints": {"origins": "*"}})
    
    app.run(
        host="0.0.0.0",
        port=10000,
        debug=True
    )

if __name__ == "__main__":
    main()