// app.js - 애플리케이션 메인 로직 (Electron 연동 추가)

// DOM 요소
const markdownEditorEl = document.getElementById('markdown-editor');
const previewContentEl = document.getElementById('preview-content');
const themeSelector = document.getElementById('theme-selector');
const slideCountEl = document.getElementById('slide-count');
const exportModal = document.getElementById('export-modal');

// 버튼 요소
const btnOpen = document.getElementById('btn-open');
const btnSave = document.getElementById('btn-save');
const btnExportPdf = document.getElementById('btn-export-pdf');
const btnPreviewMode = document.getElementById('btn-preview-mode');
const btnCancelExport = document.getElementById('btn-cancel-export');
const btnConfirmExport = document.getElementById('btn-confirm-export');
const btnCloseModal = document.querySelector('.btn-close');

// 상태 변수
let currentFilePath = null;
let isPreviewMode = false;
let currentTheme = 'theme1';
let isDocumentChanged = false;

// CodeMirror 에디터 초기화
let editor;
try {
  editor = CodeMirror.fromTextArea(markdownEditorEl, {
    mode: 'markdown',
    theme: 'dracula',
    lineNumbers: true,
    lineWrapping: true
  });
} catch (error) {
  console.error('CodeMirror 초기화 오류:', error);
  alert('에디터를 초기화하는 중 오류가 발생했습니다.');
}

// 초기화 함수
function init() {
  // 이벤트 리스너 설정
  setupEventListeners();
  
  // 기본 테마 적용
  applyTheme(currentTheme);
  
  // Electron 이벤트 리스너 설정
  setupElectronListeners();
  
  // 샘플 마크다운 로드 (나중에 제거)
  loadSampleMarkdown();
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 에디터 변경 이벤트
  editor.on('change', () => {
    const markdownContent = editor.getValue();
    renderPreview(markdownContent);
    isDocumentChanged = true;
    updateWindowTitle();
  });
  
  // 테마 변경 이벤트
  themeSelector.addEventListener('change', (e) => {
    currentTheme = e.target.value;
    applyTheme(currentTheme);
    renderPreview(editor.getValue());
  });
  
  // 버튼 이벤트
  btnOpen.addEventListener('click', handleOpenFile);
  btnSave.addEventListener('click', handleSaveFile);
  btnExportPdf.addEventListener('click', () => {
    exportModal.style.display = 'block';
  });
  btnPreviewMode.addEventListener('click', togglePreviewMode);
  
  // 모달 이벤트
  btnCancelExport.addEventListener('click', () => {
    exportModal.style.display = 'none';
  });
  btnCloseModal.addEventListener('click', () => {
    exportModal.style.display = 'none';
  });
  btnConfirmExport.addEventListener('click', handleExportPdf);
  
  // 모달 외부 클릭 시 닫기
  window.addEventListener('click', (e) => {
    if (e.target === exportModal) {
      exportModal.style.display = 'none';
    }
  });
}

// Electron 이벤트 리스너 설정
function setupElectronListeners() {
  // Electron 객체가 있는지 확인
  if (window.electron) {
    // 파일 열기 이벤트
    window.electron.ipc.on('file-opened', (data) => {
      if (data && data.content) {
        currentFilePath = data.filePath;
        editor.setValue(data.content);
        isDocumentChanged = false;
        updateWindowTitle();
      }
    });
    
    // 파일 저장 이벤트
    window.electron.ipc.on('file-saved', (data) => {
      if (data && data.filePath) {
        currentFilePath = data.filePath;
        isDocumentChanged = false;
        updateWindowTitle();
      }
    });
    
    // PDF 내보내기 완료 이벤트
    window.electron.ipc.on('pdf-exported', (data) => {
      updateStatus(`PDF 내보내기 완료: ${data.filePath}`);
    });
    
    // 메뉴 이벤트 처리
    window.electron.ipc.on('menu-new-file', () => {
      // 변경 사항 확인 후 새 파일 생성
      if (isDocumentChanged) {
        if (confirm('변경된 내용이 있습니다. 저장하시겠습니까?')) {
          handleSaveFile(() => createNewFile());
        } else {
          createNewFile();
        }
      } else {
        createNewFile();
      }
    });
    
    window.electron.ipc.on('menu-save-file', () => {
      handleSaveFile();
    });
    
    window.electron.ipc.on('menu-save-file-as', () => {
      handleSaveFileAs();
    });
    
    window.electron.ipc.on('menu-export-pdf', () => {
      exportModal.style.display = 'block';
    });
    
    window.electron.ipc.on('menu-preview-mode', () => {
      togglePreviewMode();
    });
  }
}

// 새 파일 생성 함수
function createNewFile() {
  currentFilePath = null;
  editor.setValue('# 새 프레젠테이션\n\n---\n\n## 슬라이드 제목\n\n- 내용을 입력하세요');
  isDocumentChanged = false;
  updateWindowTitle();
}

// 창 제목 업데이트
function updateWindowTitle() {
  const fileName = currentFilePath ? 
    currentFilePath.split(/[\\/]/).pop() : 
    '제목 없음';
  
  const changeIndicator = isDocumentChanged ? '* ' : '';
  document.title = `${changeIndicator}${fileName} - MD2Slides`;
}

