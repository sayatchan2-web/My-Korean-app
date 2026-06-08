// ============ إعدادات الصوت والقراءة ============
let audioPlayer = new Audio(), isAudioMode = false, timestampCheckTimer = null, lastHighlightedSentence = -1;
let storySpeech = null, currentUtterance = null, activeStoryId = -1, currentSentenceIdx = 0, isPlaying = false, wordTimer = null;
let storyPausePosition = {};
let currentTab = 0;

// ===== تفعيل TTS عند أول نقرة =====
document.addEventListener('click', function initTTS() {
    if ('speechSynthesis' in window) {
        const dummy = new SpeechSynthesisUtterance('');
        dummy.volume = 0;
        speechSynthesis.speak(dummy);
    }
}, { once: true });

function loadVoices(){if('speechSynthesis' in window){storySpeech=window.speechSynthesis;storySpeech.getVoices();return true}return false}
function speakSentence(text,callback){if(!storySpeech)loadVoices();if(!storySpeech){if(callback)callback();return};storySpeech.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.rate=0.75;u.pitch=1.0;u.volume=1.0;const voices=storySpeech.getVoices();const kv=voices.find(v=>v.lang.includes('ko'));if(kv)u.voice=kv;var ended=false;u.onend=function(){if(!ended){ended=true;if(callback)callback()}};u.onerror=function(){if(!ended){ended=true;if(callback)callback()}};setTimeout(function(){if(!ended){ended=true;if(callback)callback()}},20000);currentUtterance=u;storySpeech.speak(u)}

function toggleAudio(storyIdx){
    if(storyAudioFiles[storyIdx]){
        if(isPlaying && activeStoryId === storyIdx && isAudioMode){
            audioPlayer.pause();
            storyPausePosition[storyIdx] = audioPlayer.currentTime;
            isPlaying = false;
            stopTimestampCheck();
            setPausedUI(storyIdx);
            showStoryToast('⏸ تم الإيقاف المؤقت - سيتم الاستئناف من نفس المكان');
            return;
        }
        if(storyPausePosition[storyIdx] && activeStoryId === storyIdx){
            audioPlayer.currentTime = storyPausePosition[storyIdx];
        }
        if(isPlaying){
            stopAllAudio();
            if(activeStoryId !== storyIdx) resetBtnUI(activeStoryId);
        }
        activeStoryId = storyIdx;
        isPlaying = true;
        isAudioMode = true;
        lastHighlightedSentence = -1;
        currentSentenceIdx = 0;
        setPlayingUI(storyIdx);
        if(!audioPlayer.src || audioPlayer.src !== storyAudioFiles[storyIdx]){
            audioPlayer.src = storyAudioFiles[storyIdx];
            if(storyPausePosition[storyIdx]){
                audioPlayer.currentTime = storyPausePosition[storyIdx];
            }
        }
        audioPlayer.play();
        if(storyTimestamps[storyIdx]) startTimestampCheck(storyIdx);
        audioPlayer.onended = function(){
            stopAllAudio();
            stopTimestampCheck();
            resetBtnUI(storyIdx);
            delete storyPausePosition[storyIdx];
            showStoryToast('✅ انتهت القصة!');
        };
        audioPlayer.onerror = function(){
            stopAllAudio();
            stopTimestampCheck();
            resetBtnUI(storyIdx);
            showStoryToast('⚠️ خطأ في تحميل الصوت');
        };
        return;
    }
    // ===== وضع TTS =====
    if (!('speechSynthesis' in window)) {
        showToast('⚠️ المتصفح لا يدعم النطق الصوتي');
        return;
    }
    if(isPlaying && activeStoryId === storyIdx && !isAudioMode){
        stopAudio();
        setPausedUI(storyIdx);
        showStoryToast('⏸ تم الإيقاف المؤقت');
        return;
    }
    if(isPlaying && activeStoryId !== storyIdx){
        stopAudio();
        resetBtnUI(activeStoryId);
    }
    isPlaying = true;
    activeStoryId = storyIdx;
    isAudioMode = false;
    currentSentenceIdx = storyPausePosition[storyIdx] || 0;
    setPlayingUI(storyIdx);
    playNext();
}

function startTimestampCheck(storyIdx){
    stopTimestampCheck();
    lastHighlightedSentence = -1;
    timestampCheckTimer = setInterval(function(){
        if(!isPlaying || !isAudioMode) return;
        const ct = audioPlayer.currentTime;
        const ts = storyTimestamps[storyIdx];
        if(!ts) return;
        let found = -1;
        for(let i = 0; i < ts.length; i++){
            if(ct >= ts[i].start && ct <= ts[i].end){
                found = i;
                break;
            }
        }
        if(found !== -1 && found !== lastHighlightedSentence){
            lastHighlightedSentence = found;
            currentSentenceIdx = found;
            highlightSentencePurple(storyIdx, found);
        }
    }, 150);
}

function stopTimestampCheck(){
    if(timestampCheckTimer){
        clearInterval(timestampCheckTimer);
        timestampCheckTimer = null;
    }
    lastHighlightedSentence = -1;
}

