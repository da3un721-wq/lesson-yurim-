const firebaseConfig = {
  apiKey: "AIzaSyBVut4DXb87NcUgOGlYJv8z8ex3UCsvxWM",
  authDomain: "lesson-yurim.firebaseapp.com",
  databaseURL: "https://lesson-yurim-default-rtdb.firebaseio.com",
  projectId: "lesson-yurim",
  storageBucket: "lesson-yurim.firebasestorage.app",
  messagingSenderId: "68878856947",
  appId: "1:68878856947:web:2119db84b3ec2c2bf27d86",
  measurementId: "G-G9BZS569J3"
};

// --- 전역 설정 ---
let currentMode = 'teacher';
let currentDate = new Date();
let selectedDateKey = null;
const CSAT_DATE = new Date('2026-11-19'); 

// DB 초기화
let db = JSON.parse(localStorage.getItem('tutoringDB_v5')) || {
    lessons: {}, // "YYYY-MM-DD": { startTime, endTime, summary, image, homeworkList, ... }
    books: [],
    mockScores: [], 
    schoolScores: [] 
};

function saveData() {
    localStorage.setItem('tutoringDB_v5', JSON.stringify(db));
    renderCalendar();
}

// --- 네비게이션 ---
function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function showPage(pageId) {
    document.querySelectorAll('section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    if (pageId === 'book-page') renderBooks('ing');
    if (pageId === 'score-page') renderCharts();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// --- [메인] 캘린더 ---
function changeMonth(delta) {
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
        if (db.lessons[dateKey]) cell.classList.add('has-lesson');
        
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
        if (db.lessons[dateKey]) openStudentModal(displayDate);
    }
}

// --- [모달 1] 선생님 등록 ---
function confirmClassRegistration() {
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
    saveData();
    closeModal('teacher-modal');
}

// --- [모달 2] 학생 상세 ---
function openStudentModal(displayDate) {
    const lesson = db.lessons[selectedDateKey];
    document.getElementById('student-modal-date').innerText = displayDate;
    
    // 1. 시간 표시
    const timeStr = (lesson.startTime && lesson.endTime) 
        ? `${lesson.startTime} ~ ${lesson.endTime}` 
        : "시간 미정";
    document.getElementById('display-lesson-time').innerText = timeStr;
    document.getElementById('lesson-count').innerText = lesson.count;

    // 2. D-Day
    const today = new Date();
    const diff = Math.ceil((CSAT_DATE - today) / (1000 * 60 * 60 * 24));
    document.getElementById('d-day-display').innerText = `수능 D-${diff}`;

    // 3. 내용 및 이미지
    document.getElementById('lesson-summary').value = lesson.summary || '';
    const imgPreviewBox = document.getElementById('img-preview-box');
    const imgTag = document.getElementById('current-lesson-img');
    const downloadBtn = document.getElementById('download-img-btn');

    if (lesson.image) {
        imgPreviewBox.classList.remove('hidden');
        imgTag.src = lesson.image;
        downloadBtn.href = lesson.image; // 다운로드 링크 연결
    } else {
        imgPreviewBox.classList.add('hidden');
        imgTag.src = "";
    }

    // 4. 지난 과제 달성률 계산 (핵심 로직 수정!)
    // 현재 날짜 이전의 가장 최근 수업 날짜를 찾습니다.
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

    // 5. 다음 과제 리스트 (현재 날짜에 할당된 과제)
    renderHomeworkList();

    document.getElementById('student-modal').classList.remove('hidden');
}

// 이전 수업 날짜 찾기 헬퍼 함수
function getPrevLessonDate(currentKey) {
    const allDates = Object.keys(db.lessons).sort(); // 날짜순 정렬
    const currentIndex = allDates.indexOf(currentKey);
    if (currentIndex > 0) {
        return allDates[currentIndex - 1]; // 바로 앞 인덱스 날짜 반환
    }
    return null; // 이전 수업 없음
}

// 이미지 업로드 처리
document.getElementById('lesson-img-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const base64Img = evt.target.result;
            // DB에 저장
            if(db.lessons[selectedDateKey]) {
                db.lessons[selectedDateKey].image = base64Img;
                saveData();
                // 화면 갱신
                document.getElementById('img-preview-box').classList.remove('hidden');
                document.getElementById('current-lesson-img').src = base64Img;
                document.getElementById('download-img-btn').href = base64Img;
            }
        };
        reader.readAsDataURL(file);
    }
});


