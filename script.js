// --- [1] Firebase 설정 및 초기화 ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ★★★ 아래 값들을 Firebase 콘솔에서 복사한 값으로 바꿔주세요 ★★★
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const dbStore = getFirestore(app);

// --- 전역 변수 ---
let currentMode = 'teacher';
let currentDate = new Date();
let selectedDateKey = null;
const CSAT_DATE = new Date('2026-11-19'); 

// 데이터베이스 문서 ID (하나의 문서를 선생님과 학생이 공유)
const DOC_ID = "shared_tutoring_data"; 

// 초기 빈 데이터 구조
let db = {
    lessons: {}, 
    books: [],
    mockScores: [], 
    schoolScores: [] 
};

// --- [2] 실시간 데이터 동기화 (핵심 기능) ---
// 앱이 켜지면 파이어베이스에서 데이터를 불러오고, 변경될 때마다 자동으로 화면을 갱신합니다.
const docRef = doc(dbStore, "tutoring", DOC_ID);

onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
        console.log("데이터 수신 완료!");
        db = docSnap.data(); // 클라우드 데이터로 덮어쓰기
        renderCalendar(); // 화면 갱신
        
        // 만약 현재 교재/성적 페이지나 모달이 열려있다면 갱신
        if(!document.getElementById('book-page').classList.contains('hidden')) renderBooks(currentBookFilter);
        if(!document.getElementById('score-page').classList.contains('hidden')) renderCharts();
        if(!document.getElementById('student-modal').classList.contains('hidden') && selectedDateKey) {
             // 모달 갱신 (이미지/텍스트 등 실시간 반영)
             // *입력 중인 상태가 날아갈 수 있으므로 주의 필요하지만, 보기 모드에선 유용
             openStudentModal(document.getElementById('student-modal-date').innerText, false); 
        }
    } else {
        console.log("데이터가 없습니다. 새로 만듭니다.");
        saveData(); // 초기 데이터 생성
    }
});

// 데이터 저장 함수 (로컬스토리지 대신 파이어베이스에 업로드)
async function saveData() {
    try {
        await setDoc(docRef, db);
        console.log("데이터 저장 성공");
    } catch (e) {
        console.error("저장 실패:", e);
        alert("데이터 저장에 실패했습니다. 인터넷 연결을 확인하세요.");
    }
}


// --- [3] 기존 기능 로직 (UI 제어 등) ---
// 기존 코드와 동일하지만, 로컬스토리지 관련 부분만 제거됨