function highlightSentencePurple(storyIdx, sentIdx){
    const container = document.getElementById('storyText' + storyIdx);
    if(!container) return;
    const allKr = container.querySelectorAll('.kr-block');
    const allAr = container.querySelectorAll('.ar-block');
    allKr.forEach(kr => { kr.style.background = 'transparent'; kr.style.borderRadius = '0'; kr.style.padding = '0'; });
    allAr.forEach(ar => { ar.style.opacity = '0.4'; ar.style.fontWeight = '500'; });
    if(allKr[sentIdx]){
        allKr[sentIdx].style.background = 'rgba(147,112,219,0.25)';
        allKr[sentIdx].style.borderRadius = '10px';
        allKr[sentIdx].style.padding = '6px 10px';
    }
    if(allAr[sentIdx]){
        allAr[sentIdx].style.opacity = '1';
        allAr[sentIdx].style.fontWeight = '900';
        allAr[sentIdx].scrollIntoView({behavior:'smooth', block:'center'});
    }
}

function stopAllAudio(){
    isPlaying = false;
    isAudioMode = false;
    stopTimestampCheck();
    if(audioPlayer){
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    if(storySpeech) try{ storySpeech.cancel(); } catch(e){}
    if(wordTimer !== null){
        clearInterval(wordTimer);
        wordTimer = null;
    }
}

function playNext(){
    if(!isPlaying) return;
    if(wordTimer !== null){ clearInterval(wordTimer); wordTimer = null; }
    const data = allStories[activeStoryId];
    if(!data || currentSentenceIdx >= data.length){
        stopAudio();
        resetBtnUI(activeStoryId);
        return;
    }
    const container = document.getElementById('storyText' + activeStoryId);
    if(container) container.querySelectorAll('.word').forEach(w => w.classList.remove('active-word'));
    
    // ✅ تمييز الجملة الحالية تماماً مثل القصص الصوتية
    highlightSentencePurple(activeStoryId, currentSentenceIdx);
    
    // نطق الجملة ثم الانتقال للتالية
    speakSentence(data[currentSentenceIdx].kr, function(){
        if(container) container.querySelectorAll('.word').forEach(w => w.classList.remove('active-word'));
        currentSentenceIdx++;
        if(isPlaying && currentSentenceIdx < data.length) setTimeout(function(){ playNext(); }, 400);
        else if(currentSentenceIdx >= data.length){ stopAudio(); resetBtnUI(activeStoryId); }
    });
}

function trackWords(storyIdx, sentIdx, text){
    // لم تعد مستخدمة، لكن نحتفظ بها لتجنب الأخطاء
}

function highlightCurrentSentence(storyIdx, sentIdx){
    const container = document.getElementById('storyText' + storyIdx);
    if(!container) return;
    const arBlocks = container.querySelectorAll('.ar-block');
    if(arBlocks[sentIdx]) arBlocks[sentIdx].scrollIntoView({behavior:'smooth', block:'center'});
}

function stopAudio(){
    isPlaying = false;
    isAudioMode = false;
    stopTimestampCheck();
    if(wordTimer !== null){
        clearInterval(wordTimer);
        wordTimer = null;
    }
    if(audioPlayer){
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    if(storySpeech) try{ storySpeech.cancel(); } catch(e){}
    currentUtterance = null;
}

function resetBtnUI(idx){
    const btn = document.getElementById('btnContent' + idx);
    const status = document.getElementById('ttsStatus' + idx);
    if(btn) btn.innerHTML = '<i class="fa-solid fa-play"></i> <span>تشغيل الصوت</span>';
    if(status) status.innerText = '';
}

function setPlayingUI(idx){
    const btn = document.getElementById('btnContent' + idx);
    const status = document.getElementById('ttsStatus' + idx);
    if(btn) btn.innerHTML = '<div class="wave-bars"><span></span><span></span><span></span><span></span><span></span></div><span>إيقاف مؤقت</span>';
    if(status) status.innerText = '🎵 جارٍ التشغيل...';
}

function setPausedUI(idx){
    const btn = document.getElementById('btnContent' + idx);
    const status = document.getElementById('ttsStatus' + idx);
    if(btn) btn.innerHTML = '<i class="fa-solid fa-play"></i> <span>متابعة التشغيل</span>';
    if(status) status.innerText = '⏸ متوقف مؤقتاً';
}

function cancelTTS(){ stopAudio(); }

// ============ دوال التنقل ============
function switchToMainScreen() {
    cancelTTS();
    document.getElementById('bottomNav').style.display = '';
    showScreen('home');
}

function switchToStoriesList() {
    cancelTTS();
    for (let i = 0; i < allStories.length; i++) {
        const screen = document.getElementById("story-screen-" + i);
        if (screen) screen.style.display = "none";
    }
    showScreen('stories');
    document.getElementById('bottomNav').style.display = 'none';
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
        const tabIndex = Array.from(activeTab.parentNode.children).indexOf(activeTab);
        renderTab(tabIndex);
    }
}

function openStoryDetails(index) {
    cancelTTS();
    document.getElementById('bottomNav').style.display = 'none';
    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active-screen'));

    for (let i = 0; i < allStories.length; i++) {
        const screen = document.getElementById("story-screen-" + i);
        if (screen) screen.style.display = "none";
    }

    const storyScreen = document.getElementById("story-screen-" + index);
    if (storyScreen) {
        storyScreen.style.display = 'block';
        if (allStories[index]) {
            setupStoryDOM(allStories[index], 'storyText' + index);
        }
    } else {
        alert('القصة غير متاحة');
    }
}

function switchToStoriesScreen() {
    cancelTTS();
    document.getElementById('bottomNav').style.display = 'none';
    showScreen('stories');
    const activeTab = document.querySelector('.tab.active');
    const tabIndex = activeTab ? Array.from(activeTab.parentNode.children).indexOf(activeTab) : 0;
    renderTab(tabIndex);
}

function goToStoriesWithDelay() { setTimeout(function() { switchToStoriesScreen(); }, 650); }
function openWriting() { setTimeout(function() { window.location.href = 'writing-system.html'; }, 650); }
function openListening() { setTimeout(function() { window.location.href = 'listening-system.html'; }, 650); }
function openReading() { setTimeout(function() { window.location.href = 'reading-menu.html'; }, 650); }
function goToChatWithDelay() { setTimeout(function() { window.location.href = 'chat.html'; }, 650); }

function showScreen(screenId) {
    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active-screen'));
    const target = document.getElementById(screenId + '-screen');
    if (target) target.classList.add('active-screen');
    document.querySelectorAll('.navigation-tab').forEach(tab => tab.classList.remove('active-tab'));
    const activeTab = document.querySelector(`[data-target="${screenId}"]`);
    if (activeTab) activeTab.classList.add('active-tab');
    if (screenId === 'learn') loadLearnContent();
    if (screenId === 'achievements') loadAchievements();
    if (screenId === 'profile') loadProfileContent();
    if (screenId === 'stories') {
        document.getElementById('bottomNav').style.display = 'none';
    } else if (['home','learn','achievements','profile'].includes(screenId)) {
        document.getElementById('bottomNav').style.display = '';
    }
}

function bindNavigationEvents() {
    document.querySelectorAll('.navigation-tab').forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.dataset.target;
            if (target === 'home') switchToMainScreen();
            else if (target === 'learn') showScreen('learn');
            else if (target === 'achievements') showScreen('achievements');
            else if (target === 'profile') showScreen('profile');
        });
    });
}

