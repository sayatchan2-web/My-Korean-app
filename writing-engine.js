// ============================================
// writing-engine.js - المحرك الكامل لقسم الكتابة
// يدعم: 4 مستويات | تقييم ذكي | ترجمة عند النقر
// ============================================

// ============ نظام التقييم ============
class AIGrader {
    constructor() {
        this.positivePatterns = {
            structure: ['첫째', '둘째', '셋째', '먼저', '다음으로', '또한', '마지막으로'],
            conclusion: ['결론적으로', '요약하면', '따라서', '그러므로'],
            analysis: ['증가했다', '감소했다', '늘어났다', '줄어들었다', '원인은', '때문이다', '영향을', '나타났다'],
            opinion: ['필요하다', '중요하다', '해야 한다', '바람직하다', '노력해야']
        };
        
        this.styleNotes = [
            { pattern: /습니다|ㅂ니다/g, note: '💡 تلميح: في الكتابة الأكاديمية، يُفضل استخدام ㄴ/는다 بدلاً من 습니다' },
            { pattern: /아요|어요|해요/g, note: '💡 تلميح: تجنب صيغة 요 في الكتابة الرسمية' }
        ];
    }
    
    grade(userAnswer, questionData, questionType) {
        const results = {};
        let totalScore = 0;
        
        const charScore = this.evaluateCharCount(userAnswer, questionData);
        results.charCount = charScore;
        totalScore += charScore * 0.20;
        
        const contentScore = this.evaluateContent(userAnswer, questionType);
        results.content = contentScore;
        totalScore += contentScore * 0.30;
        
        const structureScore = this.evaluateStructure(userAnswer, questionType);
        results.structure = structureScore;
        totalScore += structureScore * 0.25;
        
        const formatScore = this.evaluateFormat(userAnswer);
        results.format = formatScore;
        totalScore += formatScore * 0.15;
        
        const vocabScore = this.evaluateVocab(userAnswer);
        results.vocab = vocabScore;
        totalScore += vocabScore * 0.10;
        
        const generatedFeedback = this.generateFeedback(results, userAnswer, questionData);
        const notes = [];
        this.styleNotes.forEach(sn => {
            if (sn.pattern.test(userAnswer)) notes.push(sn.note);
        });
        
        return {
            totalScore: Math.round(totalScore * 10) / 10,
            maxScore: 10,
            details: results,
            feedback: generatedFeedback,
            notes: notes,
            grade: this.getGrade(totalScore)
        };
    }
    
    evaluateCharCount(text, questionData) {
        if (!text || text.length === 0) return 0;
        const charCount = (text || '').replace(/[\s\n]/g, '').length;
        const min = questionData.minChars || 0;
        const max = questionData.maxChars || 9999;
        if (charCount < min * 0.5) return 0;
        if (charCount < min * 0.75) return 3;
        if (charCount < min) return 5;
        if (charCount <= max) return 10;
        if (charCount <= max * 1.2) return 7;
        return 4;
    }
    
    evaluateContent(text, questionType) {
        if (!text || text.length < 10) return 0;
        let score = 3;
        const allPatterns = [...this.positivePatterns.analysis, ...this.positivePatterns.opinion];
        const foundPatterns = new Set();
        allPatterns.forEach(p => { if (text.includes(p)) foundPatterns.add(p); });
        const diversity = foundPatterns.size;
        if (diversity >= 8) score += 5;
        else if (diversity >= 6) score += 4;
        else if (diversity >= 4) score += 3;
        else if (diversity >= 2) score += 2;
        const repetitionPenalty = this.checkRepetition(text);
        score -= repetitionPenalty;
        return Math.max(0, Math.min(10, score));
    }
    
    checkRepetition(text) {
        const words = text.split(/\s+/);
        const wordCount = {};
        words.forEach(w => { const clean = w.replace(/[.,!?]/g, ''); if (clean.length > 1) wordCount[clean] = (wordCount[clean] || 0) + 1; });
        let penalty = 0;
        Object.values(wordCount).forEach(count => { if (count > words.length * 0.3) penalty += 3; else if (count > words.length * 0.2) penalty += 1; });
        return Math.min(5, penalty);
    }
    
    evaluateStructure(text, questionType) {
        if (!text || text.length < 20) return 0;
        let score = 4;
        if (/최근|오늘날|현대|일반적|많은 사람|사회/.test(text)) score += 2;
        const structureCount = this.positivePatterns.structure.filter(p => text.includes(p)).length;
        score += Math.min(3, structureCount * 0.75);
        if (this.positivePatterns.conclusion.some(p => text.includes(p))) score += 1;
        return Math.min(10, score);
    }
    
