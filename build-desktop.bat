@echo off
rem DeepSeek Harness desktop app: local unsigned Windows x64 installer build.
rem Output: apps\desktop\.desktop-build\targets\win-x64\unsigned-artifacts\
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>&1 || (echo [ERROR] Node.js が見つかりません。Node.js 22.19 以降または 24 以降をインストールしてください。& exit /b 1)
where pnpm >nul 2>&1 || (echo [ERROR] pnpm が見つかりません。corepack enable を実行してください。& exit /b 1)
if not defined PYTHON (
  where python >nul 2>&1 || (echo [ERROR] Python が見つかりません。Python をインストールするか PYTHON 環境変数を設定してください。& exit /b 1)
)

rem The bundled LibreOffice cannot open files past MAX_PATH (260). Its deepest
rem file sits 244 characters below the repository root in the unpacked build, so
rem the post-build Office conversion check fails when the root path is longer.
for /f %%L in ('node -e "console.log(process.cwd().length)"') do set "ROOT_LEN=%%L"
set "LONG_ROOT="
if %ROOT_LEN% GTR 14 (
  set "LONG_ROOT=1"
  echo [WARN] リポジトリのパスが長いため、ビルド後の Office 変換チェックが失敗します。
  echo        インストーラーは作成されますが、チェックまで通すには C:\dsh のような短いパスへ置いてください。
)

rem Local-only packaging settings, ignored by Git. The mandatory-update origin is
rem required even for unsigned builds; the reserved .invalid domain never
rem resolves, so policy checks fail silently and never block the app.
set "ENV_FILE=apps\desktop\.env.windows"
if not exist "%ENV_FILE%" (
  echo apps\desktop\.env.windows を作成します。
  >"%ENV_FILE%" echo DSH_DESKTOP_APP_ID=com.deepseek.harness
  >>"%ENV_FILE%" echo DSH_DESKTOP_AUTO_UPDATE_ENV=production
  >>"%ENV_FILE%" echo DSH_DESKTOP_MANDATORY_UPDATE_PROD_ORIGIN=https://mandatory-update.invalid
)

echo [1/2] 依存関係をインストールしています...
call pnpm install || goto :failed

echo [2/2] デスクトップアプリをビルドしています。初回は時間がかかります...
call pnpm run package:desktop:win:x64:unsigned || goto :failed

echo.
echo ビルドが完了しました。インストーラー:
dir /b "apps\desktop\.desktop-build\targets\win-x64\unsigned-artifacts\*.exe"
echo 場所: %CD%\apps\desktop\.desktop-build\targets\win-x64\unsigned-artifacts
exit /b 0

:failed
echo.
echo [ERROR] ビルドに失敗しました。上のログを確認してください。
if defined LONG_ROOT if exist "apps\desktop\.desktop-build\targets\win-x64\unsigned-artifacts\*.exe" (
  echo        インストーラーは作成済みです。失敗がビルド後の Office 変換チェック（loadComponentFromURL）なら、
  echo        原因はリポジトリのパス長です。インストール先のパスは短いため、インストール後の動作には影響しません。
  dir /b "apps\desktop\.desktop-build\targets\win-x64\unsigned-artifacts\*.exe"
)
exit /b 1
