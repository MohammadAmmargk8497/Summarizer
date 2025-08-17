// Extract main content from page
function extractPageText() {
  // Simple content extraction - could be enhanced with Readability.js
  const mainContent = document.querySelector('article, main, .article, .content') || document.body;
  return mainContent.innerText;
}

// Return the extracted text
extractPageText();