    evaluateFormat(text) {
        if (!text) return 0;
        let score = 7;
        if (!/[.!?]$/.test(text.trim())) score -= 2;
        if (!/\s/.test(text) && text.length > 30) score -= 2;
        const sentences = text.split(/[.!?]/).filter(s => s.trim());
        if (sentences.length < 2 && text.length > 50) score -= 2;
        return Math.max(0, Math.min(10, score));
    }
    
    evaluateVocab(text) {
        if (!text || text.length < 20) return 0;
        const words = text.split(/\s+/).map(w => w.replace(/[.,!?]/g, ''));
        const uniqueWords = new Set(words.filter(w => w.length > 1));
        if (uniqueWords.size >= 30) return 10;
        if (uniqueWords.size >= 20) return 8;
        if (uniqueWords.size >= 15) return 6;
        if (uniqueWords.size >= 10) return 4;
        return 2;
    }
    
    generateFeedback(results, text, questionData) {
        const fb = [];
        const charCount = (text || '').replace(/[\s\n]/g, '').length;
        const min = questionData.minChars || 0;
        const max = questionData.maxChars || 9999;
        if (charCount < min * 0.5) fb.push('⚠️ النص قصير جداً. اكتب ' + min + ' حرف على الأقل (الحالي: ' + charCount + ')');
        else if (charCount < min) fb.push('📝 اقتربت من الحد الأدنى (الحالي: ' + charCount + '/' + min + ')');
        else if (charCount > max * 1.2) fb.push('⚠️ تجاوزت الحد المسموح. اختصر (الحالي: ' + charCount + '/' + max + ')');
        else if (charCount > max) fb.push('📝 تجاوزت الحد قليلاً (الحالي: ' + charCount + '/' + max + ')');
        else fb.push('✅ عدد الأحرف ممتاز (' + charCount + '/' + max + ')');
        if (results.content < 5) fb.push('📚 حاول استخدام مفردات وتعبيرات أكثر تنوعاً');
        if (results.structure < 5) fb.push('📋 نظم النص باستخدام: 첫째, 둘째, 결론적으로');
        if (results.format < 5) fb.push('📝 تأكد من استخدام علامات الترقيم والمسافات');
        if (fb.length <= 1) fb.push('🎉 عمل رائع! استمر في التقدم');
        return fb;
    }
    
    getGrade(score) {
        if (score >= 9) return { letter: 'A+', emoji: '🌟', text: 'ممتاز' };
        if (score >= 8) return { letter: 'A', emoji: '🎉', text: 'جيد جداً' };
        if (score >= 7) return { letter: 'B+', emoji: '👍', text: 'جيد' };
        if (score >= 5) return { letter: 'B', emoji: '💪', text: 'مقبول' };
        return { letter: 'C', emoji: '📚', text: 'يحتاج تحسين' };
    }
}

const aiGrader = new AIGrader();

// ============ مؤشرات التنقل ============
let currentLessonIndex = 0;
let currentQ51Index = 0;
let currentQ53Index = 0;
let currentQ54Index = 0;
let currentLevel = '';

// ============ دوال المساعدة ============
function countChars(text) { return (text || '').replace(/[\s\n]/g, '').length; }
function normalizeText(text) { return (text || '').replace(/\s+/g, '').trim(); }

function updateCharCount(textareaId) {
    var textarea = document.getElementById(textareaId);
    if (!textarea) return;
    var countEl = document.getElementById(textareaId.replace('Textarea', 'CharCount'));
    if (countEl) countEl.textContent = (textarea.value || '').replace(/[\s\n]/g, '').length + ' حرف';
}

function showToast(msg) {
    var t = document.getElementById('toast'); 
    t.textContent = msg; 
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
}

// ============ دوال التنقل الرئيسية ============
function goToHome() { window.location.href = 'index.html'; }

function openLevel(level) {
    document.getElementById('mainScreen').style.display = 'none';
    document.querySelectorAll('.level-screen').forEach(function(s) { s.classList.remove('active'); });
    
    currentLevel = level;
    
    var levelNum = level.slice(-1);
    var screenId = 'levelLevel' + levelNum;
    var screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
    
    if (levelNum === '1' || levelNum === '2' || levelNum === '3') {
        currentLessonIndex = 0;
        loadLessonContent();
    } else if (levelNum === '4') {
        currentQ51Index = 0;
        loadQ51Content();
    }
}