// ============ المحتوى التعليمي ============
const tips=["حاول أن تتعلم 5 كلمات جديدة يوميًا واستخدمها في جمل.","شاهد مسلسلات كورية بترجمة كورية لتحسين مهاراتك.","استخدم تطبيق المذكرات لكتابة يومياتك باللغة الكورية.","كرر الكلمات بصوت عالٍ لتثبيت النطق الصحيح.","خصص 10 دقائق يوميًا لمراجعة المفردات القديمة.","حاول التفكير باللغة الكورية بدلاً من الترجمة الحرفية.","اقرأ قصص الأطفال بالكورية، فمفرداتها بسيطة ومفيدة.","استمع إلى الأغاني الكورية وحاول كتابة الكلمات التي تسمعها.","شارك في مجموعات تعلم اللغة الكورية على الإنترنت للممارسة.","لا تخف من الأخطاء، فكل خطأ هو خطوة نحو الإتقان.","ضع أهدافًا أسبوعية صغيرة، مثل حفظ 30 كلمة جديدة.","حاول أن تقرأ مقالاً إخباريًا بالكورية مرة في الأسبوع.","اكتب منشورات قصيرة بالكورية على وسائل التواصل الاجتماعي.","شاهد مقاطع يوتيوب تعليمية عن القواعد الكورية.","استخدم خاصية الترجمة في هاتفك لممارسة النطق.","حاول التحدث مع متحدثين أصليين عبر تطبيقات التبادل اللغوي.","خصص دفترًا للمفردات الصعبة وراجعها بانتظام.","تعلم جملة كورية كاملة بدلاً من كلمة واحدة في كل مرة.","استمع إلى البودكاست الكوري أثناء المشي أو القيادة.","جرب كتابة تعليقات بالكورية على منشورات أصدقائك الكوريين."];
const topikFacts=["امتحان TOPIK I يتكون من 30 سؤال استماع و 30 سؤال قراءة، ومدة الاختبار 100 دقيقة.","امتحان TOPIK II يتكون من 50 سؤال استماع، 4 أسئلة كتابة، و 50 سؤال قراءة. مدته 180 دقيقة.","للحصول على المستوى 3 في TOPIK II، يجب أن تحصل على 120 نقطة على الأقل من 300.","المستوى 6 (الأعلى) يتطلب 230 نقطة في TOPIK II.","تقام امتحانات TOPIK 6 مرات في السنة داخل كوريا، و 4 مرات خارجها.","نتائج الامتحان تبقى صالحة لمدة سنتين من تاريخ الإعلان.","يمكنك استخدام قاموس ورقي في قسم الكتابة فقط (TOPIK II).","السرعة مهمة جدًا في قسم القراءة؛ حاول أن لا تتجاوز دقيقة واحدة لكل سؤال.","الأسئلة 51-52 في الكتابة هي أسئلة إكمال فراغات، وهي أسهل جزء للحصول على نقاط.","الأسئلة 53-54 في الكتابة تتطلب كتابة نصوص طويلة (رسم بياني + مقال)، فتدرب عليها كثيرًا.","TOPIK I يمنح مستويين فقط: المستوى 1 (80 نقطة) والمستوى 2 (140 نقطة).","القسم الأصعب في TOPIK II هو الاستماع المتقدم (الأسئلة 21-50) حيث المحادثات طويلة ومعقدة.","يمكن استخدام اللغة الإنجليزية أو الكورية فقط في التعليمات داخل قاعة الامتحان.","يُسمح بدخول الامتحان بقلم رصاص فقط، ولا يُسمح بالأقلام الجافة أو الحبر.","نتيجة الامتحان تُعلن عادة بعد حوالي شهر من تاريخ الاختبار.","لا يوجد نجاح أو رسوب في TOPIK، بل تحصل على مستوى حسب درجتك.","في كوريا، يستخدم TOPIK للقبول الجامعي والتوظيف وطلب الإقامة الدائمة.","هناك كتب تحضيرية رسمية من المعهد الكوري للتعليم (NIIED) يمكنك تحميلها مجانًا.","الاستماع في TOPIK II يحتوي على مقاطع من نشرات الأخبار والبرامج الحوارية.","سؤال الكتابة 53 يعرض رسمًا بيانيًا ويطلب منك وصفه في 200-300 كلمة كورية."];
const motivations=["كل حرف تتعلمه يقرّبك من حلمك. لا تتوقف!","أنت اليوم أفضل من الأمس، وغدًا ستكون أفضل.","تذكر دائمًا لماذا بدأت، ولتكن هذه قوتك.","لا تقارن رحلتك برحلة الآخرين، فلكلٍ طريقه الخاص.","النجاح ليس نهاية، والفشل ليس قاتلًا، الشجاعة للاستمرار هي ما يهم.","الأشياء العظيمة تستغرق وقتًا، كن صبورًا مع نفسك.","كل دقيقة تقضيها في التعلم هي استثمار في مستقبلك.","أنت تتعلم واحدة من أصعب اللغات في العالم، وهذا إنجاز بحد ذاته!","تخيل نفسك تتحدث الكورية بطلاقة، هذا الحلم قريب جدًا.","العقبة الوحيدة بينك وبين هدفك هي القصة التي ترويها لنفسك.","لا تيأس، كل متحدث طليق بدأ من الصفر مثلك تمامًا.","فخور بك لأنك مستمر رغم الصعوبات.","قوة الإرادة تصنع المستحيل. ثق بنفسك.","ما تتعلمه اليوم سيصبح سلاحك غدًا.","رحلة تعلم اللغة ممتعة بقدر ما هي مفيدة، استمتع بها!","أنت لست وحدك، ملايين يتعلمون الكورية حول العالم.","لا يوجد وقت متأخر للبدء، كل لحظة هي فرصة جديدة.","ضع صورة لهدفك أمامك دائمًا لتذكرك لماذا تتعلم.","كلما شعرت بالإحباط، تذكر كم قطعت من طريق.","الاستسلام هو الهزيمة الوحيدة، أما التأخر في التقدم فهو طبيعي."];
function getNonRepeatingItem(arr, storageKey) { let used = JSON.parse(localStorage.getItem(storageKey) || '[]'); let available = arr.filter((_, i) => !used.includes(i)); if (available.length === 0) { used = []; available = [...arr]; } const randomAvailableIndex = Math.floor(Math.random() * available.length); const selectedItem = available[randomAvailableIndex]; const originalIndex = arr.indexOf(selectedItem); used.push(originalIndex); localStorage.setItem(storageKey, JSON.stringify(used)); return selectedItem; }
function refreshTip() { document.getElementById('tipText').textContent = getNonRepeatingItem(tips, 'used_tips'); }
function refreshTopik() { document.getElementById('topikText').textContent = getNonRepeatingItem(topikFacts, 'used_topik'); }
function refreshMotivation() { document.getElementById('motivationText').textContent = getNonRepeatingItem(motivations, 'used_motivations'); }
function loadLearnContent() { refreshTip(); refreshTopik(); refreshMotivation(); }