window.setMode = function(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

window.showPage = function(pageId) {
    document.querySelectorAll('section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    if (pageId === 'book-page') renderBooks('ing');
    if (pageId === 'score-page') renderCharts();
}

window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

window.changeMonth = function(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    document.getElementById('current-month').innerText = `${monthNames[month]}, ${String(month + 1).padStart(2, '0')}`;

    const firstDay = new Date(year, month, 1).getDay(); 
    const lastDate = new Date(year, month + 1, 0).getDate();
    const calendarGrid = document.getElementById('calendar-days');
    calendarGrid.innerHTML = '';

    let startCol = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < startCol; i++) calendarGrid.appendChild(document.createElement('div'));

    for (let i = 1; i <= lastDate; i++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        cell.innerText = i;
        if (db.lessons && db.lessons[dateKey]) cell.classList.add('has-lesson');
        
        cell.onclick = () => handleDateClick(dateKey, i);
        calendarGrid.appendChild(cell);
    }
}

function handleDateClick(dateKey, dayNum) {
    selectedDateKey = dateKey;
    const monthName = document.getElementById('current-month').innerText.split(',')[0];
    const displayDate = `${monthName} ${String(dayNum).padStart(2,'0')}`;

    if (currentMode === 'teacher') {
        document.getElementById('teacher-modal-date').innerText = displayDate;
        document.getElementById('start-time').value = db.lessons[dateKey]?.startTime || '';
        document.getElementById('end-time').value = db.lessons[dateKey]?.endTime || '';
        document.getElementById('teacher-modal').classList.remove('hidden');
    } else {
        if (db.lessons[dateKey]) openStudentModal(displayDate, true);
    }
}

window.confirmClassRegistration = function() {
    const startVal = document.getElementById('start-time').value;
    const endVal = document.getElementById('end-time').value;

    if (!db.lessons[selectedDateKey]) {
        const count = Object.keys(db.lessons).length + 1;
        db.lessons[selectedDateKey] = { 
            count: count, 
            summary: '', 
            homeworkList: [], 
            image: null,
            startTime: startVal, 
            endTime: endVal 
        };
    } else {
        db.lessons[selectedDateKey].startTime = startVal;
        db.lessons[selectedDateKey].endTime = endVal;
    }
    saveData(); // 클라우드 저장
    closeModal('teacher-modal');
}

function openStudentModal(displayDate, isInitialOpen) {
    const lesson = db.lessons[selectedDateKey];
    document.getElementById('student-modal-date').innerText = displayDate;
    
    const timeStr = (lesson.startTime && lesson.endTime) ? `${lesson.startTime} ~ ${lesson.endTime}` : "시간 미정";
    document.getElementById('display-lesson-time').innerText = timeStr;
    document.getElementById('lesson-count').innerText = lesson.count;

    const today = new Date();
    const diff = Math.ceil((CSAT_DATE - today) / (1000 * 60 * 60 * 24));
    document.getElementById('d-day-display').innerText = `수능 D-${diff}`;

    // 입력 중인 내용 덮어쓰기 방지 (처음 열 때만 값 로드)
    if(isInitialOpen) {
        document.getElementById('lesson-summary').value = lesson.summary || '';
    }
    
    const imgPreviewBox = document.getElementById('img-preview-box');
    const imgTag = document.getElementById('current-lesson-img');
    const downloadBtn = document.getElementById('download-img-btn');

    if (lesson.image) {
        imgPreviewBox.classList.remove('hidden');
        imgTag.src = lesson.image;
        downloadBtn.href = lesson.image;
    } else {
        imgPreviewBox.classList.add('hidden');
        imgTag.src = "";
    }

    // 지난 과제 달성률
    const prevDateKey = getPrevLessonDate(selectedDateKey);
    let percent = 0;
    if (prevDateKey && db.lessons[prevDateKey]) {
        const prevHwList = db.lessons[prevDateKey].homeworkList || [];
        const totalPrevHw = prevHwList.length;
        if (totalPrevHw > 0) {
            const donePrevHw = prevHwList.filter(h => h.done).length;
            percent = Math.round((donePrevHw / totalPrevHw) * 100);
        }
    }
    document.getElementById('homework-gauge').style.width = `${percent}%`;
    document.getElementById('homework-percent').innerText = percent;

    renderHomeworkList();
    document.getElementById('student-modal').classList.remove('hidden');
}

function getPrevLessonDate(currentKey) {
    const allDates = Object.keys(db.lessons).sort();
    const currentIndex = allDates.indexOf(currentKey);
    return currentIndex > 0 ? allDates[currentIndex - 1] : null;
}

// 이미지 업로드 (Base64 변환 후 저장)
// 주의: Firestore 단일 문서 크기는 1MB 제한이 있으므로 너무 큰 이미지는 저장되지 않을 수 있습니다.
document.getElementById('lesson-img-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // 이미지 용량 체크 (약 700KB 이상이면 경고)
        if(file.size > 700 * 1024) {
             alert("이미지가 너무 큽니다. 700KB 이하의 이미지를 사용해주세요.");
             return;
        }

        const reader = new FileReader();
        reader.onload = function(evt) {
            const base64Img = evt.target.result;
            if(db.lessons[selectedDateKey]) {
                db.lessons[selectedDateKey].image = base64Img;
                saveData(); // 저장
            }
        };
        reader.readAsDataURL(file);
    }
});