function goBackToMain() {
    document.querySelectorAll('.level-screen').forEach(function(s) { s.classList.remove('active'); });
    document.getElementById('mainScreen').style.display = 'flex';
}

// ============ تحميل الدروس (level 1, 2, 3) ============
function loadLessonContent() {
    var data = topikExams[currentLevel];
    var lesson = data.lessons[currentLessonIndex];
    var container = document.getElementById(currentLevel + 'Content');
    if (!container) return;
    
    var html = '<p style="color:var(--text-light);">' + data.subtitle + '</p>';
    html += '<h3 style="color:var(--accent-dark);">📖 ' + lesson.title + '</h3>';
    html += '<p style="font-weight:700;color:var(--text);">' + lesson.rule + '</p>';
    
    // عرض الأمثلة
    if (lesson.examples && lesson.examples.length > 0) {
        lesson.examples.forEach(function(ex) {
            html += '<div style="background:rgba(243,232,255,0.5);padding:12px;border-radius:12px;margin-bottom:8px;">';
            var displayText = '';
            if (ex.casual && ex.academic) displayText = ex.casual + ' → ' + ex.academic;
            else if (ex.messy && ex.clean) displayText = ex.clean;
            else if (ex.basic && ex.better) displayText = ex.better;
            else if (ex.everyday && ex.academic) displayText = ex.everyday + ' → ' + ex.academic;
            else displayText = ex.academic || ex.clean || ex.better || '';
            
            if (currentLevel === 'level3') {
                // في المستوى الثالث: عرض الكوري مع إمكانية النقر للترجمة
                html += '<p style="font-family:\'Noto Sans KR\';font-size:14px;" class="kr-clickable" onclick="showKRTranslation(this, \'' + (ex.note || ex.description || '') + '\')">' + displayText + '</p>';
            } else {
                html += '<p style="font-family:\'Noto Sans KR\';font-size:14px;">' + displayText + '</p>';
            }
            if (ex.note && currentLevel !== 'level3') html += '<p style="font-size:11px;color:var(--text-light);">' + ex.note + '</p>';
            html += '</div>';
        });
    }
    
    if (lesson.keyTakeaway) {
        html += '<p style="font-weight:700;color:var(--accent-dark);margin-top:12px;">💡 ' + lesson.keyTakeaway + '</p>';
    }
    
    // عرض التدريبات
    if (lesson.miniTest && lesson.miniTest.length > 0) {
        html += '<h4 style="margin-top:12px;">✏️ تدريب سريع:</h4>';
        lesson.miniTest.forEach(function(item, i) {
            if (!item) return;
            html += '<div class="practice-row">';
            html += '<span style="font-weight:700;">' + (i+1) + '.</span>';
            html += '<span style="font-size:12px;">' + item.prompt + '</span>';
            html += '<input type="text" class="practice-input" data-answer="' + item.answer + '" placeholder="اكتب...">';
            html += '<span class="practice-result-icon" style="font-size:16px;"></span>';
            html += '</div>';
        });
        html += '<div class="correction-box" id="lessonCorrection"></div>';
        html += '<div class="btn-group">';
        html += '<button class="btn btn-primary" onclick="checkLesson()">✅ تحقق</button>';
        html += '<button class="btn btn-info" onclick="showLessonAnswers()">🔑 الإجابات الصحيحة</button>';
        html += '</div>';
    } else {
        html += '<div style="background:var(--info-bg);padding:12px;border-radius:12px;margin-top:12px;">';
        html += '<p style="color:var(--info);font-weight:700;">📖 هذا درس نظري. لا توجد تمارين عملية فيه.</p>';
        html += '<p style="font-size:11px;color:var(--text-light);">استوعب القاعدة جيداً ثم انتقل للدرس التالي أو للمستوى الرابع للتطبيق.</p>';
        html += '</div>';
    }
    
    container.innerHTML = html;
    updateLessonNav();
}

function updateLessonNav() {
    var nav = document.getElementById(currentLevel + 'Nav');
    if (!nav) return;
    var total = topikExams[currentLevel].lessons.length;
    var html = '';
    if (currentLessonIndex > 0) html += '<button class="btn btn-secondary" onclick="currentLessonIndex--;loadLessonContent()">⬅️ السابق</button>';
    else html += '<span></span>';
    html += '<span style="font-size:11px;color:var(--text-light);">' + (currentLessonIndex+1) + '/' + total + '</span>';
    if (currentLessonIndex < total - 1) html += '<button class="btn btn-primary" onclick="currentLessonIndex++;loadLessonContent()">التالي ➡️</button>';
    else html += '<span></span>';
    nav.innerHTML = html;
}