// ============ الإنجازات ============
function getAchievements() {
    const stored = localStorage.getItem('korean_app_achievements');
    return stored ? JSON.parse(stored) : { storiesCompleted:0, listeningCompleted:0, writingCompleted:0, xp:0, badges:[] };
}
function saveAchievements(data) { localStorage.setItem('korean_app_achievements', JSON.stringify(data)); }
function loadAchievements() {
    const data = getAchievements();
    const total = 40;
    const completed = Math.min(data.storiesCompleted, total);
    const percent = (completed / total) * 100;
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressCharacter').style.left = percent + '%';
    document.getElementById('progressText').textContent = completed + ' / ' + total;
    document.getElementById('statStories').textContent = data.storiesCompleted;
    document.getElementById('statXP').textContent = data.xp;
    document.getElementById('statListening').textContent = data.listeningCompleted || 0;
    document.getElementById('statWriting').textContent = data.writingCompleted || 0;
    const starsRow = document.getElementById('starsRow');
    starsRow.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
        const threshold = (i / 10) * total;
        const earned = completed >= threshold;
        starsRow.innerHTML += `<span class="star-icon" style="opacity:${earned ? 1 : 0.3};">⭐</span>`;
    }
    const allBadges = [
        { id: 'first-story', icon: '📖', name: 'قارئ مبتدئ' },
        { id: 'five-stories', icon: '🌟', name: 'قارئ نشط' },
        { id: 'all-stories', icon: '👑', name: 'ملك القصص' },
        { id: 'first-listen', icon: '🎧', name: 'مستمع' },
        { id: 'first-write', icon: '✍️', name: 'كاتب' }
    ];
    document.getElementById('badgesGrid').innerHTML = allBadges.map(b => {
        const unlocked = data.badges.includes(b.id);
        return `<div class="badge-item ${unlocked ? 'unlocked' : 'locked'}"><span class="badge-icon">${b.icon}</span><span class="badge-name">${b.name}</span></div>`;
    }).join('');
    const msgs = ["🐰 كل قصة تقرّبك من القمة!", "🌸 أنت تتقدم بثبات.. استمر!", "🍰 كل صفحة تزيدك قوة!", "🎀 الأرنب فخور بك!", "🌟 أنت تصنع المعجزات يومًا بعد يوم!", "🍭 تعلمك جميل مثل الحلوى!", "💖 الكورية تحبك وأنت تحبها!"];
    document.getElementById('encouragementMsg').textContent = msgs[Math.floor(Math.random() * msgs.length)];
}

