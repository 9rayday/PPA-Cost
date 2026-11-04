# PPA-Cost

PPA 체결 강도 보드 (HTML/CSS/JS). 기록은 Google 스프레드시트(Apps Script)에 저장됩니다.
이 저장소에는 기록 데이터와 접속 키가 들어 있지 않습니다.

## 설정
1. 스프레드시트 → 확장 프로그램 → Apps Script 에 `apps-script/Code.gs` 내용을 붙여넣습니다.
2. 프로젝트 설정 → 스크립트 속성에 `PPA_KEY` (접속 키)를 추가합니다.
3. 배포 → 새 배포 → 웹 앱 (실행 사용자: 나, 액세스: 모든 사용자) → URL을 복사합니다.
4. `config.js` 의 `APPS_SCRIPT_URL` 에 URL을 넣고 푸시합니다.
5. 페이지를 열면 접속 키를 묻습니다. 한 번 입력하면 이 브라우저에 저장됩니다.