// ============ دالة ترجمة الكورية عند النقر (للمستوى الثالث) ============
function showKRTranslation(element, arabicText) {
    if (!arabicText || arabicText.length < 2) return;
    
    var existingPopup = document.querySelector('.kr-translation-popup');
    if (existingPopup) existingPopup.remove();
    
    var popup = document.createElement('div');
    popup.className = 'kr-translation-popup';
    popup.innerHTML = '<div class="popup-close" onclick="this.parentElement.remove()">✕</div>' +
                      '<div style="font-weight:900;margin-bottom:8px;color:var(--accent-dark);">📖 الترجمة العربية</div>' +
                      '<div style="color:var(--text);font-weight:700;line-height:1.8;">🇸🇦 ' + arabicText + '</div>';
    
    document.body.appendChild(popup);
    
    setTimeout(function() {
        document.addEventListener('click', function closePopup(e) {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', closePopup);
            }
        });
    }, 100);
}

// ============ التحقق من الإجابات ============
function checkLesson() {
    var inputs = document.querySelectorAll('#' + currentLevel + 'Content .practice-input');
    var box = document.getElementById('lessonCorrection');
    if (!box) return;
    
    var html = '';
    var totalQuestions = inputs.length;
    var correctCount = 0;
    var unansweredCount = 0;
    
    inputs.forEach(function(inp) {
        var ans = normalizeText(inp.dataset.answer);
        var user = normalizeText(inp.value);
        var icon = inp.nextElementSibling;
        
        if (!user || user.length === 0) {
            if (icon) { icon.textContent = '⚠️'; icon.style.color = 'var(--warning)'; }
            inp.style.borderColor = 'var(--warning)';
            inp.style.background = 'var(--warning-bg)';
            unansweredCount++;
        } else if (user === ans) {
            if (icon) { icon.textContent = '✅'; icon.style.color = 'var(--correct)'; }
            inp.style.borderColor = 'var(--correct)';
            inp.style.background = 'var(--correct-bg)';
            correctCount++;
        } else {
            if (icon) { icon.textContent = '❌'; icon.style.color = 'var(--wrong)'; }
            inp.style.borderColor = 'var(--wrong)';
            inp.style.background = 'var(--wrong-bg)';
            html += '<div class="correction-item"><span class="wrong-text">' + (inp.value.trim() || 'فارغ') + '</span> <span>→</span> <span class="correct-text">' + inp.dataset.answer + '</span></div>';
        }
    });
    
    if (unansweredCount === totalQuestions) {
        box.innerHTML = '<p style="color:var(--warning);font-weight:700;">⚠️ جميع الحقول فارغة. اكتب إجاباتك أولاً.</p>';
    } else if (correctCount === totalQuestions) {
        box.innerHTML = '<p style="color:var(--correct);font-weight:700;">✅ ممتاز! جميع الإجابات صحيحة (' + correctCount + '/' + totalQuestions + ')</p>';
        showToast('🌟 أحسنت! ' + correctCount + '/' + totalQuestions);
    } else {
        var summary = '';
        if (correctCount > 0) summary += '✅ صحيح: ' + correctCount + ' | ';
        if (unansweredCount > 0) summary += '⚠️ فارغ: ' + unansweredCount + ' | ';
        summary += '❌ خطأ: ' + (totalQuestions - correctCount - unansweredCount);
        box.innerHTML = '<p style="font-weight:700;margin-bottom:6px;">📊 ' + summary + '</p><p style="font-weight:700;">❌ التصحيحات:</p>' + html;
    }
    
    box.classList.add('show');
}

function showLessonAnswers() {
    var inputs = document.querySelectorAll('#' + currentLevel + 'Content .practice-input');
    var box = document.getElementById('lessonCorrection');
    if (!box) return;
    
    var html = '<p style="font-weight:700;color:var(--accent-dark);margin-bottom:8px;">🔑 جميع الإجابات الصحيحة:</p>';
    
    inputs.forEach(function(inp, i) {
        var ans = inp.dataset.answer;
        html += '<div class="correction-item">';
        html += '<span style="font-weight:700;">' + (i+1) + '.</span>';
        html += '<span style="font-family:\'Noto Sans KR\';color:var(--correct);font-weight:700;">' + ans + '</span>';
        html += '</div>';
    });
    
    box.innerHTML = html;
    box.classList.add('show');
    showToast('🔑 تم إظهار جميع الإجابات الصحيحة');
}