// ============ القصص ============
const emojis = {
    0: '💨', 1: '🐢', 2: '🐦', 3: '🐯', 4: '💧',
    5: '🍉', 6: '🧂', 7: '⚖️', 8: '🐓', 9: '🐭',
    10: '👁️', 11: '🛏️', 12: '📞', 13: '👂', 14: '📄',
    15: '🛗', 16: '🧱', 17: '📻', 18: '⚖️', 19: '🖼️'
};

// دالة مساعدة للحصول على عنوان القصة من التبويبات
function getStoryTitle(idx) {
    for (let tab = 0; tab < stories.length; tab++) {
        if (stories[tab]) {
            const found = stories[tab].find(s => s.id === idx);
            if (found) return { kr: found.titleKR || found.title || '', ar: found.titleAR || found.title || '' };
        }
    }
    return { kr: '', ar: '' };
}

function initStories() {
    if (typeof allStories === 'undefined') { console.warn('allStories غير معرف'); return; }
    for (let i = 0; i < allStories.length; i++) {
        const container = document.getElementById('storyText' + i);
        if (container && allStories[i]) {
            setupStoryDOM(allStories[i], 'storyText' + i);
        }
    }
}

function renderTab(index) {
    const container = document.getElementById("content");
    if(!container) return;
    container.innerHTML = "";
    if (!stories[index]) return;
    stories[index].forEach(story => {
        const card = document.createElement("div");
        card.className = "card";
        if(story.id !== -1) {
            card.onclick = function() { cancelTTS(); openStoryDetails(story.id); };
        }
        const tKR = story.titleKR || story.title || '';
        const tAR = story.titleAR || '';
        const em = emojis[story.id] || '📖';
        card.innerHTML = `<div style="flex:1"><div class="title" style="font-family:Fredoka,sans-serif;font-size:13px;direction:ltr;text-align:left;">${tKR}</div><div style="font-size:10px;color:#634785;margin-top:3px;font-weight:700;">${tAR}</div></div><div class="img-box" style="font-size:40px;">${em}</div>`;
        container.appendChild(card);
    });
}

function showTab(index) {
    document.querySelectorAll(".tab").forEach((t, i) => t.classList.toggle("active", i === index));
    currentTab = index;
    renderTab(index);
}

function setupStoryDOM(storyData, targetContainerId) {
    const container = document.getElementById(targetContainerId);
    if(!container) return;
    container.innerHTML = "";
    storyData.forEach((item, sentIdx) => {
        const krDiv = document.createElement('div');
        krDiv.className = 'kr-block';
        krDiv.dataset.sentIdx = sentIdx;
        item.kr.split(' ').forEach((w, wIdx) => {
            const span = document.createElement('span');
            span.className = 'word';
            span.dataset.sentIdx = sentIdx;
            span.dataset.wordIdx = wIdx;
            span.innerText = w + ' ';
            krDiv.appendChild(span);
        });
        container.appendChild(krDiv);
        const arDiv = document.createElement('div');
        arDiv.className = 'ar-block';
        arDiv.innerText = item.ar;
        container.appendChild(arDiv);
    });
}

