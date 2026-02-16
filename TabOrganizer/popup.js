
chrome.storage.local.get(['autoCollapse', 'tabMove', 'nightMode'], (data) => {
  const collTgl = document.getElementById('collapseTgl');
  const moveTgl = document.getElementById('moveTgl');
  const nightTgl = document.getElementById('nightTgl');

  if (collTgl) collTgl.checked = data.autoCollapse !== false;
  if (moveTgl) moveTgl.checked = data.tabMove !== false;
  
  if (nightTgl) {
    nightTgl.checked = data.nightMode === true;
    if (data.nightMode) document.body.classList.add('dark');
  }
});

chrome.tabs.query({ currentWindow: true }, (tabs) => {
  const countEl = document.getElementById('tabCount');
  if (countEl) countEl.textContent = tabs.length;
});

async function loadGroups() {
  const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  const container = document.getElementById('groupList');
  if (!container) return;
  container.innerHTML = ''; 

  if (groups.length === 0) {
    container.innerHTML = '<div style="font-size: 10px; color: #999;">No active groups</div>';
    return;
  }

  groups.forEach(group => {
    const div = document.createElement('div');
    div.style.cssText = "display: flex; align-items: center; margin-bottom: 4px; font-size: 11px;";
    div.innerHTML = `
      <input type="checkbox" id="group-${group.id}" value="${group.id}" style="margin-right: 8px;">
      <label for="group-${group.id}" style="color: ${group.color}; font-weight: bold;">${group.title || 'Untitled'}</label>
    `;
    container.appendChild(div);
  });
}
loadGroups();

document.addEventListener('change', (e) => {
  const ids = ['collapseTgl', 'moveTgl', 'nightTgl'];
  if (ids.includes(e.target.id)) {
    const nightOn = document.getElementById('nightTgl')?.checked;
    if (nightOn) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }

    chrome.storage.local.set({ 
      autoCollapse: document.getElementById('collapseTgl')?.checked, 
      tabMove: document.getElementById('moveTgl')?.checked,
      nightMode: nightOn
    });
  }
});

document.getElementById('quickDiscardBtn')?.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true, active: false });
  let count = 0;
  for (const tab of tabs) {
    if (!tab.url.startsWith('chrome://') && !tab.discarded) {
      try {
        await chrome.tabs.discard(tab.id);
        count++;
      } catch (e) { console.log("Skip tab:", tab.id); }
    }
  }
  showStatus(`Froze ${count} background tabs!`);
});

document.getElementById('discardBtn')?.addEventListener('click', async () => {
  const checkboxes = document.querySelectorAll('#groupList input:checked');
  const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
  if (selectedIds.length === 0) return showStatus("Select a group!");

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (selectedIds.includes(activeTab?.groupId)) {
    return showStatus("Cannot freeze your current group!");
  }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  let count = 0;
  for (const tab of tabs) {
    if (selectedIds.includes(tab.groupId) && !tab.active && !tab.url.startsWith('chrome://')) {
      try {
        await chrome.tabs.discard(tab.id);
        count++;
      } catch (e) { console.log("Skip tab:", tab.id); }
    }
  }
  showStatus(`Cleaned memory for ${count} tabs!`);
});

document.getElementById('cleanupBtn')?.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  let count = 0;
  for (const tab of tabs) {
    if (tab.url === "chrome://newtab/" || tab.title === "New Tab" || tab.url === "about:blank") {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      if (allTabs.length > 1) {
        await chrome.tabs.remove(tab.id);
        count++;
      }
    }
  }
  showStatus(`Closed ${count} empty tabs.`);
  const finalTabs = await chrome.tabs.query({ currentWindow: true });
  const countEl = document.getElementById('tabCount');
  if (countEl) countEl.textContent = finalTabs.length;
});

function showStatus(text) {
  const msg = document.getElementById('statusMsg');
  if (msg) {
    msg.textContent = text;
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 2500);
  }
}

chrome.tabs.onCreated.addListener((tab) => {
  chrome.storage.local.get(['autoCleanup'], (data) => {
    if (data.autoCleanup) {
      setTimeout(() => {
        chrome.tabs.get(tab.id, (currentTab) => {
          if (currentTab.url === "chrome://newtab/" || currentTab.title === "New Tab") {
            chrome.tabs.remove(tab.id);
          }
        });
      }, 100); 
    }
  });
});