// ============ المستوى 4: السؤال 51-52 ============
function loadQ51Content() {
    var section = topikExams.level4.sections.q51_52;
    var q = section.questions[currentQ51Index];
    var container = document.getElementById('level4Content');
    if (!container) return;
    
    var html = '<p style="color:var(--text-light);">' + section.description + '</p>';
    
    html += '<div style="background:rgba(243,232,255,0.6);padding:14px;border-radius:12px;margin-bottom:10px;">';
    html += '<h3 style="margin-bottom:4px;">📩 السؤال 51-52: الإكمال السريع</h3>';
    html += '<p style="font-size:11px;color:var(--text-light);">' + (q.year || '') + ' | 10 نقاط | الوقت المقترح: 5 دقائق</p>';
    html += '<p style="font-size:10px;color:var(--warning);margin-top:4px;">⚠️ انتبه لمستوى الاحترام المناسب للسياق. الرسائل الشخصية تستخدم أسلوباً مختلفاً عن الإعلانات الرسمية.</p>';
    html += '</div>';
    
    html += '<p style="font-size:12px;font-weight:700;">' + (q.context || '') + '</p>';
    html += '<div class="question-text" style="font-family:\'Noto Sans KR\';">' + q.text + '</div>';
    
    q.blanks.forEach(function(b) {
        html += '<div style="margin-top:10px;"><strong>' + b.id + ':</strong>';
        html += '<input type="text" class="practice-input blank-input-q51" style="width:100%;margin-top:4px;" placeholder="اكتب...">';
        html += '<button class="btn btn-hint" style="margin-top:4px;" onclick="this.style.display=\'none\';this.nextElementSibling.style.display=\'inline\'">💡 تلميح</button>';
        html += '<span style="display:none;color:var(--info);font-size:11px;">' + (b.goodAnswers ? b.goodAnswers[0] : '') + '</span>';
        html += '</div>';
    });
    
    html += '<div class="btn-group">';
    html += '<button class="btn btn-primary" onclick="checkQ51()">✅ تحقق</button>';
    html += '<button class="btn btn-info" onclick="showQ51Answers()">🔑 الإجابات الصحيحة</button>';
    html += '</div>';
    html += '<div class="correction-box" id="q51Correction"></div>';
    
    container.innerHTML = html;
    updateQ51Nav();
}

function updateQ51Nav() {
    var nav = document.getElementById('level4Nav');
    if (!nav) return;
    var total = topikExams.level4.sections.q51_52.questions.length;
    var html = '';
    html += '<span style="font-size:11px;">📩 51-52: ' + (currentQ51Index+1) + '/' + total + '</span>';
    if (currentQ51Index > 0) html += '<button class="btn btn-secondary" onclick="currentQ51Index--;loadQ51Content()">⬅️</button>';
    if (currentQ51Index < total - 1) html += '<button class="btn btn-primary" onclick="currentQ51Index++;loadQ51Content()">➡️</button>';
    else html += '<button class="btn btn-primary" onclick="loadQ53Content()">📊 سؤال 53 ←</button>';
    nav.innerHTML = html;
}

function checkQ51() {
    var q = topikExams.level4.sections.q51_52.questions[currentQ51Index];
    var inputs = document.querySelectorAll('.blank-input-q51');
    var box = document.getElementById('q51Correction');
    if (!box) return;
    
    var html = '';
    var totalBlanks = inputs.length;
    var correctCount = 0;
    var unansweredCount = 0;
    
    inputs.forEach(function(inp, i) {
        var user = normalizeText(inp.value);
        var acceptable = q.blanks[i].goodAnswers || [];
        
        if (!user || user.length === 0) {
            inp.style.borderColor = 'var(--warning)';
            inp.style.background = 'var(--warning-bg)';
            unansweredCount++;
        } else {
            var ok = acceptable.some(function(c) {
                var normC = normalizeText(c);
                return user === normC || user.includes(normC) || normC.includes(user);
            });
            if (ok) {
                inp.style.borderColor = 'var(--correct)';
                inp.style.background = 'var(--correct-bg)';
                correctCount++;
            } else {
                inp.style.borderColor = 'var(--wrong)';
                inp.style.background = 'var(--wrong-bg)';
                html += '<div class="correction-item"><span class="wrong-text">' + (inp.value.trim() || 'فارغ') + '</span> <span>→</span> <span class="correct-text">' + (acceptable[0]||'') + '</span></div>';
            }
        }
    });
    
    if (unansweredCount === totalBlanks) {
        box.innerHTML = '<p style="color:var(--warning);font-weight:700;">⚠️ لم تجب على أي فراغ. اكتب إجاباتك أولاً.</p>';
    } else if (correctCount === totalBlanks) {
        box.innerHTML = '<p style="color:var(--correct);font-weight:700;">✅ ممتاز! جميع الإجابات صحيحة</p>';
        showToast('🌟 إجابات صحيحة!');
    } else {
        var summary = '✅ صحيح: ' + correctCount + '/' + totalBlanks;
        if (unansweredCount > 0) summary += ' | ⚠️ فارغ: ' + unansweredCount;
        box.innerHTML = '<p style="font-weight:700;margin-bottom:6px;">📊 ' + summary + '</p><p style="font-weight:700;">❌ التصحيحات:</p>' + html;
    }
    
    box.classList.add('show');
}