// ============ الملف الشخصي ============
const PROFILE_KEY = 'user_profile';
const STREAK_KEY = 'user_streak';
const LAST_ACTIVE_KEY = 'last_active_date';

function getProfile() {
    const stored = localStorage.getItem(PROFILE_KEY);
    return stored ? JSON.parse(stored) : { name: 'متعلم', avatar: '😊' };
}
function saveProfile(profile) { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }

function updateStreak() {
    const today = new Date().toDateString();
    const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
    let streak = parseInt(localStorage.getItem(STREAK_KEY) || '0');
    if (!lastActive) { streak = 1; }
    else {
        const lastDate = new Date(lastActive);
        const diffTime = new Date(today).getTime() - lastDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {}
        else if (diffDays === 1) { streak += 1; }
        else { streak = 1; }
    }
    localStorage.setItem(STREAK_KEY, streak.toString());
    localStorage.setItem(LAST_ACTIVE_KEY, today);
    return streak;
}

function getTotalLearningHours() {
    const data = getAchievements();
    const storyMinutes = data.storiesCompleted * 15;
    const listeningMinutes = (data.listeningCompleted || 0) * 10;
    const writingMinutes = (data.writingCompleted || 0) * 15;
    const totalMinutes = storyMinutes + listeningMinutes + writingMinutes;
    return (totalMinutes / 60).toFixed(1);
}

function getCompletionRate() {
    const data = getAchievements();
    const totalAvailable = 40 + 30 + 10;
    const completed = data.storiesCompleted + (data.listeningCompleted || 0) + (data.writingCompleted || 0);
    return Math.min(100, Math.round((completed / totalAvailable) * 100));
}

function getTotalCompletedItems() {
    const data = getAchievements();
    return data.storiesCompleted + (data.listeningCompleted || 0) + (data.writingCompleted || 0);
}

function loadProfileContent() {
    const profile = getProfile();
    document.getElementById('userName').textContent = profile.name;
    document.getElementById('userAvatar').textContent = profile.avatar;
    document.getElementById('customName').value = profile.name;
    const streak = updateStreak();
    document.getElementById('streakDays').textContent = streak;
    const messages = ["استمر، أنت تتحسن!", "عمل رائع! واصل التقدم", "أنت بطل اليوم!", "التزامك ممتاز!"];
    document.getElementById('streakMessage').textContent = messages[Math.min(streak, messages.length-1)];
    document.getElementById('totalHours').textContent = getTotalLearningHours();
    document.getElementById('completionRate').textContent = getCompletionRate() + '%';
    document.getElementById('totalItems').textContent = getTotalCompletedItems();
    document.querySelectorAll('.avatar-option').forEach(el => {
        if (el.dataset.avatar === profile.avatar) el.classList.add('selected');
        else el.classList.remove('selected');
    });
}

function openEditProfile() { document.getElementById('editProfileSection').style.display = 'block'; }
function closeEditProfile() { document.getElementById('editProfileSection').style.display = 'none'; }

function saveCustomProfile() {
    const name = document.getElementById('customName').value.trim();
    if (!name) { showToast('⚠️ الرجاء إدخال اسم'); return; }
    const selectedAvatar = document.querySelector('.avatar-option.selected');
    const avatar = selectedAvatar ? selectedAvatar.dataset.avatar : '😊';
    saveProfile({ name, avatar });
    showToast('✅ تم حفظ ملفك الشخصي!');
    closeEditProfile();
    loadProfileContent();
}

function handleLogout() {
    if (confirm('هل أنت متأكد من إعادة تعيين التقدم؟ سيتم مسح جميع بياناتك المحلية!')) {
        localStorage.removeItem('korean_app_achievements');
        localStorage.removeItem(PROFILE_KEY);
        localStorage.removeItem(STREAK_KEY);
        localStorage.removeItem(LAST_ACTIVE_KEY);
        showToast('👋 تم مسح التقدم. ابدأ من جديد!');
        showScreen('profile');
    }
}

