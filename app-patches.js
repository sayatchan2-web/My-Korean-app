(function () {
    const isTWA = document.referrer.startsWith('android-app://');
    if (!isTWA) return;

    function hideInstallUI() {
        const banner = document.getElementById('installBanner');
        const floatBtn = document.getElementById('floatingInstallBtn');
        if (banner) banner.style.display = 'none';
        if (floatBtn) floatBtn.style.display = 'none';
    }
    hideInstallUI();
    window.addEventListener('load', hideInstallUI);
    document.addEventListener('DOMContentLoaded', hideInstallUI);
})();


(function () {
    const style = document.createElement('style');
    style.textContent = `
        #offlineStatusBar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 10000;
            background: #4a1528;
            color: #fff;
            font-family: 'Tajawal', sans-serif;
            font-size: 13px;
            font-weight: 700;
            text-align: center;
            padding: 10px 12px;
            padding-bottom: max(10px, env(safe-area-inset-bottom, 10px));
            transform: translateY(100%);
            transition: transform 0.35s ease;
        }
        #offlineStatusBar.visible { transform: translateY(0); }
    `;
    document.head.appendChild(style);

    const bar = document.createElement('div');
    bar.id = 'offlineStatusBar';
    bar.textContent = '📡 أنت غير متصل بالإنترنت حالياً - بعض الميزات (الصوت الخارجي) قد لا تعمل';
    document.body.appendChild(bar);

    function updateOnlineStatus() {
        if (navigator.onLine) {
            bar.classList.remove('visible');
        } else {
            bar.classList.add('visible');
        }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    document.addEventListener('DOMContentLoaded', updateOnlineStatus);
})();


(function () {
    let navDepth = 0;
    let isHandlingBack = false;

    function pushDepth() {
        if (isHandlingBack) return;
        navDepth++;
        history.pushState({ navDepth: navDepth }, '');
    }

    document.addEventListener('click', function (e) {
        const tab = e.target.closest('.navigation-tab');
        if (tab && tab.dataset.target !== 'home') {
            pushDepth();
        }
    });

    if (typeof switchToStoriesScreen === 'function') {
        const _switchToStoriesScreen = switchToStoriesScreen;
        switchToStoriesScreen = function () {
            _switchToStoriesScreen();
            pushDepth();
        };
    }

    if (typeof openStoryDetails === 'function') {
        const _openStoryDetails = openStoryDetails;
        openStoryDetails = function (index) {
            _openStoryDetails(index);
            pushDepth();
        };
    }

    window.addEventListener('load', function () {
        history.replaceState({ navDepth: 0 }, '');
    });

    window.addEventListener('popstate', function (e) {
        isHandlingBack = true;
        const targetDepth = (e.state && typeof e.state.navDepth === 'number') ? e.state.navDepth : 0;

        if (targetDepth < navDepth) {
            const openStory = document.querySelector('.story-view-screen[style*="display: block"], .story-view-screen[style*="display:block"]');
            const storiesScreen = document.getElementById('stories-screen');

            if (openStory) {
                if (typeof switchToStoriesList === 'function') switchToStoriesList();
            } else if (storiesScreen && storiesScreen.classList.contains('active-screen')) {
                if (typeof switchToMainScreen === 'function') switchToMainScreen();
            } else {
                if (typeof switchToMainScreen === 'function') switchToMainScreen();
            }
        }
        navDepth = targetDepth;
        isHandlingBack = false;
    });
})();


function getAchievements() {
    let data = null;
    try {
        const stored = localStorage.getItem('korean_app_achievements');
        data = stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.warn('getAchievements error:', e);
    }
    if (!data || typeof data !== 'object') {
        data = { storiesCompleted: 0, listeningCompleted: 0, writingCompleted: 0, xp: 0, badges: [] };
    }
    if (!Array.isArray(data.badges)) data.badges = [];
    if (typeof data.storiesCompleted !== 'number') data.storiesCompleted = 0;
    if (typeof data.listeningCompleted !== 'number') data.listeningCompleted = 0;
    if (typeof data.writingCompleted !== 'number') data.writingCompleted = 0;
    if (typeof data.xp !== 'number') data.xp = 0;
    return data;
}

function saveAchievements(data) {
    try {
        localStorage.setItem('korean_app_achievements', JSON.stringify(data));
    } catch (e) {
        console.warn('saveAchievements error:', e);
        if (typeof showToast === 'function') {
            showToast('⚠️ تعذر حفظ تقدمك على هذا الجهاز');
        }
    }
}

