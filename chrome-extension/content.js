// Define the endpoint correctly
const endpoint = 'http://localhost:3000/api/connections';

// This function creates and styles a button, then appends it to the page.
function createUploadButton() {
    const button = document.createElement('button');
    button.textContent = 'Upload Connections';
    
    // Simple styling: adjust as needed for your page
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.right = '20px';
    button.style.padding = '10px 15px';
    button.style.backgroundColor = '#0073b1';
    button.style.color = '#fff';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.zIndex = 10000;
  
    // Add click event listener to the button.
    button.addEventListener('click', () => {
      // First scroll to load more connections
      scrollToLoadMoreConnections().then(() => {
        const usernames = extractUsernames();
        if (usernames.length > 0) {
          promptForUsername(usernames);
        } else {
          alert('No LinkedIn profiles found on this page.');
        }
      });
    });
  
    document.body.appendChild(button);
}

// This function scrolls the page to load more connections for 1 minute
function scrollToLoadMoreConnections() {
  return new Promise((resolve) => {
    // Create a loading overlay to indicate scrolling is in progress
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = 10001;

    // Create loading message
    const loadingMessage = document.createElement('div');
    loadingMessage.textContent = 'Loading more connections...';
    loadingMessage.style.color = '#fff';
    loadingMessage.style.fontSize = '18px';
    loadingMessage.style.marginBottom = '15px';

    // Create progress indicator
    const progressContainer = document.createElement('div');
    progressContainer.style.width = '300px';
    progressContainer.style.height = '10px';
    progressContainer.style.backgroundColor = '#ddd';
    progressContainer.style.borderRadius = '5px';
    progressContainer.style.overflow = 'hidden';

    const progressBar = document.createElement('div');
    progressBar.style.width = '0%';
    progressBar.style.height = '100%';
    progressBar.style.backgroundColor = '#0073b1';
    progressBar.style.transition = 'width 0.5s';

    // Create counter text
    const counterText = document.createElement('div');
    counterText.textContent = '0:00';
    counterText.style.color = '#fff';
    counterText.style.marginTop = '10px';
    counterText.style.fontSize = '14px';

    // Create connection counter
    const connectionCounter = document.createElement('div');
    connectionCounter.textContent = 'Connections found: 0';
    connectionCounter.style.color = '#fff';
    connectionCounter.style.marginTop = '10px';
    connectionCounter.style.fontSize = '14px';
    connectionCounter.id = 'scroll-connection-counter';

    // Create early finish button
    const finishButton = document.createElement('button');
    finishButton.textContent = 'Finish Scrolling';
    finishButton.style.marginTop = '20px';
    finishButton.style.padding = '8px 15px';
    finishButton.style.backgroundColor = '#0073b1';
    finishButton.style.color = '#fff';
    finishButton.style.border = 'none';
    finishButton.style.borderRadius = '3px';
    finishButton.style.cursor = 'pointer';
    finishButton.addEventListener('click', () => {
      // Stop scrolling and proceed
      clearTimeout(scrollTimeout);
      document.body.removeChild(overlay);
      resolve();
    });

    // Assemble overlay
    progressContainer.appendChild(progressBar);
    overlay.appendChild(loadingMessage);
    overlay.appendChild(progressContainer);
    overlay.appendChild(counterText);
    overlay.appendChild(connectionCounter);
    overlay.appendChild(finishButton);
    document.body.appendChild(overlay);

    // Set the duration for scrolling (reduced to 30 seconds = 30000ms for faster operation)
    const scrollDuration = 30000;
    const startTime = Date.now();
    let lastConnectionCount = 0;
    let noNewConnectionsCount = 0;
    let scrollTimeout;
    
    // Function to find the main scrollable container on LinkedIn
    const findScrollableContainer = () => {
      // Try different possible containers that might be used by LinkedIn
      // These selectors might need to be updated if LinkedIn changes their DOM structure
      const possibleContainers = [
        document.querySelector('.scaffold-finite-scroll__content'),
        document.querySelector('.artdeco-list'),
        document.querySelector('.mn-connections'),
        document.querySelector('.scaffold-layout__content'),
        document.querySelector('main'),
        document.querySelector('.authentication-outlet'),
        // Fallback to window if no specific container is found
        window
      ];
      
      return possibleContainers.find(container => container !== null) || window;
    };
    
    // Get the scrollable container
    const scrollContainer = findScrollableContainer();
    
    // Function to perform the scroll - increased scroll distance for faster loading
    const performScroll = () => {
      if (scrollContainer === window) {
        // If we're scrolling the window, use a larger scroll increment
        window.scrollBy(0, 1000);
      } else {
        // If we're scrolling a specific element, use a larger scroll increment
        scrollContainer.scrollTop += 1000;
      }
    };
    
    // Function to count current connections
    const countConnections = () => {
      return document.querySelectorAll('a[href*="linkedin.com/in/"]').length;
    };

    // Function to click all "Show more" buttons
    const clickShowMoreButtons = () => {
      const showMoreButtons = Array.from(document.querySelectorAll('button')).filter(
        button => button.textContent && 
        (button.textContent.toLowerCase().includes('show more') || 
         button.textContent.toLowerCase().includes('see more') ||
         button.textContent.toLowerCase().includes('load more'))
      );
      
      if (showMoreButtons.length > 0) {
        showMoreButtons.forEach(button => button.click());
        return true;
      }
      return false;
    };

    // Click any initial "Show more" buttons before starting the scroll
    clickShowMoreButtons();

    // Function to scroll and update progress
    const scrollAndUpdate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / scrollDuration * 100, 100);
      
      // Update progress bar
      progressBar.style.width = `${progress}%`;
      
      // Update counter text (mm:ss format)
      const seconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      counterText.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;

      // Perform multiple scrolls per cycle for faster loading
      for (let i = 0; i < 3; i++) {
        performScroll();
      }
      
      // Count connections and update counter
      const currentConnectionCount = countConnections();
      document.getElementById('scroll-connection-counter').textContent = `Connections found: ${currentConnectionCount}`;
      
      // Check if we're still finding new connections
      if (currentConnectionCount === lastConnectionCount) {
        noNewConnectionsCount++;
        
        // If no new connections after several attempts, try different scroll techniques
        if (noNewConnectionsCount > 3) {
          // Try clicking "Show more" buttons if they exist
          const clickedButtons = clickShowMoreButtons();
          
          // Try a bigger scroll jump
          if (scrollContainer === window) {
            window.scrollBy(0, 2000);
          } else {
            scrollContainer.scrollTop += 2000;
          }
          
          // If we clicked buttons or made a big jump, reset the counter
          if (clickedButtons) {
            noNewConnectionsCount = 0;
          }
        }
      } else {
        // Reset counter if new connections were found
        noNewConnectionsCount = 0;
        lastConnectionCount = currentConnectionCount;
      }

      // If we haven't found new connections for a while and have a decent number, we can finish early
      if (noNewConnectionsCount > 5 && currentConnectionCount > 50) {
        loadingMessage.textContent = 'Found enough connections, finishing...';
        setTimeout(() => {
          document.body.removeChild(overlay);
          resolve();
        }, 1000);
        return;
      }

      // Continue scrolling if time hasn't elapsed
      if (elapsed < scrollDuration) {
        scrollTimeout = setTimeout(scrollAndUpdate, 200); // Scroll more frequently (200ms instead of 500ms)
      } else {
        // Remove overlay and resolve the promise when done
        document.body.removeChild(overlay);
        resolve();
      }
    };

    // Start scrolling
    scrollAndUpdate();
  });
}

