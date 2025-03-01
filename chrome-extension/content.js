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
      const usernames = extractUsernames();
      if (usernames.length > 0) {
        uploadUsernames(usernames);
      } else {
        alert('No LinkedIn profiles found on this page.');
      }
    });
  
    document.body.appendChild(button);
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
  function uploadUsernames(usernames) {
    console.log('Beginning upload of usernames:', usernames);
    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ usernames, uploader: "ben-levy365" })
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
        alert("Connections uploaded successfully!");
        // Redirect back to the dashboard
        window.location.href = "http://localhost:3000/?uploaded=true";
      })
      .catch(error => {
        console.error('Upload failed with error:', error);
        alert("Failed to upload connections.");
      });
  }
  
  // Wait for the page to fully load (or adjust timing as needed for a dynamically loaded page)
  window.addEventListener('load', () => {
    createUploadButton();
  });