// 테마 적용 함수
function applyTheme(themeName) {
  // 기존 테마 클래스 제거
  previewContentEl.classList.forEach(cls => {
    if (cls.startsWith('theme-')) {
      previewContentEl.classList.remove(cls);
    }
  });
  
  // 새 테마 클래스 추가
  previewContentEl.classList.add(`theme-${themeName}`);
}

// 프리뷰 렌더링 함수
function renderPreview(markdownContent) {
  try {
    // 마크다운 파서로 파싱 (markdown-parser.js에 구현)
    const parsedContent = parseMarkdown(markdownContent);
    
    // HTML 렌더러로 변환 (html-renderer.js에 구현)
    const htmlContent = renderToHtml(parsedContent, currentTheme);
    
    // 프리뷰에 표시
    previewContentEl.innerHTML = htmlContent;
    
    // 슬라이드 수 업데이트
    updateSlideCount();
  } catch (error) {
    console.error('프리뷰 렌더링 오류:', error);
    previewContentEl.innerHTML = `<div class="error">렌더링 오류: ${error.message}</div>`;
  }
}

// 슬라이드 수 업데이트 함수
function updateSlideCount() {
  const slides = previewContentEl.querySelectorAll('.slide');
  slideCountEl.textContent = slides.length;
}

// 프리뷰 모드 전환 함수
function togglePreviewMode() {
  isPreviewMode = !isPreviewMode;
  
  const previewContainer = document.querySelector('.preview-container');
  
  if (isPreviewMode) {
    previewContainer.classList.add('slide-mode');
    btnPreviewMode.textContent = '편집 모드';
  } else {
    previewContainer.classList.remove('slide-mode');
    btnPreviewMode.textContent = '슬라이드 모드';
  }
}

// 파일 열기 처리 함수
function handleOpenFile() {
  // 변경 사항 확인
  if (isDocumentChanged) {
    if (!confirm('변경된 내용이 있습니다. 계속하시겠습니까?')) {
      return;
    }
  }
  
  // Electron 환경인 경우
  if (window.electron) {
    // 파일 열기는 메인 프로세스에서 처리되므로 여기서는 아무것도 하지 않음
    // main.js에서 openFile() 함수가 실행됨
  } else {
    // 브라우저 환경인 경우 (테스트용)
    console.log('파일 열기 기능은 Electron 환경에서만 가능합니다.');
    // 파일 선택 대화상자를 브라우저에서 시뮬레이션
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,text/markdown';
    
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result;
          editor.setValue(content);
          currentFilePath = file.name; // 브라우저에서는 경로가 아니라 파일 이름만
          isDocumentChanged = false;
          updateWindowTitle();
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  }
}

// 파일 저장 처리 함수
function handleSaveFile(callback) {
  const content = editor.getValue();
  
  // Electron 환경인 경우
  if (window.electron) {
    window.electron.ipc.send('save-file', {
      filePath: currentFilePath,
      content: content
    });
    
    // 저장 후 콜백 실행 (있는 경우)
    if (typeof callback === 'function') {
      window.electron.ipc.on('file-saved', callback);
    }
  } else {
    // 브라우저 환경인 경우 (테스트용)
    console.log('파일 저장 기능은 Electron 환경에서만 가능합니다.');
    // 브라우저에서 텍스트 파일 다운로드 시뮬레이션
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFilePath || 'presentation.md';
    a.click();
    URL.revokeObjectURL(url);
    
    isDocumentChanged = false;
    updateWindowTitle();
    
    // 콜백 실행 (있는 경우)
    if (typeof callback === 'function') {
      callback();
    }
  }
}

// 다른 이름으로 저장 처리 함수
function handleSaveFileAs() {
  const content = editor.getValue();
  
  // Electron 환경인 경우
  if (window.electron) {
    // 현재 경로를 null로 설정하여 항상 저장 대화상자 표시
    window.electron.ipc.send('save-file', {
      filePath: null,
      content: content
    });
  } else {
    // 브라우저 환경인 경우 (테스트용)
    handleSaveFile(); // 브라우저에서는 동일하게 처리
  }
}

// PDF 내보내기 처리 함수
function handleExportPdf() {
  const filename = document.getElementById('pdf-filename').value;
  const quality = document.getElementById('pdf-quality').value;
  const includeFonts = document.getElementById('include-fonts').checked;
  
  // 모달 닫기
  exportModal.style.display = 'none';
  
  // Electron 환경인 경우
  if (window.electron) {
    // 메인 프로세스에 PDF 내보내기 요청 전송
    window.electron.ipc.send('export-pdf', {
      filename,
      quality,
      includeFonts
    });
    
    updateStatus('PDF 내보내기 준비 중...');
  } else {
    // 브라우저 환경인 경우 (테스트용)
    console.log('PDF 내보내기 기능은 Electron 환경에서만 가능합니다.');
    alert('PDF 내보내기 기능은 데스크톱 앱에서만 사용 가능합니다.');
  }
}