// This function creates a modal dialog to prompt for the user's LinkedIn username
function promptForUsername(usernames) {
  // Create modal container
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = 10001;

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.backgroundColor = '#fff';
  modalContent.style.padding = '20px';
  modalContent.style.borderRadius = '5px';
  modalContent.style.width = '300px';
  modalContent.style.maxWidth = '80%';

  // Create title
  const title = document.createElement('h3');
  title.textContent = 'Enter Your LinkedIn Username';
  title.style.marginTop = '0';

  // Create description
  const description = document.createElement('p');
  description.textContent = 'Please enter your LinkedIn username (the part that appears after "linkedin.com/in/" in your profile URL).';
  description.style.fontSize = '14px';

  // Create input field
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'your-linkedin-username';
  input.style.width = '100%';
  input.style.padding = '8px';
  input.style.marginBottom = '15px';
  input.style.boxSizing = 'border-box';
  input.style.border = '1px solid #ccc';
  input.style.borderRadius = '3px';

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.justifyContent = 'space-between';

  // Create submit button
  const submitButton = document.createElement('button');
  submitButton.textContent = 'Upload';
  submitButton.style.padding = '8px 15px';
  submitButton.style.backgroundColor = '#0073b1';
  submitButton.style.color = '#fff';
  submitButton.style.border = 'none';
  submitButton.style.borderRadius = '3px';
  submitButton.style.cursor = 'pointer';

  // Create cancel button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.padding = '8px 15px';
  cancelButton.style.backgroundColor = '#f2f2f2';
  cancelButton.style.color = '#333';
  cancelButton.style.border = 'none';
  cancelButton.style.borderRadius = '3px';
  cancelButton.style.cursor = 'pointer';

  // Add event listeners
  submitButton.addEventListener('click', () => {
    const username = input.value.trim();
    if (username) {
      // Show loading state instead of removing the modal
      showLoadingState(modal, modalContent);
      uploadUsernames(usernames, username, modal);
    } else {
      alert('Please enter your LinkedIn username.');
    }
  });

  cancelButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  // Add keydown event listener for Enter key
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      submitButton.click();
    }
  });

  // Assemble modal
  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(submitButton);
  modalContent.appendChild(title);
  modalContent.appendChild(description);
  modalContent.appendChild(input);
  modalContent.appendChild(buttonContainer);
  modal.appendChild(modalContent);

  // Add modal to page
  document.body.appendChild(modal);
  
  // Focus the input field
  setTimeout(() => input.focus(), 100);
}

