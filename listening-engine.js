// ============ listening-engine.js ============
// المحرك الكامل لقسم الاستماع - جميع الأزرار متصلة وتعمل

var currentQuestions = [];
var currentIndex = 0;
var correctAnswers = 0;
var totalAnswered = 0;
var userAnswers = [];
var progressInterval = null;
var audioEndedTimeout = null;
var repeatCount = 0;

// ============ التنقل ============
function goToHome() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (progressInterval) clearInterval(progressInterval);
    if (audioEndedTimeout) clearTimeout(audioEndedTimeout);
    window.location.href = 'index.html';
}

function goBackToMain() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (progressInterval) clearInterval(progressInterval);
    if (audioEndedTimeout) clearTimeout(audioEndedTimeout);
    document.getElementById('practiceScreen').classList.remove('active');
    document.getElementById('completionScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'flex';
    document.getElementById('playBtn').classList.remove('playing');
    document.getElementById('playBtn').innerHTML = '▶️';
    document.getElementById('audioProgress').style.width = '0%';
}

// ============ النطق ============
function speakText(text) {
    if (!('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.72;
    u.pitch = 1.0;
    u.volume = 1.0;
    var voices = window.speechSynthesis.getVoices();
    var kv = voices.find(function(v) { return v.lang.indexOf('ko') === 0; });
    if (kv) u.voice = kv;
    window.speechSynthesis.speak(u);
    return true;
}

function toggleAudio() {
    if (!currentQuestions.length) return;
    var q = currentQuestions[currentIndex];
    var btn = document.getElementById('playBtn');
    
    if (btn.classList.contains('playing')) {
        // إيقاف مؤقت
        window.speechSynthesis.cancel();
        btn.classList.remove('playing');
        btn.innerHTML = '▶️';
        if (progressInterval) clearInterval(progressInterval);
        if (audioEndedTimeout) clearTimeout(audioEndedTimeout);
        return;
    }
    
    // بدء التشغيل
    btn.classList.add('playing');
    btn.innerHTML = '⏸';
    repeatCount = 0;
    speakText(q.script);
    
    var bar = document.getElementById('audioProgress');
    bar.style.width = '0%';
    var estimatedTime = Math.max(3000, q.script.length * 45);
    var startTime = Date.now();
    var pausedTime = 0;
    
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(function() {
        var elapsed = Date.now() - startTime - pausedTime;
        var percent = Math.min(100, (elapsed / estimatedTime) * 100);
        bar.style.width = percent + '%';
        
        if (!window.speechSynthesis.speaking && percent < 90) {
            pausedTime += 100;
        }
    }, 100);
    
    // عند انتهاء الصوت
    if (audioEndedTimeout) clearTimeout(audioEndedTimeout);
    audioEndedTimeout = setTimeout(function() {
        btn.classList.remove('playing');
        btn.innerHTML = '▶️';
        bar.style.width = '100%';
        if (progressInterval) clearInterval(progressInterval);
        setTimeout(function() { bar.style.width = '0%'; }, 800);
    }, estimatedTime + 2000);
}

function repeatAudio() {
    if (!currentQuestions.length) return;
    if (repeatCount >= 2) {
        showToast('⚠️ يمكنك إعادة الاستماع مرتين فقط كما في الامتحان الحقيقي');
        return;
    }
    repeatCount++;
    document.getElementById('audioProgress').style.width = '0%';
    document.getElementById('playBtn').classList.remove('playing');
    document.getElementById('playBtn').innerHTML = '▶️';
    if (progressInterval) clearInterval(progressInterval);
    if (audioEndedTimeout) clearTimeout(audioEndedTimeout);
    toggleAudio();
    showToast('🔄 جارٍ إعادة الاستماع (' + repeatCount + '/2)');
}

// ============ إدارة الأسئلة ============
function startPractice(category) {
    currentQuestions = listeningData[category].questions;
    currentIndex = 0;
    correctAnswers = 0;
    totalAnswered = 0;
    repeatCount = 0;
    userAnswers = new Array(currentQuestions.length).fill(-1);
    
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('practiceScreen').classList.add('active');
    document.getElementById('completionScreen').style.display = 'none';
    document.getElementById('completionScreen').classList.remove('active');
    
    renderQuestion();
}

function getQuestionType(q) {
    // تحديد نوع السؤال لعرض تلميح مناسب
    var t = q.question;
    if (t.indexOf('장소') !== -1 || t.indexOf('곳') !== -1 || t.indexOf('장면') !== -1) return '📍 هذا السؤال عن <strong>المكان أو الموقف</strong> - ركز على أسماء الأماكن والكلمات الدالة على الموقع';
    if (t.indexOf('주제') !== -1 || t.indexOf('내용') !== -1) return '📌 هذا السؤال عن <strong>الموضوع الرئيسي</strong> - استمع للفكرة العامة وليس التفاصيل الصغيرة';
    if (t.indexOf('행동') !== -1 || t.indexOf('하려는') !== -1) return '🏃 هذا السؤال عن <strong>الإجراء أو التصرف</strong> - ركز على أفعال الحركة والنوايا';
    if (t.indexOf('그래프') !== -1) return '📊 هذا السؤال عن <strong>الرسم البياني</strong> - استمع للأرقام والنسب المئوية والاتجاهات (증가/감소)';
    if (t.indexOf('주장') !== -1 || t.indexOf('의견') !== -1) return '💬 هذا السؤال عن <strong>الرأي أو الموقف</strong> - ركز على جمل الرأي مثل ~해야 한다, ~것 같다';
    if (t.indexOf('이유') !== -1 || t.indexOf('원인') !== -1) return '🔍 هذا السؤال عن <strong>السبب</strong> - استمع لكلمات مثل 때문에, ~아서/어서, ~(으)니까';
    return '✅ <strong>اختيار من متعدد</strong> - اقرأ الخيارات قبل الاستماع وركز على الكلمات المتشابهة';
}

function renderQuestion() {
    if (currentIndex >= currentQuestions.length) {
        showCompletion();
        return;
    }
    
    var q = currentQuestions[currentIndex];
    document.getElementById('questionCounter').textContent = (currentIndex + 1) + '/' + currentQuestions.length;
    document.getElementById('questionText').textContent = q.question;
    document.getElementById('correctCount').textContent = correctAnswers;
    document.getElementById('totalAnswered').textContent = totalAnswered;
    document.getElementById('explanationBox').classList.remove('show');
    document.getElementById('explanationBox').textContent = '';
    
    // عرض تلميح نوع السؤال
    var tipEl = document.getElementById('questionTypeTip');
    tipEl.innerHTML = '💡 ' + getQuestionType(q);
    tipEl.style.display = 'block';
    
    var optsHtml = '';
    q.options.forEach(function(opt, i) {
        var cls = 'option-btn';
        if (userAnswers[currentIndex] === i) cls += ' selected locked';
        if (userAnswers[currentIndex] !== -1 && i === q.answer) cls += ' correct locked';
        if (userAnswers[currentIndex] !== -1 && i !== q.answer && userAnswers[currentIndex] === i) cls += ' wrong locked';
        optsHtml += '<div class="' + cls + '" onclick="selectAnswer(' + i + ')">' + opt + '</div>';
    });
    document.getElementById('optionsGrid').innerHTML = optsHtml;
    
    document.getElementById('prevBtn').style.display = currentIndex > 0 ? 'inline-flex' : 'none';
    document.getElementById('nextBtn').textContent = currentIndex >= currentQuestions.length - 1 ? '✅ إنهاء' : 'التالي ➡️';
    document.getElementById('showAnswerBtn').style.display = userAnswers[currentIndex] !== -1 ? 'inline-flex' : 'none';
    
    // إعادة ضبط شريط الصوت
    document.getElementById('audioProgress').style.width = '0%';
    document.getElementById('playBtn').classList.remove('playing');
    document.getElementById('playBtn').innerHTML = '▶️';
    if (progressInterval) clearInterval(progressInterval);
    if (audioEndedTimeout) clearTimeout(audioEndedTimeout);
    repeatCount = 0;
    
    // تشغيل الصوت تلقائياً بعد تأخير قصير
    setTimeout(function() { toggleAudio(); }, 500);
}

function selectAnswer(index) {
    if (userAnswers[currentIndex] !== -1) return;
    var q = currentQuestions[currentIndex];
    userAnswers[currentIndex] = index;
    totalAnswered++;
    
    if (index === q.answer) {
        correctAnswers++;
        showToast('✅ إجابة صحيحة! أحسنت');
    } else {
        showToast('❌ الإجابة الصحيحة: ' + q.options[q.answer]);
    }
    
    document.getElementById('correctCount').textContent = correctAnswers;
    document.getElementById('totalAnswered').textContent = totalAnswered;
    document.getElementById('showAnswerBtn').style.display = 'inline-flex';
    renderQuestion();
}

function showAnswer() {
    var q = currentQuestions[currentIndex];
    var box = document.getElementById('explanationBox');
    box.innerHTML = '<strong>🔑 الإجابة الصحيحة:</strong> ' + q.options[q.answer] +
                    '<br><strong>📝 الشرح:</strong> ' + (q.explanation || 'لا يوجد شرح إضافي') +
                    '<br><strong>📖 النص الكامل:</strong><br><span style="font-family:\'Noto Sans KR\';direction:ltr;display:inline-block;text-align:left;">' + q.script.replace(/\n/g, '<br>') + '</span>';
    box.classList.add('show');
}

function nextQuestion() {
    if (currentIndex < currentQuestions.length - 1) {
        currentIndex++;
        renderQuestion();
    } else {
        showCompletion();
    }
}

function prevQuestion() {
    if (currentIndex > 0) {
        currentIndex--;
        renderQuestion();
    }
}

function showCompletion() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (progressInterval) clearInterval(progressInterval);
    if (audioEndedTimeout) clearTimeout(audioEndedTimeout);
    
    document.getElementById('completionScreen').style.display = 'block';
    document.getElementById('completionScreen').classList.add('active');
    document.getElementById('completionScore').textContent = correctAnswers + ' / ' + currentQuestions.length;
    
    var percent = Math.round((correctAnswers / currentQuestions.length) * 100);
    var emoji = percent >= 90 ? '🌟' : percent >= 70 ? '🎉' : percent >= 50 ? '💪' : '📚';
    document.getElementById('completionEmoji').textContent = emoji;
    
    document.getElementById('questionTypeTip').style.display = 'none';
}

function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
}