function showQ51Answers() {
    var q = topikExams.level4.sections.q51_52.questions[currentQ51Index];
    var box = document.getElementById('q51Correction');
    if (!box) return;
    
    var html = '<p style="font-weight:700;color:var(--accent-dark);margin-bottom:8px;">🔑 الإجابات الصحيحة المقبولة:</p>';
    
    q.blanks.forEach(function(b, i) {
        var answers = b.goodAnswers || [];
        html += '<div class="correction-item">';
        html += '<span style="font-weight:700;">' + b.id + ':</span>';
        html += '<span style="font-family:\'Noto Sans KR\';color:var(--correct);font-weight:700;">' + answers.join(' / ') + '</span>';
        html += '</div>';
    });
    
    box.innerHTML = html;
    box.classList.add('show');
    showToast('🔑 تم إظهار الإجابات المقبولة');
}

// ============ المستوى 4: السؤال 53 ============
function loadQ53Content() {
    var section = topikExams.level4.sections.q53;
    var q = section.questions[currentQ53Index];
    var container = document.getElementById('level4Content');
    if (!container) return;
    
    var html = '<p style="color:var(--text-light);">' + section.description + '</p>';
    
    html += '<div style="background:rgba(243,232,255,0.6);padding:14px;border-radius:12px;margin-bottom:10px;">';
    html += '<h3 style="margin-bottom:4px;">📊 السؤال 53 - تحليل البيانات</h3>';
    html += '<p style="font-size:11px;color:var(--text-light);">30 نقطة | الوقت المقترح: 15 دقيقة | ' + q.minChars + '-' + q.maxChars + ' حرف</p>';
    html += '<p style="font-size:10px;color:var(--warning);margin-top:4px;">⚠️ هام: لا تكتب رأيك الشخصي. فقط صف البيانات. استخدم: 살펴보면, 증가했다/감소했다, 때문인 것으로 분석된다, 알 수 있다.</p>';
    html += '</div>';
    
    html += '<p style="margin-bottom:8px;font-weight:700;">' + q.context + '</p>';
    
    if (q.chartData) {
        html += '<div style="background:rgba(243,232,255,0.5);padding:12px;border-radius:12px;margin-bottom:10px;"><strong>📈 ' + q.chartData.title + '</strong><div id="chartDisplay" style="margin-top:8px;"></div></div>';
    }
    
    html += '<textarea class="wongoji-textarea" id="q53Textarea" placeholder="اكتب هنا (' + q.minChars + '-' + q.maxChars + ' حرف)..."></textarea>';
    html += '<p class="char-count" id="q53CharCount">0 حرف</p>';
    html += '<div class="btn-group">';
    html += '<button class="btn btn-primary" onclick="evaluateQ53()">📊 تقييم</button>';
    html += '<button class="btn btn-info" onclick="document.getElementById(\'q53Sample\').style.display=\'block\'">📝 نموذج الإجابة</button>';
    html += '</div>';
    html += '<div id="q53Sample" style="display:none;margin-top:10px;padding:12px;background:var(--correct-bg);border-radius:12px;border:1px solid var(--correct);"><strong>📝 نموذج الإجابة الصحيحة:</strong><p style="font-family:\'Noto Sans KR\';margin-top:6px;line-height:1.8;">' + q.modelAnswer + '</p></div>';
    html += '<div class="grading-result" id="q53Result"></div>';
    
    container.innerHTML = html;
    if (q.chartData) renderChart(q.chartData);
    
    var ta = document.getElementById('q53Textarea');
    if (ta) {
        ta.addEventListener('input', function() {
            var ce = document.getElementById('q53CharCount');
            if (ce) ce.textContent = countChars(this.value) + ' حرف';
        });
    }
    
    updateQ53Nav();
}

