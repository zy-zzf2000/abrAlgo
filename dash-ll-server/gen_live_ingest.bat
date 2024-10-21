@echo off
setlocal

set "SERVER=%~1"
set "PORT=%~2"
set "FF=%~3"
set "PROFILE=%~4"
set "INPUT=bbb.mp4"
set "ID=live"
set "VCODEC=libx264"
set "COLOR=bt709"

if "%SERVER%"=="" (
    echo Usage: %0 ^<SERVER^> ^<PORT^> [^<FFMPEG^>]
    exit /b
)

if "%PORT%"=="" (
    echo Usage: %0 ^<SERVER^> ^<PORT^> [^<FFMPEG^>]
    exit /b
)

if "%FF%"=="" (
    set "FF=ffmpeg"
)

set "PROTO=http"
set "HTTP_OPTS="

echo Ingesting to: %PROTO%://%SERVER%:%PORT%/%ID%/%ID%.mpd

set "PROFILE_FAST=-b:v:0 100K -s:v:0 640x360 -b:v:1 300K -s:v:1 852x480 -map 0:v:0 -map 0:v:0 -bufsize 200K -adaptation_sets id=0,seg_duration=0.5,streams=0,1"
set "PROFILE_NORMAL=-b:v:0 200K -s:v:0 640x360 -b:v:1 600K -s:v:1 852x480 -b:v:2 1000K -s:v:2 1280x720 -map 0:v:0 -map 0:v:0 -map 0:v:0 -bufsize 200K -adaptation_sets id=0,seg_duration=0.5,streams=0,1,2"

set "LADDER_PROFILE="
if "%PROFILE%"=="PROFILE_FAST" (
    set "LADDER_PROFILE=%PROFILE_FAST%"
    echo Using fast ffmpeg profile (360p@100K, 480p@300K)
) else if "%PROFILE%"=="PROFILE_CUSTOM" (
    set "LADDER_PROFILE=%PROFILE_CUSTOM%"
    echo Using custom ffmpeg profile
) else (
    set "LADDER_PROFILE=%PROFILE_NORMAL%"
    echo Using normal ffmpeg profile (360p@200K, 480p@600K, 720p@1000K)
)

%FF% -hide_banner -loglevel panic ^
-re -i %INPUT% ^
-c:v %VCODEC% ^
%LADDER_PROFILE% ^
-use_timeline 0 ^
-use_template 1 ^
-frag_type every_frame ^
-g:v 15 -keyint_min:v 15 -sc_threshold:v 0 -streaming 1 -ldash 1 -tune zerolatency ^
-color_primaries %COLOR% -color_trc %COLOR% -colorspace %COLOR% ^
-f dash ^
%HTTP_OPTS% ^
%PROTO%://%SERVER%:%PORT%/%ID%/%ID%.mpd