function renderHomeworkList() {
    const listContainer = document.getElementById('homework-checklist');
    listContainer.innerHTML = '';
    db.lessons[selectedDateKey].homeworkList.forEach((item, idx) => {
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

function addHomeworkItem() {
    const input = document.getElementById('new-homework-input');
    if (!input.value) return;
    db.lessons[selectedDateKey].homeworkList.push({ text: input.value, done: false });
    input.value = '';
    renderHomeworkList();
}

function toggleHomework(idx) {
    db.lessons[selectedDateKey].homeworkList[idx].done = !db.lessons[selectedDateKey].homeworkList[idx].done;
    renderHomeworkList();
    // 체크할 때마다 저장
    saveData();
}

function deleteHomework(idx) {
    db.lessons[selectedDateKey].homeworkList.splice(idx, 1);
    renderHomeworkList();
    saveData();
}

function saveLessonDetails() {
    if(db.lessons[selectedDateKey]) {
        db.lessons[selectedDateKey].summary = document.getElementById('lesson-summary').value;
        saveData();
    }
    closeModal('student-modal');
}


// --- [페이지 2] 교재 ---
let currentBookFilter = 'ing';
function filterBooks(filter, btn) {
    currentBookFilter = filter;
    document.querySelectorAll('#book-page .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderBooks(filter);
}
function addBook() {
    const title = document.getElementById('new-book-title').value;
    const total = parseInt(document.getElementById('new-book-total').value);
    if (!title || !total) return;
    db.books.push({ id: Date.now(), title, total, checkedCount: 0, isDone: false, reviewCount: 1 });
    saveData();
    renderBooks(currentBookFilter);
    document.getElementById('new-book-title').value = '';
    document.getElementById('new-book-total').value = '';
}
function deleteBook(id) {
    if(confirm('삭제하시겠습니까?')) {
        db.books = db.books.filter(b => b.id !== id);
        saveData();
        renderBooks(currentBookFilter);
    }
}
function renderBooks(filter) {
    const list = document.getElementById('book-list');
    list.innerHTML = '';
    const filteredBooks = db.books.filter(b => filter === 'ing' ? !b.isDone : b.isDone);
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
function checkChapter(bookId, chapterNum) {
    const book = db.books.find(b => b.id === bookId);
    if (chapterNum === book.checkedCount + 1) { 
        book.checkedCount++;
        if (book.checkedCount === book.total) book.isDone = true;
        saveData();
        renderBooks(currentBookFilter);
    }
}
function resetBook(bookId) {
    const book = db.books.find(b => b.id === bookId);
    if (confirm(`${book.title}의 ${book.reviewCount + 1}회독을 시작하시겠습니까?`)) {
        book.isDone = false; book.checkedCount = 0; book.reviewCount++;
        saveData();
        filterBooks('ing', document.querySelector('#book-page .tab-container .tab-btn'));
    }
}

// --- [페이지 3] 시험 성적 ---
let mockChartInstance, schoolChartInstance;
function switchScoreTab(tab, btn) {
    document.querySelectorAll('#score-page .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('mock-section').classList.toggle('hidden', tab !== 'mock');
    document.getElementById('school-section').classList.toggle('hidden', tab !== 'school');
    renderCharts();
}
function addMockScore() {
    const name = document.getElementById('mock-name').value;
    const kor = document.getElementById('mock-kor').value;
    const math = document.getElementById('mock-math').value;
    const soc1 = document.getElementById('mock-soc1').value;
    const soc2 = document.getElementById('mock-soc2').value;
    if (!name) return alert("시험명을 입력해주세요.");
    db.mockScores.push({ name, kor, math, soc1, soc2 });
    saveData();
    renderCharts();
    document.querySelectorAll('#mock-section input').forEach(i => i.value = '');
}
function addSchoolScore() {
    const type = document.querySelector('input[name="school-type"]:checked').value; 
    const sub = document.getElementById('school-sub').value;
    const score = document.getElementById('school-score').value;
    if (!sub || !score) return alert("과목과 점수를 입력해주세요.");
    db.schoolScores.push({ type, sub, score });
    saveData();
    renderCharts();
    document.getElementById('school-sub').value = '';
    document.getElementById('school-score').value = '';
}
function renderCharts() {
    const ctxMock = document.getElementById('mockChart');
    const ctxSchool = document.getElementById('schoolChart');
    const commonOptions = { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(88,86,214,0.1)' } }, x: { grid: { display: false } } }, plugins: { legend: { labels: { color: '#5856D6', font:{family:'Nunito'} } } }, elements: { line: { tension: 0.3 } } };
    if (mockChartInstance) mockChartInstance.destroy();
    if (ctxMock) {
        mockChartInstance = new Chart(ctxMock, {
            type: 'line',
            data: {
                labels: db.mockScores.map(s => s.name),
                datasets: [
                    { label: '국어', data: db.mockScores.map(s => s.kor), borderColor: '#FF3B30', backgroundColor: '#FF3B30' },
                    { label: '영어', data: db.mockScores.map(s => s.math), borderColor: '#5856D6', backgroundColor: '#5856D6' },
                    { label: '생윤(50)', data: db.mockScores.map(s => s.soc1), borderColor: '#34C759', borderDash: [5, 5] },
                    { label: '사문(50)', data: db.mockScores.map(s => s.soc2), borderColor: '#FF9500', borderDash: [5, 5] }
                ]
            }, options: commonOptions
        });
    }
    if (schoolChartInstance) schoolChartInstance.destroy();
    if (ctxSchool) {
        const subjects = [...new Set(db.schoolScores.map(s => s.sub))];
        const midData = subjects.map(sub => { const found = db.schoolScores.find(s => s.sub === sub && s.type === 'mid'); return found ? found.score : 0; });
        const finalData = subjects.map(sub => { const found = db.schoolScores.find(s => s.sub === sub && s.type === 'final'); return found ? found.score : 0; });
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
document.addEventListener('DOMContentLoaded', () => { renderCalendar(); });