function renderHomeworkList() {
    const listContainer = document.getElementById('homework-checklist');
    listContainer.innerHTML = '';
    const list = db.lessons[selectedDateKey].homeworkList || [];
    
    list.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'checklist-item';
        div.innerHTML = `
            <div class="check-box ${item.done ? 'checked' : ''}" onclick="toggleHomework(${idx})"></div>
            <span style="flex-grow:1; text-decoration: ${item.done ? 'line-through' : 'none'}">${item.text}</span>
            <span onclick="deleteHomework(${idx})" style="color:#EF4444; padding:5px; cursor:pointer;"><i class="fas fa-trash"></i></span>
        `;
        listContainer.appendChild(div);
    });
}

window.addHomeworkItem = function() {
    const input = document.getElementById('new-homework-input');
    if (!input.value) return;
    if(!db.lessons[selectedDateKey].homeworkList) db.lessons[selectedDateKey].homeworkList = [];
    
    db.lessons[selectedDateKey].homeworkList.push({ text: input.value, done: false });
    input.value = '';
    saveData();
}

window.toggleHomework = function(idx) {
    const list = db.lessons[selectedDateKey].homeworkList;
    list[idx].done = !list[idx].done;
    saveData(); // 체크할 때마다 즉시 저장
}

window.deleteHomework = function(idx) {
    db.lessons[selectedDateKey].homeworkList.splice(idx, 1);
    saveData();
}

window.saveLessonDetails = function() {
    if(db.lessons[selectedDateKey]) {
        db.lessons[selectedDateKey].summary = document.getElementById('lesson-summary').value;
        saveData();
    }
    closeModal('student-modal');
}


