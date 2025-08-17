document.addEventListener('DOMContentLoaded', () => {
  const summarizePageBtn = document.getElementById('summarizePage');
  const summarizeSelectionBtn = document.getElementById('summarizeSelection');
  const resultDiv = document.getElementById('result');
  const loader = document.getElementById('loader');

  // Summarize the entire page
  summarizePageBtn.addEventListener('click', async () => {
    try {
      showLoading(true);
      resultDiv.textContent = '';
      
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Execute content script to get page text
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Get the extracted text
      const pageText = results[0].result;
      
      // Send to summarization API
      const summary = await summarizeText(pageText);
      
      resultDiv.textContent = summary;
    } catch (error) {
      resultDiv.textContent = `Error: ${error.message}`;
    } finally {
      showLoading(false);
    }
  });

  // Summarize selected text
  summarizeSelectionBtn.addEventListener('click', async () => {
    try {
      showLoading(true);
      resultDiv.textContent = '';
      
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Get selected text
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString()
      });
      
      const selectedText = results[0].result;
      
      if (!selectedText || selectedText.trim() === '') {
        throw new Error('No text selected. Please select some text to summarize.');
      }
      
      // Send to summarization API
      const summary = await summarizeText(selectedText);
      
      resultDiv.textContent = summary;
    } catch (error) {
      resultDiv.textContent = `Error: ${error.message}`;
    } finally {
      showLoading(false);
    }
  });

  // Send text to summarization API
  async function summarizeText(text) {
    const response = await fetch('http://localhost:10000/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to summarize text');
    }
    
    const data = await response.json();
    return data.summary;
  }

  function showLoading(show) {
    loader.style.display = show ? 'block' : 'none';
  }
});