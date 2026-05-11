@echo off
set JD_SCOPE=local
set JD_QUERY=

:parse
if "%~1"=="" goto run
if /i "%~1"=="-g" (set JD_SCOPE=global & shift & goto parse)
if "%~1:~0,1%"=="-" (set JD_SCOPE=%~1:~1% & shift & goto parse)
set JD_QUERY=%~1
shift
goto parse

:run
set JD_TMP=%TEMP%\jd_result.txt
python "%~dp0jumpdir.py" --scope "%JD_SCOPE%" --pick-to "%JD_TMP%" %JD_QUERY%
if exist "%JD_TMP%" (
    set /p JD_R=<"%JD_TMP%"
    del "%JD_TMP%" 2>nul
    if defined JD_R (
        python "%~dp0jumpdir.py" --add "%JD_R%" 2>nul
        cd /d "%JD_R%"
    )
)
