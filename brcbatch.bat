@echo off
set NODE_REGKEY="HKEY_LOCAL_MACHINE\Software\SpaceDynamicsLab\Vantage_Web"
set FILES_REGKEY="HKEY_LOCAL_MACHINE\Software\SpaceDynamicsLab\Vantage_Web\Files"

SETLOCAL
for /f "usebackq tokens=2*" %%a in (`reg query %NODE_REGKEY% /v Location`) do set "nodepath=%%bNode" && (goto startservice) || (goto nonode)
	
:nonode
echo node folder not found... exiting now
pause
exit

:startservice
:::::::::::::::::::::::::::::::::::::::::
:: Automatically check & get admin rights
:::::::::::::::::::::::::::::::::::::::::
@echo off
CLS 
ECHO.
REM ECHO =============================
REM ECHO Running Admin shell
REM ECHO =============================

:checkPrivileges 
NET FILE 1>NUL 2>NUL
if '%errorlevel%' == '0' ( goto gotPrivileges ) else ( goto getPrivileges ) 

:getPrivileges 
if '%1'=='ELEV' (shift & goto gotPrivileges)  
ECHO. 
REM ECHO **************************************
REM ECHO Invoking UAC for Privilege Escalation 
REM ECHO **************************************

setlocal DisableDelayedExpansion
set "batchPath=%~0"
setlocal EnableDelayedExpansion
ECHO Set UAC = CreateObject^("Shell.Application"^) > "%temp%\OEgetPrivileges.vbs" 
ECHO UAC.ShellExecute "!batchPath!", "ELEV", "", "runas", 1 >> "%temp%\OEgetPrivileges.vbs" 
"%temp%\OEgetPrivileges.vbs" 
exit /B 

:gotPrivileges 
::::::::::::::::::::::::::::
:START
::::::::::::::::::::::::::::
setlocal & pushd .

::echo starting the node npm installation, please close the window after it has finished
cd %nodepath%
::start "npm configure" npm install -g
::pause

echo current path %cd%
node.exe service.js --install
net start "VANTAGE Web Service"
pause
exit