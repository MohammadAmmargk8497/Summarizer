document.addEventListener('DOMContentLoaded', () => {
  const summarizePageBtn = document.getElementById('summarizePage');
  const summarizeSelectionBtn = document.getElementById('summarizeSelection');
  const resultDiv = document.getElementById('result');
  const loader = document.getElementById('loader');
  const resultCard = document.getElementById('result-card');
  const copyBtn = document.getElementById('copyBtn');
  const tabs = document.querySelectorAll('.tab');
  const languageSelect = document.getElementById('language');
  const lengthSlider = document.getElementById('length');
  const toast = document.getElementById('toast');

  // Set active tab and update UI
  let activeTab = 'summarize';
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      updateButtonText();
    });
  });

  // Update length value text
  lengthSlider.addEventListener('input', () => {
    const values = ['Very Short', 'Short', 'Medium', 'Long', 'Very Long'];
    document.getElementById('lengthValue').textContent = values[lengthSlider.value - 1];
  });

  // Update button text based on active tab
  function updateButtonText() {
    const pageIcon = activeTab === 'summarize' ? '📄' : activeTab === 'keypoints' ? '🔑' : '•';
    const selectionIcon = activeTab === 'summarize' ? '🔍' : activeTab === 'keypoints' ? '🔍' : '🔍';
    const pageText = activeTab === 'summarize' ? 'Summarize Page' : 
                     activeTab === 'keypoints' ? 'Extract Key Points' : 'Generate Bullet Points';
    const selectionText = activeTab === 'summarize' ? 'Summarize Selection' : 
                          activeTab === 'keypoints' ? 'Extract from Selection' : 'Bulletize Selection';
    
    summarizePageBtn.innerHTML = `<span class="btn-icon">${pageIcon}</span> ${pageText}`;
    summarizeSelectionBtn.innerHTML = `<span class="btn-icon">${selectionIcon}</span> ${selectionText}`;
  }

  // Initialize button text
  updateButtonText();

  // Summarize the entire page
  summarizePageBtn.addEventListener('click', async () => {
    const actionType = getActionType();
    const title = getActionTitle();
    await handleAction(getPageText, actionType, title);
  });

  // Summarize selected text
  summarizeSelectionBtn.addEventListener('click', async () => {
    const actionType = getActionType();
    const title = getActionTitle();
    await handleAction(getSelectedText, actionType, title);
  });

  // Get action type based on active tab
  function getActionType() {
    switch(activeTab) {
      case 'keypoints': return 'keypoints';
      case 'bullet': return 'bullet';
      default: return 'summarize';
    }
  }

  // Get action title based on active tab
  function getActionTitle() {
    switch(activeTab) {
      case 'keypoints': return 'Key Points';
      case 'bullet': return 'Bullet Points';
      default: return 'Summary';
    }
  }

  // Copy to clipboard
  copyBtn.addEventListener('click', () => {
    const textToCopy = resultDiv.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
      // Show toast notification
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 2000);
    });
  });

  async function handleAction(getTextFunc, actionType, title) {
    try {
      showLoading(true);
      resultCard.style.display = 'block';
      resultDiv.innerHTML = '<div class="empty-state">Processing your request...</div>';

      const text = await getTextFunc();
      if (!text || text.trim() === '') {
        throw new Error('No text found or selected. Please select some text or try a different page.');
      }

      const result = await processText(text, actionType);
      
      resultDiv.innerHTML = `<h2>${title}</h2>`;
      if (Array.isArray(result)) {
        resultDiv.innerHTML += `<ul>${result.map(item => `<li>${item}</li>`).join('')}</ul>`;
        
        // Add click events to list items
        const listItems = resultDiv.querySelectorAll('li');
        listItems.forEach(item => {
          item.addEventListener('click', () => {
            // Toggle highlight on click
            item.classList.toggle('highlighted');
            // Copy text to clipboard on double click
            let clickTimer;
            item.addEventListener('dblclick', () => {
              navigator.clipboard.writeText(item.textContent).then(() => {
                toast.textContent = 'Copied to clipboard!';
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 2000);
              });
            });
          });
        });
      } else {
        resultDiv.innerHTML += `<p>${result}</p>`;
      }

    } catch (error) {
      resultDiv.innerHTML = `<h2>Error</h2><p>${error.message}</p>`;
    } finally {
      showLoading(false);
    }
  }

  async function getPageText() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      return results[0].result;
    } catch (error) {
      console.error('Error getting page text:', error);
      throw new Error('Could not extract text from page. Please try again.');
    }
  }

  async function getSelectedText() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString()
      });
      return results[0].result;
    } catch (error) {
      console.error('Error getting selected text:', error);
      throw new Error('Could not get selected text. Please make sure you have selected some text.');
    }
  }

  async function processText(text, actionType) {
    // Get options from UI
    const language = languageSelect.value;
    const length = parseInt(lengthSlider.value);
    
    // Call the appropriate API based on action type
    let result;
    if (actionType === 'summarize') {
      result = await summarizeText(text, language, length);
    } else if (actionType === 'keypoints') {
      result = await getKeypoints(text, language, length);
    } else {
      result = await getBulletPoints(text, language, length);
    }
    
    return result;
  }

  async function summarizeText(text, language, length) {
    const result = await fetchFromAPI('summarize', text, language, length);
    return result.summary || result;
  }

  async function getKeypoints(text, language, length) {
    const result = await fetchFromAPI('keypoints', text, language, length);
    return result.keypoints || result;
  }

  async function getBulletPoints(text, language, length) {
    const result = await fetchFromAPI('bullet', text, language, length);
    return result.bulletPoints || result;
  }

  async function fetchFromAPI(endpoint, text, language, length) {
    try {
      const response = await fetch(`http://localhost:10000/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          text,
          language,
          length 
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to fetch from ${endpoint}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      
      // Fallback to simulated response if API is not available
      return simulateAPIResponse(endpoint, text, length);
    }
  }

  // Simulate API response for demo purposes
  function simulateAPIResponse(endpoint, text, length) {
    // Simulate network delay
    return new Promise(resolve => {
      setTimeout(() => {
        if (endpoint === 'summarize') {
          resolve({
            summary: `This is a simulated summary of the text. The length setting is ${length}/5.\n\n${text.substring(0, 150)}...`
          });
        } else if (endpoint === 'keypoints') {
          resolve({
            keypoints: [
              'Simulated key point 1 about the content',
              'Simulated key point 2 demonstrating extraction',
              'Simulated key point 3 showing different aspects',
              'Simulated key point 4 based on content analysis'
            ]
          });
        } else {
          resolve({
            bulletPoints: [
              'First simulated bullet point summary',
              'Second point with details based on content',
              'Third important aspect highlighted',
              'Additional information extracted from text'
            ]
          });
        }
      }, 1000);
    });
  }

  function showLoading(show) {
    loader.style.display = show ? 'block' : 'none';
  }

  // Settings link handler
  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    // In a real extension, this would open the options page
    alert('Settings page would open here. In a real extension, you would use chrome.runtime.openOptionsPage();');
  });
});