// Function to show loading state in the modal
function showLoadingState(modal, modalContent) {
  // Clear the modal content
  modalContent.innerHTML = '';
  
  // Create loading title
  const loadingTitle = document.createElement('h3');
  loadingTitle.textContent = 'Processing Connections';
  loadingTitle.style.marginTop = '0';
  loadingTitle.style.textAlign = 'center';
  
  // Create loading message
  const loadingMessage = document.createElement('p');
  loadingMessage.textContent = 'Please wait while we process your connections. This may take a few minutes.';
  loadingMessage.style.fontSize = '14px';
  loadingMessage.style.textAlign = 'center';
  
  // Create spinner
  const spinner = document.createElement('div');
  spinner.style.width = '40px';
  spinner.style.height = '40px';
  spinner.style.margin = '20px auto';
  spinner.style.border = '4px solid #f3f3f3';
  spinner.style.borderTop = '4px solid #0073b1';
  spinner.style.borderRadius = '50%';
  spinner.style.animation = 'spin 1s linear infinite';
  
  // Add keyframes for spinner animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  // Create connection counter
  const counter = document.createElement('p');
  counter.textContent = `Processing ${0} connections...`;
  counter.style.textAlign = 'center';
  counter.style.fontSize = '14px';
  counter.id = 'connection-counter';
  
  // Assemble loading content
  modalContent.appendChild(loadingTitle);
  modalContent.appendChild(loadingMessage);
  modalContent.appendChild(spinner);
  modalContent.appendChild(counter);
}

// This function searches the page for anchor tags with LinkedIn profile URLs,
// extracts the username (the part after "/in/") and returns an array of usernames.
function extractUsernames() {
  const anchors = document.querySelectorAll('a[href*="linkedin.com/in/"]');
  const usernames = new Set(); // use a Set to avoid duplicates

  anchors.forEach(anchor => {
    const href = anchor.getAttribute('href');
    // Use a regex to capture the username between "/in/" and the following "/" (or end of string)
    const match = href.match(/linkedin\.com\/in\/([^\/?]+)/);
    if (match && match[1]) {
      usernames.add(match[1]);
    }
  });

  return Array.from(usernames);
}

// This function uploads the list of usernames with a POST request.
function uploadUsernames(usernames, uploaderUsername, modal) {
  console.log('Beginning upload of usernames:', usernames);
  
  // Update the counter with the total number of connections
  const counter = document.getElementById('connection-counter');
  if (counter) {
    counter.textContent = `Processing ${usernames.length} connections...`;
  }
  
  fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ usernames, uploader: uploaderUsername })
  })
    .then(response => {
      console.log("Received HTTP status:", response.status);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log('Upload success, response from server:', data);
      // Now remove the modal
      if (modal && document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
      alert("Connections uploaded successfully!");
      // Open dashboard in a new tab instead of redirecting the current tab
      window.open("http://localhost:3000/?uploaded=true", "_blank");
    })
    .catch(error => {
      console.error('Upload failed with error:', error);
      // Now remove the modal
      if (modal && document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
      alert("Failed to upload connections.");
    });
}

// Wait for the page to fully load (or adjust timing as needed for a dynamically loaded page)
window.addEventListener('load', () => {
  createUploadButton();
});