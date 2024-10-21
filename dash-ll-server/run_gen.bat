@echo off
setlocal

call gen_live_ingest.bat localhost 9001 "docker run -v %CD%:/home.zhangyi -w /home/zhangyi ghcr.io/jrottenberg/ffmpeg:4.4-ubuntu -stats" %1

endlocal