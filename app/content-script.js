function __focusConfirmLeave() {
  if (confirm('You are working now, please leave aways from these distracting sites.')) {
    chrome.runtime.sendMessage({type: 'close_current_tab'});
  } else {
    chrome.storage.local.get('dismissed_urls', function(data) {
      var dismissedUrls = data.dismissed_urls || {};
      dismissedUrls[location.host] = true;
      chrome.storage.local.set({
        'dismissed_urls': dismissedUrls
      });
    });
  }
}

if (document.readyState == "complete" || document.readyState == "loaded") {
  __focusConfirmLeave();
} else {
  window.addEventListener('load', __focusConfirmLeave, false);
}