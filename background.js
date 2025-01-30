chrome.commands.onCommand.addListener((command) => {
  // Get the currently active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const activeTab = tabs[0];
      // Send the command to the content script in the active tab
      chrome.tabs.sendMessage(activeTab.id, { command });
    }
  });
});