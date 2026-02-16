
const originalConsoleError = console.error;
console.error = (...args) => {
    if (args[0]?.includes?.("uncontrollable") || args[0]?.includes?.("editing")) return;
    originalConsoleError(...args);
};

const CATEGORIES = {
  "School": { 
    domains: ["canvas.instructure.com", "classroom.google.com", "docs.google.com", "drive.google.com", "education.nsw.gov.au", "quizlet.com", "sentral.com.au", "slides.google.com", "student.det.nsw.edu.au"], 
    color: "cyan" 
  },
  "Learning": { 
    domains: ["atomi.com", "behindthenews.com.au", "britannica.com", "duolingo.com", "khanacademy.org", "mathletics.com", "prodigygame.com", "stileeducation.com", "ted.com", "wikipedia.org"], 
    color: "blue" 
  },
  "Coding": { 
    domains: ["codepen.io", "developer.chrome.com", "edstem.org", "github.com", "groklearning.com", "javascript.com", "python.org", "replit.com", "scratch.mit.edu", "stackoverflow.com", "unity.com", "w3schools.com"], 
    color: "green" 
  },
  "Tools": { 
    domains: ["canva.com", "chatgpt.com", "figma.com", "gemini.google.com", "icloud.com", "notion.so", "openai.com", "photopea.com", "remove.bg"], 
    color: "grey" 
  },
  "Social": { 
    domains: ["bereal.com", "discord.com", "facebook.com", "instagram.com", "messenger.com", "pinterest.com", "reddit.com", "snapchat.com", "threads.net", "tiktok.com", "x.com"], 
    color: "pink" 
  },
  "Gaming": { 
    domains: ["chess.com", "coolmathgames.com", "crazygames.com", "curseforge.com", "epicgames.com", "fortnite.com", "minecraft.net", "nintendo.com.au", "playstation.com", "poki.com", "roblox.com", "steampowered.com", "xbox.com"], 
    color: "orange" 
  },
  "Entertainment": { 
    domains: ["7plus.com.au", "9now.com.au", "abc.net.au/iview", "binge.com.au", "crunchyroll.com", "disneyplus.com", "imdb.com", "netflix.com", "soundcloud.com", "spotify.com", "stan.com.au", "twitch.tv", "webtoons.com", "youtube.com"], 
    color: "red" 
  },
  "Shopping": { 
    domains: ["amazon.com.au", "ebay.com.au", "jbhifi.com.au", "kmart.com.au", "officeworks.com.au", "target.com.au"], 
    color: "yellow" 
  },
  "News": { 
    domains: ["abc.net.au", "kidsnews.com.au", "news.com.au", "smh.com.au", "theguardian.com/au", "7news.com.au", "9news.com.au"], 
    color: "purple" 
  }
};

let groupExitTimes = {};

async function safeMoveGroup(groupId) {
    if (!groupId || groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) return;
    try {
        
        await chrome.tabGroups.move(groupId, { index: -1 });
        await chrome.tabGroups.update(groupId, { collapsed: false });
    } catch (e) {
    
    if (e.message && e.message.includes("editing")) {
        setTimeout(() => safeMoveGroup(groupId).catch(() => {}), 150);
    }
}
}

async function organizeAndMove() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeTab = tabs.find(t => t.active);
    if (!activeTab) return;

    const existingGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    let assignedTabIds = new Set();

    for (const [name, data] of Object.entries(CATEGORIES)) {
      const ids = tabs.filter(t => t.url && data.domains.some(d => t.url.includes(d))).map(t => t.id);
      if (ids.length > 0) {
        let group = existingGroups.find(g => g.title === name);
        let groupId = await chrome.tabs.group({ tabIds: ids, groupId: group?.id });
        await chrome.tabGroups.update(groupId, { title: name, color: data.color });
        ids.forEach(id => assignedTabIds.add(id));
      }
    }

    const otherTabs = tabs.filter(t => {
      const isAssigned = assignedTabIds.has(t.id);
      const isPinned = t.pinned;
      const isInternal = !t.url || t.url.startsWith("chrome://") || t.url === "about:blank";
      return !isAssigned && !isPinned && !isInternal;
    });

    if (otherTabs.length > 0) {
      const otherIds = otherTabs.map(t => t.id);
      let otherGroup = existingGroups.find(g => g.title === "Other");
      let otherGroupId = await chrome.tabs.group({ tabIds: otherIds, groupId: otherGroup?.id });
      await chrome.tabGroups.update(otherGroupId, { title: "Other", color: "grey" });
    }

    const activeGroupId = activeTab.groupId;
    if (activeGroupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      delete groupExitTimes[activeGroupId];
      chrome.storage.local.get(['tabMove'], (data) => {
    if (data.tabMove !== false) {
        safeMoveGroup(activeGroupId);
    }
});
    }

    const currentGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    currentGroups.forEach(group => {
      if (group.id !== activeGroupId) {
        if (!groupExitTimes[group.id]) groupExitTimes[group.id] = Date.now();
      } else {
        delete groupExitTimes[group.id];
      }
    });

    chrome.alarms.create("checkCollapse", { periodInMinutes: 1/60 });

  } catch (e) { /* Error silenced */ }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkCollapse") {
    const data = await chrome.storage.local.get(['autoCollapse']);
    if (data.autoCollapse === false) return; 

    const existingGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeGroupId = activeTabs.length > 0 ? activeTabs[0].groupId : null;

    existingGroups.forEach(async (group) => {
      if (group.id !== activeGroupId && groupExitTimes[group.id]) {
        if (Date.now() - groupExitTimes[group.id] >= 5000) {
          try {
            await chrome.tabGroups.update(group.id, { collapsed: true }).catch(() => {});
            delete groupExitTimes[group.id];
          } catch (e) { /* Tab could be being edited */ }
        }
      }
    });
  }
});

chrome.tabs.onActivated.addListener(() => setTimeout(organizeAndMove, 200));
chrome.tabs.onUpdated.addListener((id, change) => {
  if (change.status === 'complete') organizeAndMove();
});
chrome.tabs.onCreated.addListener(() => setTimeout(organizeAndMove, 500));
chrome.tabs.onRemoved.addListener(() => setTimeout(organizeAndMove, 200));
// End of background.js