// ============ أحداث الصفحة ============
// استخدام تفويض الأحداث لزر "تم" ليشمل الأزرار المضافة ديناميكياً
document.addEventListener('click', function(e) {
    if (e.target.closest('.action-button-done')) {
        completeStoryAndGoBack();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // ✅ أول إجراء: إظهار body فوراً (كان مخفياً بـ visibility:hidden في HTML)
    document.body.style.visibility = 'visible';
    
    // إخفاء جميع الشاشات احتياطياً
    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active-screen'));
    
    // التحقق من إشارة الانتقال المباشر للقصص (قادم من reading-menu.html)
    if (sessionStorage.getItem('openStories') === 'true') {
        // مسح الإشارة فوراً
        sessionStorage.removeItem('openStories');
        
        // تجهيز شاشة القصص مباشرة
        document.getElementById('stories-screen').classList.add('active-screen');
        document.getElementById('bottomNav').style.display = 'none';
        
        // تأكد من وجود تبويب نشط (افتراضي أول تبويب)
        const activeTab = document.querySelector('.tab.active');
        const tabIndex = activeTab ? Array.from(activeTab.parentNode.children).indexOf(activeTab) : 0;
        currentTab = tabIndex;
        renderTab(tabIndex);
        
        // إيقاف أي تحميل إضافي للشاشات الأخرى والعودة
        return;
    }
    
    // ✅ إذا لم تكن هناك إشارة، نُفعّل الشاشة الرئيسية بشكل طبيعي
    document.getElementById('home-screen').classList.add('active-screen');
    document.getElementById('bottomNav').style.display = '';
    
    // ============ باقي إعدادات الصفحة الرئيسية (الأفاتار...) ============
    document.querySelectorAll('.avatar-option').forEach(opt => {
        opt.addEventListener('click', function() {
            document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
        });
    });
});

function completeStoryAndGoBack() {
    const data = getAchievements();
    data.storiesCompleted += 1;
    data.xp += 20;
    checkBadges(data);
    saveAchievements(data);
    showToast('🎉 أكملت القصة! +20 XP');
}

function checkBadges(data) {
    if (data.storiesCompleted >= 1 && !data.badges.includes('first-story')) {
        data.badges.push('first-story');
        showToast('🏅 شارة جديدة: قارئ مبتدئ!');
    }
    if (data.storiesCompleted >= 5 && !data.badges.includes('five-stories')) {
        data.badges.push('five-stories');
        showToast('🌟 شارة جديدة: قارئ نشط!');
    }
    if (data.storiesCompleted >= 10 && !data.badges.includes('all-stories')) {
        data.badges.push('all-stories');
        showToast('👑 شارة جديدة: ملك القصص!');
    }
}

function showToast(message) {
    const existingToast = document.querySelector('.custom-toast');
    if(existingToast) existingToast.remove();
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#d63384,#c2185b);color:white;padding:10px 20px;border-radius:20px;font-weight:900;z-index:1000;animation:xpPop 0.5s ease, xpFadeOut 0.5s 2.5s forwards;box-shadow:0 4px 15px rgba(200,50,80,0.4);font-size:14px;font-family:\'Tajawal\',sans-serif;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
function showStoryToast(msg) {
    const existing = document.querySelector('.story-toast');
    if(existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'story-toast';
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#4a1528;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:700;z-index:1000;font-family:Tajawal,sans-serif;animation:xpPop 0.5s ease;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

window.addEventListener('load', function() {
    bindNavigationEvents();
    
    // ============ إعادة بناء allStories والقوائم المرتبطة بها ============
    const baseAllStories = allStories.slice(); // الأطفال (0-9)
    const baseStoryTimestamps = Object.assign({}, storyTimestamps);
    const baseStoryAudioFiles = Object.assign({}, storyAudioFiles);
    const baseStories = stories.slice();
    const baseEmojis = Object.assign({}, emojis); // يحتوي على إيموجيات الأطفال والرعب الأصلية
    
    // إفراغ المصفوفات والكائنات
    allStories.length = 0;
    for (let key in storyTimestamps) delete storyTimestamps[key];
    for (let key in storyAudioFiles) delete storyAudioFiles[key];
    for (let key in emojis) delete emojis[key];
    stories.length = 0;
    
    // 1. استعادة القصص الأساسية (الأطفال)
    allStories.push(...baseAllStories);
    Object.assign(storyTimestamps, baseStoryTimestamps);
    Object.assign(storyAudioFiles, baseStoryAudioFiles);
    // استعادة إيموجيات الأطفال فقط (0-9)
    for (let i = 0; i < 10; i++) {
        if (baseEmojis[i]) emojis[i] = baseEmojis[i];
    }
    stories.push(...baseStories);
    
    // 2. إضافة القصص الممتعة (data4.js) في التبويب 1
    if (typeof allStories1_fun !== 'undefined') {
        const startIdxFun = allStories.length; // 10
        allStories1_fun.forEach((story, i) => {
            const newIdx = startIdxFun + i;
            allStories.push(story);
            // نستخدم التوقيتات من المفاتيح الأصلية (30-39) في storyTimestamps1_fun
            if (typeof storyTimestamps1_fun !== 'undefined' && storyTimestamps1_fun[i + 30]) {
                storyTimestamps[newIdx] = storyTimestamps1_fun[i + 30];
            }
            if (typeof storyAudioFiles1_fun !== 'undefined' && storyAudioFiles1_fun[i + 30] !== undefined) {
                storyAudioFiles[newIdx] = storyAudioFiles1_fun[i + 30];
            }
        });
        if (typeof stories1_fun !== 'undefined') {
            stories[1] = stories1_fun.map((s, i) => ({
                ...s,
                id: startIdxFun + i
            }));
        } else {
            stories[1] = [];
        }
        // دمج إيموجيات الممتعة
        if (typeof funEmojis !== 'undefined') {
            Object.keys(funEmojis).forEach(key => {
                const oldIdx = parseInt(key);
                const newIdx = startIdxFun + (oldIdx - 30);
                emojis[newIdx] = funEmojis[key];
            });
        }
        console.log('✅ القصص الممتعة أضيفت من فهرس', startIdxFun);
    }
    
    // 3. إضافة القصص العاطفية (data3.js) في التبويب 2
    if (typeof allStories2_emotional !== 'undefined') {
        const startIdxEmo = allStories.length; // 20 بعد الممتعة
        allStories2_emotional.forEach((story, i) => {
            const newIdx = startIdxEmo + i;
            allStories.push(story);
            if (storyTimestamps2_emotional && storyTimestamps2_emotional[i + 20]) {
                storyTimestamps[newIdx] = storyTimestamps2_emotional[i + 20];
            }
            if (storyAudioFiles2_emotional && storyAudioFiles2_emotional[i + 20] !== undefined) {
                storyAudioFiles[newIdx] = storyAudioFiles2_emotional[i + 20];
            }
        });
        if (typeof stories2_emotional !== 'undefined') {
            stories[2] = stories2_emotional.map((s, i) => ({
                ...s,
                id: startIdxEmo + i
            }));
        } else {
            stories[2] = [];
        }
        if (typeof emotionalEmojis !== 'undefined') {
            Object.keys(emotionalEmojis).forEach(key => {
                const newIdx = startIdxEmo + (parseInt(key) - 20);
                emojis[newIdx] = emotionalEmojis[key];
            });
        }
        console.log('✅ القصص العاطفية أضيفت من فهرس', startIdxEmo);
    }
    
    // 4. إضافة قصص الرعب (data2.js) في التبويب 3
    if (typeof allStories3 !== 'undefined' && allStories3.length > 0) {
        const startIdxHorror = allStories.length; // 30 بعد العاطفية
        allStories3.forEach((story, i) => {
            const newIdx = startIdxHorror + i;
            allStories.push(story);
            if (storyTimestamps3 && storyTimestamps3[i + 10]) {
                storyTimestamps[newIdx] = storyTimestamps3[i + 10];
            }
            if (storyAudioFiles3 && storyAudioFiles3[i + 10] !== undefined) {
                storyAudioFiles[newIdx] = storyAudioFiles3[i + 10];
            }
        });
        if (typeof stories3 !== 'undefined') {
            stories[3] = stories3.map((s, i) => ({
                ...s,
                id: startIdxHorror + i
            }));
        } else {
            stories[3] = [];
        }
        // نقل إيموجيات الرعب الأصلية من الفهارس القديمة (10-19) إلى الفهارس الجديدة
        for (let i = 0; i < 10; i++) {
            const oldIdx = 10 + i;
            const newIdx = startIdxHorror + i;
            if (baseEmojis[oldIdx]) {
                emojis[newIdx] = baseEmojis[oldIdx];
            }
        }
        console.log('✅ قصص الرعب أضيفت من فهرس', startIdxHorror);
    }
    
    // ============ حذف الشاشات القديمة للفهارس 10 وما فوق ============
    for (let idx = 10; idx < allStories.length; idx++) {
        const oldScreen = document.getElementById('story-screen-' + idx);
        if (oldScreen) {
            oldScreen.remove();
        }
    }
    
    // إنشاء شاشات القصص المفقودة ديناميكياً (لجميع الفهارس من 0 إلى الأخيرة)
    allStories.forEach((storyData, idx) => {
        if (!document.getElementById('story-screen-' + idx)) {
            const titleData = getStoryTitle(idx);
            const titleHTML = titleData.kr 
                ? `<h1 style="text-align:center;font-weight:900;margin-bottom: 10px;">${titleData.kr}<br><span style="font-size:18px;color:#634785;">${titleData.ar}</span></h1>`
                : `<h1 style="text-align:center;font-weight:900;">📖 قصة</h1>`;
                
            const screen = document.createElement('div');
            screen.id = 'story-screen-' + idx;
            screen.className = 'story-view-screen';
            screen.style.display = 'none';
            screen.innerHTML = `
                <div class="back-btn" onclick="switchToStoriesList()"><i class="fa-solid fa-arrow-right"></i> رجوع</div>
                ${titleHTML}
                <div class="listen-btn" id="audioBtn${idx}" onclick="toggleAudio(${idx})">
                    <span id="btnContent${idx}"><i class="fa-solid fa-play"></i> <span>تشغيل الصوت</span></span>
                </div>
                <div class="tts-status" id="ttsStatus${idx}"></div>
                <div class="story-container" id="storyText${idx}"></div>
                <div class="action-button-done">لقد أنهيت القصة بنجاح! 🎉</div>
            `;
            const screensContainer = document.querySelector('.screens-container');
            if (screensContainer) {
                screensContainer.appendChild(screen);
            } else {
                document.body.appendChild(screen);
            }
        }
    });
    
        initStories();
    document.querySelectorAll('.story-view-screen').forEach(s => s.style.display = 'none');
    loadVoices();
    
    // الانتقال التلقائي إلى القصص إذا كان الرابط يحتوي ?go=stories
    if (window.location.search.includes('go=stories')) {
        history.replaceState(null, '', window.location.pathname);
        switchToStoriesScreen();
    }
    
    console.log('✅ التطبيق جاهز');
});