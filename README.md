# Text Summarizer

Have you ever felt that after reading a 1000 word blog midway you find that this is not what you are looking for exactly? Or you just want to get a crux of the article before you start to invest your time reading it? This project is a text summarization/keypoint extraction tool that uses a Python backend powered by Google's Gemini Flash to generate summaries and key points from text. It also includes a Chrome extension that allows you to summarize web pages or selected text directly in your browser.
<img width="1280" height="993" alt="image" src="https://github.com/user-attachments/assets/de9cedfe-f61c-45d3-8b57-b50c17b3d755" />

## Features

- **Backend API:** A Flask-based API that provides endpoints for text summarization and key point extraction.
- **Chrome Extension:** A simple and easy-to-use browser extension to interact with the backend.
- **Configurable:** The backend can be configured using a YAML file, allowing you to change the model, temperature, and other parameters.
- **Rate Limiting:** The API has rate limiting to prevent abuse.

## Project Structure

```
Summariser/
├── conf/
│   └── config.yaml
├── summariser/
│   ├── __main__.py
│   └── summariser-extension/
│       ├── manifest.json
│       ├── popup.html
│       ├── popup.js
│       └── ...
├── pyproject.toml
└── README.md
```

- `conf/config.yaml`: Configuration file for the backend.
- `summariser/__main__.py`: The main entry point for the Flask backend.
- `summariser/summariser-extension/`: The Chrome extension source code.
- `pyproject.toml`: Python project dependencies.

## Installation

### Backend

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/MohammadAmmargk8497/Summarizer.git
    cd Summariser
    ```

2.  **Install dependencies:**
    Make sure you have [Poetry](https://python-poetry.org/) installed.
    ```bash
    poetry install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add your Gemini API key:
    ```
    GEMINI_API_KEY="your-gemeni-api-key"
    GOOGLE_API_KEY="your-gemeni-api-key"
    ```

4.  **Run the backend:**
    ```bash
    poetry run python summariser
    ```
    The backend will be running at `http://localhost:10000`.

### Chrome Extension

1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Enable "Developer mode" in the top right corner.
3.  Click on "Load unpacked".
4.  Select the `summariser/summariser-extension` directory from the project.

## Usage

### API

You can use the API directly to get summaries and key points.

-   **Summarize:**
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{"text": "Your text here..."}' http://localhost:10000/summarize
    ```

-   **Key Points:**
    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{"text": "Your text here..."}' http://localhost:10000/keypoints
    ```

### Chrome Extension

1.  Navigate to any web page.
2.  Click on the Summarizer extension icon in your browser toolbar.
3.  Click "Summarize Current Page" to summarize the entire page, or select some text and click "Summarize Selected Text".
4.  The summary will appear in the extension popup.

## Configuration

You can configure the backend by editing the `conf/config.yaml` file.

-   `model.name`: The name of the Gemini model to use (e.g., `gemini-pro`).
-   `model.temperature`: The temperature for the model's output.
-   `model.max_tokens`: The maximum number of tokens in the output.

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.