function updateQ53Nav() {
    var nav = document.getElementById('level4Nav');
    if (!nav) return;
    var total = topikExams.level4.sections.q53.questions.length;
    var html = '<button class="btn btn-secondary" onclick="loadQ51Content()">⬅️ 51-52</button>';
    html += '<span style="font-size:11px;">📊 53: ' + (currentQ53Index+1) + '/' + total + '</span>';
    if (currentQ53Index < total - 1) html += '<button class="btn btn-primary" onclick="currentQ53Index++;loadQ53Content()">➡️</button>';
    else html += '<button class="btn btn-primary" onclick="loadQ54Content()">📝 سؤال 54 ←</button>';
    nav.innerHTML = html;
}

function evaluateQ53() {
    var ta = document.getElementById('q53Textarea'); 
    if (!ta) return;
    var user = ta.value.trim();
    
    if (!user || user.length === 0) {
        showToast('⚠️ اكتب شيئاً أولاً قبل التقييم');
        return;
    }
    
    var q = topikExams.level4.sections.q53.questions[currentQ53Index];
    var result = aiGrader.grade(user, { minChars: q.minChars, maxChars: q.maxChars }, 53);
    var div = document.getElementById('q53Result');
    if (!div) return;
    
    var html = '<div class="grade-score">' + result.grade.emoji + ' ' + result.totalScore + '/10</div>';
    html += '<p style="text-align:center;">' + result.grade.text + '</p>';
    html += '<div class="grade-details">';
    var labels = {charCount:'📏 عدد الأحرف', content:'📝 المحتوى', structure:'🏗️ البنية', format:'📋 التنسيق', vocab:'📚 المفردات'};
    Object.entries(result.details).forEach(function(e) { 
        html += '<div class="grade-item"><div class="label">' + (labels[e[0]]||e[0]) + '</div><div class="value">' + e[1] + '/10</div></div>'; 
    });
    html += '</div>';
    result.feedback.forEach(function(f) { html += '<p style="font-size:11px;">' + f + '</p>'; });
    div.innerHTML = html; 
    div.classList.add('show'); 
    showToast('📊 تم التقييم!');
}

// ============ المستوى 4: السؤال 54 ============
function loadQ54Content() {
    var section = topikExams.level4.sections.q54;
    var q = section.questions[currentQ54Index];
    var container = document.getElementById('level4Content');
    if (!container) return;
    
    var html = '<p style="color:var(--text-light);">' + section.description + '</p>';
    
    html += '<div style="background:rgba(243,232,255,0.6);padding:14px;border-radius:12px;margin-bottom:10px;">';
    html += '<h3 style="margin-bottom:4px;">📝 السؤال 54 - المقال التحليلي</h3>';
    html += '<p style="font-size:11px;color:var(--text-light);">50 نقطة | الوقت المقترح: 30 دقيقة | ' + q.minChars + '-' + q.maxChars + ' حرف</p>';
    html += '<p style="font-size:10px;color:var(--warning);margin-top:4px;">⚠️ هام: نظّم مقالك في مقدمة + عرض (첫째/둘째/셋째) + خاتمة (결론적으로). استخدم المفردات الأكاديمية. أجب على جميع الأسئلة التوجيهية.</p>';
    html += '</div>';
    
    html += '<h4 style="color:var(--accent-dark);">📌 الموضوع: ' + q.topic + '</h4>';
    html += '<div style="background:rgba(243,232,255,0.5);padding:12px;border-radius:12px;margin-bottom:10px;"><strong>📋 الأسئلة التوجيهية (أجب عليها جميعاً):</strong><ol style="margin-top:6px;padding-right:18px;">';
    q.subQuestions.forEach(function(sq) { html += '<li style="font-size:12px;margin-bottom:4px;">' + sq + '</li>'; });
    html += '</ol></div>';
    html += '<textarea class="wongoji-textarea" id="q54Textarea" placeholder="اكتب مقالك هنا (' + q.minChars + '-' + q.maxChars + ' حرف)..." style="min-height:120px;"></textarea>';
    html += '<p class="char-count" id="q54CharCount">0 حرف</p>';
    html += '<div class="btn-group">';
    html += '<button class="btn btn-primary" onclick="evaluateQ54()">📊 تقييم</button>';
    html += '<button class="btn btn-info" onclick="document.getElementById(\'q54Sample\').style.display=\'block\'">📝 نموذج الإجابة</button>';
    html += '</div>';
    html += '<div id="q54Sample" style="display:none;margin-top:10px;padding:12px;background:var(--correct-bg);border-radius:12px;border:1px solid var(--correct);"><strong>📝 نموذج المقال الصحيح:</strong><p style="font-family:\'Noto Sans KR\';margin-top:6px;white-space:pre-line;line-height:1.8;">' + q.modelAnswer + '</p></div>';
    html += '<div class="grading-result" id="q54Result"></div>';
    
    container.innerHTML = html;
    
    var ta = document.getElementById('q54Textarea');
    if (ta) {
        ta.addEventListener('input', function() {
            var ce = document.getElementById('q54CharCount');
            if (ce) ce.textContent = countChars(this.value) + ' حرف';
        });
    }
    
    updateQ54Nav();
}

