@echo off
setlocal

set "parent_path=%~dp0"
cd /d "%parent_path%"

call python dash_server.py -l "DEBUG" -p 9001 media