// --- 교재 ---
let currentBookFilter = 'ing';
window.filterBooks = function(filter, btn) {
    currentBookFilter = filter;
    document.querySelectorAll('#book-page .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderBooks(filter);
}
window.addBook = function() {
    const title = document.getElementById('new-book-title').value;
    const total = parseInt(document.getElementById('new-book-total').value);
    if (!title || !total) return;
    db.books.push({ id: Date.now(), title, total, checkedCount: 0, isDone: false, reviewCount: 1 });
    saveData();
    document.getElementById('new-book-title').value = '';
    document.getElementById('new-book-total').value = '';
}
window.deleteBook = function(id) {
    if(confirm('삭제하시겠습니까?')) {
        db.books = db.books.filter(b => b.id !== id);
        saveData();
    }
}
function renderBooks(filter) {
    const list = document.getElementById('book-list');
    list.innerHTML = '';
    const filteredBooks = (db.books || []).filter(b => filter === 'ing' ? !b.isDone : b.isDone);
    filteredBooks.forEach(book => {
        const percent = Math.round((book.checkedCount / book.total) * 100);
        let chapterHTML = '';
        if (filter === 'ing') {
            chapterHTML = `<div style="margin-top:10px; display:flex; gap:5px; flex-wrap:wrap;">`;
            for(let i=1; i<=book.total; i++) {
                const isChecked = i <= book.checkedCount;
                chapterHTML += `<div onclick="checkChapter(${book.id}, ${i})" style="width:20px; height:20px; border-radius:4px; border:1px solid var(--primary-color); background:${isChecked ? 'var(--primary-color)' : 'none'}; cursor:pointer;"></div>`;
            }
            chapterHTML += `</div>`;
        }
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div style="flex-grow:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; font-size:1.1rem;">${book.title} <small style="color:#666">(${book.reviewCount}회독)</small></span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-weight:bold;">${percent}%</span>
                        <i class="fas fa-trash" onclick="deleteBook(${book.id})" style="color:#ccc; cursor:pointer;"></i>
                    </div>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${percent}%"></div></div>
                ${chapterHTML}
            </div>
            ${filter === 'done' ? `<button onclick="resetBook(${book.id})" style="margin-left:15px; background:var(--primary-color); color:white; border:none; padding:5px 10px; border-radius:8px;">N회독</button>` : ''}
        `;
        list.appendChild(div);
    });
}
window.checkChapter = function(bookId, chapterNum) {
    const book = db.books.find(b => b.id === bookId);
    if (chapterNum === book.checkedCount + 1) { 
        book.checkedCount++;
        if (book.checkedCount === book.total) book.isDone = true;
        saveData();
    }
}
window.resetBook = function(bookId) {
    const book = db.books.find(b => b.id === bookId);
    if (confirm(`${book.title}의 ${book.reviewCount + 1}회독을 시작하시겠습니까?`)) {
        book.isDone = false; book.checkedCount = 0; book.reviewCount++;
        saveData();
    }
}

// --- 성적 ---
let mockChartInstance, schoolChartInstance;
window.switchScoreTab = function(tab, btn) {
    document.querySelectorAll('#score-page .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('mock-section').classList.toggle('hidden', tab !== 'mock');
    document.getElementById('school-section').classList.toggle('hidden', tab !== 'school');
    renderCharts();
}
window.addMockScore = function() {
    const name = document.getElementById('mock-name').value;
    const kor = document.getElementById('mock-kor').value;
    const math = document.getElementById('mock-math').value;
    const soc1 = document.getElementById('mock-soc1').value;
    const soc2 = document.getElementById('mock-soc2').value;
    if (!name) return alert("시험명을 입력해주세요.");
    db.mockScores.push({ name, kor, math, soc1, soc2 });
    saveData();
    document.querySelectorAll('#mock-section input').forEach(i => i.value = '');
}
window.addSchoolScore = function() {
    const type = document.querySelector('input[name="school-type"]:checked').value; 
    const sub = document.getElementById('school-sub').value;
    const score = document.getElementById('school-score').value;
    if (!sub || !score) return alert("과목과 점수를 입력해주세요.");
    db.schoolScores.push({ type, sub, score });
    saveData();
    document.getElementById('school-sub').value = '';
    document.getElementById('school-score').value = '';
}
window.renderCharts = function() {
    const ctxMock = document.getElementById('mockChart');
    const ctxSchool = document.getElementById('schoolChart');
    const commonOptions = { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(88,86,214,0.1)' } }, x: { grid: { display: false } } }, plugins: { legend: { labels: { color: '#5856D6', font:{family:'Nunito'} } } }, elements: { line: { tension: 0.3 } } };
    
    if (mockChartInstance) mockChartInstance.destroy();
    if (ctxMock) {
        mockChartInstance = new Chart(ctxMock, {
            type: 'line',
            data: {
                labels: (db.mockScores||[]).map(s => s.name),
                datasets: [
                    { label: '국어', data: (db.mockScores||[]).map(s => s.kor), borderColor: '#FF3B30', backgroundColor: '#FF3B30' },
                    { label: '수학', data: (db.mockScores||[]).map(s => s.math), borderColor: '#5856D6', backgroundColor: '#5856D6' },
                    { label: '생윤(50)', data: (db.mockScores||[]).map(s => s.soc1), borderColor: '#34C759', borderDash: [5, 5] },
                    { label: '사문(50)', data: (db.mockScores||[]).map(s => s.soc2), borderColor: '#FF9500', borderDash: [5, 5] }
                ]
            }, options: commonOptions
        });
    }
    if (schoolChartInstance) schoolChartInstance.destroy();
    if (ctxSchool) {
        const subjects = [...new Set((db.schoolScores||[]).map(s => s.sub))];
        const midData = subjects.map(sub => { const found = (db.schoolScores||[]).find(s => s.sub === sub && s.type === 'mid'); return found ? found.score : 0; });
        const finalData = subjects.map(sub => { const found = (db.schoolScores||[]).find(s => s.sub === sub && s.type === 'final'); return found ? found.score : 0; });
        schoolChartInstance = new Chart(ctxSchool, {
            type: 'bar',
            data: {
                labels: subjects,
                datasets: [
                    { label: '중간고사', data: midData, backgroundColor: 'rgba(88, 86, 214, 0.7)', borderRadius: 6, barPercentage: 0.6 },
                    { label: '기말고사', data: finalData, backgroundColor: 'rgba(255, 59, 48, 0.7)', borderRadius: 6, barPercentage: 0.6 }
                ]
            }, options: { ...commonOptions, scales: { y: { beginAtZero: true, max: 100 } } }
        });
    }
}