function updateQ54Nav() {
    var nav = document.getElementById('level4Nav');
    if (!nav) return;
    var total = topikExams.level4.sections.q54.questions.length;
    var html = '<button class="btn btn-secondary" onclick="loadQ53Content()">⬅️ سؤال 53</button>';
    html += '<span style="font-size:11px;">📝 54: ' + (currentQ54Index+1) + '/' + total + '</span>';
    if (currentQ54Index < total - 1) html += '<button class="btn btn-primary" onclick="currentQ54Index++;loadQ54Content()">➡️</button>';
    else html += '<span></span>';
    nav.innerHTML = html;
}

function evaluateQ54() {
    var ta = document.getElementById('q54Textarea'); 
    if (!ta) return;
    var user = ta.value.trim();
    
    if (!user || user.length === 0) {
        showToast('⚠️ اكتب شيئاً أولاً قبل التقييم');
        return;
    }
    
    var q = topikExams.level4.sections.q54.questions[currentQ54Index];
    var result = aiGrader.grade(user, { minChars: q.minChars, maxChars: q.maxChars }, 54);
    var div = document.getElementById('q54Result');
    if (!div) return;
    
    var html = '<div class="grade-score">' + result.grade.emoji + ' ' + result.totalScore + '/10</div>';
    html += '<p style="text-align:center;">' + result.grade.text + '</p>';
    html += '<div class="grade-details">';
    var labels = {charCount:'📏 عدد الأحرف', content:'📝 المحتوى', structure:'🏗️ البنية', format:'📋 التنسيق', vocab:'📚 المفردات'};
    Object.entries(result.details).forEach(function(e) { 
        html += '<div class="grade-item"><div class="label">' + (labels[e[0]]||e[0]) + '</div><div class="value">' + e[1] + '/10</div></div>'; 
    });
    html += '</div>';
    result.feedback.forEach(function(f) { html += '<p style="font-size:11px;">' + f + '</p>'; });
    div.innerHTML = html; 
    div.classList.add('show'); 
    showToast('📝 تم التقييم!');
}

// ============ رسم البيانات البيانية ============
function renderChart(d) {
    var c = document.getElementById('chartDisplay');
    if (!c) return;
    if (d.type === 'bar') {
        var max = Math.max.apply(null, Object.values(d.data));
        var html = '<div style="display:flex;align-items:flex-end;gap:8px;height:80px;">';
        Object.entries(d.data).forEach(function(e) { 
            html += '<div style="flex:1;text-align:center;"><span style="font-size:9px;">' + e[1] + '</span><div style="height:' + (e[1]/max)*70 + 'px;background:linear-gradient(180deg,var(--accent),var(--accent-dark));border-radius:4px 4px 0 0;"></div><span style="font-size:9px;">' + e[0] + '</span></div>'; 
        });
        html += '</div>'; 
        c.innerHTML = html;
    } else if (d.type === 'pie') {
        var cum = 0; 
        var cols = ['#9333ea','#a855f7','#c084fc','#d8b4fe'];
        var html = '<div style="display:flex;align-items:center;gap:12px;"><div style="width:70px;height:70px;border-radius:50%;background:conic-gradient(';
        var parts = []; 
        Object.entries(d.data).forEach(function(e,i) { 
            var s = cum; 
            cum += e[1]; 
            parts.push(cols[i] + ' ' + s*3.6 + 'deg ' + cum*3.6 + 'deg'); 
        });
        html += parts.join(',') + ');"></div><div>';
        Object.entries(d.data).forEach(function(e,i) { 
            html += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;"><div style="width:10px;height:10px;border-radius:2px;background:' + cols[i] + ';"></div><span style="font-size:10px;">' + e[0] + ': ' + e[1] + '%</span></div>'; 
        });
        html += '</div></div>'; 
        c.innerHTML = html;
    }
}

console.log('✅ محرك الكتابة جاهز - جميع الأزرار متصلة');
console.log('✅ ميزة الترجمة عند النقر مفعلة للمستوى الثالث');