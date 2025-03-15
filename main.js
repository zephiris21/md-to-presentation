// main.js - Electron 메인 프로세스 파일

const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// 애플리케이션 윈도우 객체 참조 (가비지 컬렉션 방지)
let mainWindow;

// 개발 모드 확인
const isDev = process.env.NODE_ENV === 'development';

// 애플리케이션 윈도우 생성 함수
function createWindow() {
  // 브라우저 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true, // Node.js 통합 활성화
      contextIsolation: false, // 컨텍스트 격리 비활성화 (보안상 권장되지는 않음)
      enableRemoteModule: true, // 원격 모듈 활성화
      preload: path.join(__dirname, 'preload.js') // 프리로드 스크립트
    }
  });

  // HTML 파일 로드
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // 개발 모드에서는 개발자 도구 열기
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 윈도우가 닫힐 때 이벤트
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 애플리케이션 메뉴 생성
  createMenu();
}

// 애플리케이션 메뉴 생성 함수
function createMenu() {
  const template = [
    {
      label: '파일',
      submenu: [
        {
          label: '새 프레젠테이션',
          accelerator: 'CmdOrCtrl+N',
          click() {
            mainWindow.webContents.send('menu-new-file');
          }
        },
        {
          label: '열기',
          accelerator: 'CmdOrCtrl+O',
          click() {
            openFile();
          }
        },
        {
          label: '저장',
          accelerator: 'CmdOrCtrl+S',
          click() {
            mainWindow.webContents.send('menu-save-file');
          }
        },
        {
          label: '다른 이름으로 저장',
          accelerator: 'CmdOrCtrl+Shift+S',
          click() {
            mainWindow.webContents.send('menu-save-file-as');
          }
        },
        { type: 'separator' },
        {
          label: 'PDF로 내보내기',
          accelerator: 'CmdOrCtrl+E',
          click() {
            mainWindow.webContents.send('menu-export-pdf');
          }
        },
        { type: 'separator' },
        {
          label: '종료',
          accelerator: 'CmdOrCtrl+Q',
          click() {
            app.quit();
          }
        }
      ]
    },
    {
      label: '편집',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: '보기',
      submenu: [
        {
          label: '슬라이드 모드',
          accelerator: 'CmdOrCtrl+P',
          click() {
            mainWindow.webContents.send('menu-preview-mode');
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '도움말',
      submenu: [
        {
          label: '정보',
          click() {
            dialog.showMessageBox(mainWindow, {
              title: 'MD2Slides 정보',
              message: 'MD2Slides v1.0.0',
              detail: '마크다운 파일을 프레젠테이션으로 변환하는 애플리케이션입니다.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 파일 열기 대화상자 및 처리
function openFile() {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown 파일', extensions: ['md', 'markdown'] },
      { name: '모든 파일', extensions: ['*'] }
    ]
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      
      // 파일 읽기
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          dialog.showErrorBox('파일 읽기 오류', `파일을 읽는 중 오류가 발생했습니다: ${err.message}`);
          return;
        }
        
        // 렌더러 프로세스에 파일 내용 전송
        mainWindow.webContents.send('file-opened', {
          filePath,
          content: data
        });
      });
    }
  }).catch(err => {
    dialog.showErrorBox('파일 선택 오류', `파일 선택 중 오류가 발생했습니다: ${err.message}`);
  });
}

// 파일 저장 처리 (IPC 이벤트 핸들러)
ipcMain.on('save-file', (event, { filePath, content }) => {
  if (!filePath) {
    // 경로가 없으면 저장 대화상자 표시
    dialog.showSaveDialog(mainWindow, {
      filters: [
        { name: 'Markdown 파일', extensions: ['md', 'markdown'] },
        { name: '모든 파일', extensions: ['*'] }
      ]
    }).then(result => {
      if (!result.canceled && result.filePath) {
        saveFileContent(result.filePath, content);
      }
    }).catch(err => {
      dialog.showErrorBox('파일 저장 오류', `파일 저장 중 오류가 발생했습니다: ${err.message}`);
    });
  } else {
    // 경로가 있으면 해당 경로에 저장
    saveFileContent(filePath, content);
  }
});

// 파일 내용 저장 함수
function saveFileContent(filePath, content) {
  fs.writeFile(filePath, content, 'utf8', err => {
    if (err) {
      dialog.showErrorBox('파일 저장 오류', `파일 저장 중 오류가 발생했습니다: ${err.message}`);
      return;
    }
    
    // 성공 시 렌더러에 알림
    mainWindow.webContents.send('file-saved', { filePath });
  });
}

// PDF 내보내기 처리 (IPC 이벤트 핸들러)
ipcMain.on('export-pdf', (event, options) => {
  dialog.showSaveDialog(mainWindow, {
    title: 'PDF 내보내기',
    defaultPath: options.filename || 'presentation.pdf',
    filters: [
      { name: 'PDF 파일', extensions: ['pdf'] }
    ]
  }).then(result => {
    if (!result.canceled && result.filePath) {
      // PDF 내보내기 옵션
      const pdfOptions = {
        marginsType: 0,
        pageSize: 'A4',
        printBackground: true,
        printSelectionOnly: false,
        landscape: true
      };
      
      // 고품질 옵션 적용
      if (options.quality === 'high') {
        pdfOptions.resolution = 300;
      }
      
      // 웹 컨텐츠를 PDF로 인쇄
      mainWindow.webContents.printToPDF(pdfOptions).then(data => {
        // PDF 파일로 저장
        fs.writeFile(result.filePath, data, err => {
          if (err) {
            dialog.showErrorBox('PDF 내보내기 오류', `PDF 저장 중 오류가 발생했습니다: ${err.message}`);
            return;
          }
          
          // 성공 알림
          mainWindow.webContents.send('pdf-exported', { filePath: result.filePath });
          
          // 성공 대화상자 표시
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'PDF 내보내기 완료',
            message: 'PDF 내보내기가 완료되었습니다.',
            detail: `저장 위치: ${result.filePath}`
          });
        });
      }).catch(err => {
        dialog.showErrorBox('PDF 생성 오류', `PDF 생성 중 오류가 발생했습니다: ${err.message}`);
      });
    }
  }).catch(err => {
    dialog.showErrorBox('PDF 저장 대화상자 오류', `대화상자 표시 중 오류가 발생했습니다: ${err.message}`);
  });
});

// Electron 앱 초기화 완료 이벤트
app.whenReady().then(() => {
  createWindow();
  
  // macOS에서는 앱을 닫아도 dock에 남아있을 때 창 재생성
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 모든 창이 닫히면 앱 종료 (Windows/Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});