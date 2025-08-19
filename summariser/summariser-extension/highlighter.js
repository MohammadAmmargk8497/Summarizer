function highlightKeypoints() {
    const textContent = document.body.innerText;

    fetch('http://localhost:10000/keypoints', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: textContent })
    })
    .then(response => response.json())
    .then(data => {
        if (data.keypoints) {
            data.keypoints.forEach(keypoint => {
                highlight(keypoint);
            });
        }
    })
    .catch(error => {
        console.error('Error highlighting keypoints:', error);
    });
}

function highlight(text) {
    const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let currentNode;
    while (currentNode = treeWalker.nextNode()) {
        const nodeValue = currentNode.nodeValue;
        const index = nodeValue.indexOf(text);
        if (index !== -1) {
            const range = document.createRange();
            range.setStart(currentNode, index);
            range.setEnd(currentNode, index + text.length);
            const highlightSpan = document.createElement('span');
            highlightSpan.className = 'highlight';
            range.surroundContents(highlightSpan);
        }
    }
}

// Run the highlighter after the page has loaded
window.addEventListener('load', highlightKeypoints);
