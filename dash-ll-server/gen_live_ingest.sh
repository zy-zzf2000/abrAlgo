#!/bin/bash

SERVER="${1}"
PORT="${2}"
FF="${3}"
PROFILE="${4}"
INPUT="/dev/video0"
ID=live
VCODEC=libx264
COLOR=bt709

if [ "$SERVER" == "" -o "$PORT" == "" ]
then
    echo "Usage: $0 <SERVER> <PORT> [<FFMPEG>]"
    exit
else
    if [ "$FF" == "" ]
    then
        FF=ffmpeg
    fi

    PROTO=http
    HTTP_OPTS=""

    echo "Ingesting to: ${PROTO}://${SERVER}:${PORT}/${ID}/${ID}.mpd"
fi

echo ${FF} -h all | grep ldash

PROFILE_FAST="-b:v:0 100K -s:v:0 640x360 -b:v:1 300K -s:v:1 852x480 -map 0:v:0 -map 0:v:0 -bufsize 200K -adaptation_sets id=0,seg_duration=0.5,streams=0,1"
PROFILE_NORMAL="-b:v:0 200K -s:v:0 640x360 -b:v:1 600K -s:v:1 852x480 -b:v:2 1000K -s:v:2 1280x720 -map 0:v:0 -map 0:v:0 -map 0:v:0 -bufsize 200K -adaptation_sets id=0,seg_duration=0.5,streams=0,1,2"
# PROFILE_NORMAL="-b:v:0 200K -s:v:0 640x360 -b:v:1 600K -s:v:1 852x480 -b:v:2 1000K -s:v:2 1280x720 -map 0:v:0 -map 0:v:0 -map 0:v:0 -bufsize 200K -adaptation_sets id=0,seg_duration=1,streams=0,1,2"
# PROFILE_NORMAL="-b:v:0 200K -s:v:0 640x360 -b:v:1 600K -s:v:1 852x480 -b:v:2 1000K -s:v:2 1280x720 -map 0:v:0 -map 0:v:0 -map 0:v:0 -bufsize 200K -adaptation_sets id=0,seg_duration=2,streams=0,1,2"
# PROFILE_NORMAL="-b:v:0 200K -s:v:0 640x360 -b:v:1 600K -s:v:1 852x480 -b:v:2 1000K -s:v:2 1280x720 -map 0:v:0 -map 0:v:0 -map 0:v:0 -bufsize 200K -adaptation_sets id=0,seg_duration=4,streams=0,1,2"
# PROFILE_NORMAL="-b:v:0 200K -s:v:0 640x360 -b:v:1 600K -s:v:1 852x480 -b:v:2 1000K -s:v:2 1280x720 -map 0:v:0 -map 0:v:0 -map 0:v:0 -bufsize 200K -adaptation_sets id=0,seg_duration=8,streams=0,1,2"

# Test different frag_duration (NOTE: need to edit `-frag_type duration` below too)
# PROFILE_NORMAL="-b:v:0 200K -s:v:0 640x360 -b:v:1 600K -s:v:1 852x480 -b:v:2 1000K -s:v:2 1280x720 -map 0:v:0 -map 0:v:0 -map 0:v:0 -bufsize 200K -adaptation_sets id=0,seg_duration=0.5,frag_duration=0.1,streams=0,1,2"
# PROFILE_NORMAL="-b:v:0 200K -s:v:0 640x360 -b:v:1 600K -s:v:1 852x480 -b:v:2 1000K -s:v:2 1280x720 -map 0:v:0 -map 0:v:0 -map 0:v:0 -bufsize 200K -adaptation_sets id=0,seg_duration=0.5,frag_duration=0.3,streams=0,1,2"
# PROFILE_NORMAL="-b:v:0 200K -s:v:0 640x360 -b:v:1 600K -s:v:1 852x480 -b:v:2 1000K -s:v:2 1280x720 -map 0:v:0 -map 0:v:0 -map 0:v:0 -bufsize 200K -adaptation_sets id=0,seg_duration=0.5,frag_duration=0.5,streams=0,1,2"

LADDER_PROFILE=""
if [ "$PROFILE" == "PROFILE_FAST" ]
then
    LADDER_PROFILE=$PROFILE_FAST
    echo "Using fast ffmpeg profile (360p@100K, 480p@300K)"
elif [ "$PROFILE" == "PROFILE_CUSTOM" ]
then
    LADDER_PROFILE=$PROFILE_CUSTOM
    echo "Using custom ffmpeg profile"
else
    LADDER_PROFILE=$PROFILE_NORMAL
    echo "Using normal ffmpeg profile (360p@200K, 480p@600K, 720p@1000K)"
fi

${FF} -hide_banner -loglevel panic \
-re -i bbb.mp4 \
-c:v ${VCODEC} \
${LADDER_PROFILE} \
-use_timeline 0 \
-use_template 1 \
-frag_type every_frame \
-g:v 15 -keyint_min:v 15 -sc_threshold:v 0 -streaming 1 -ldash 1 -tune zerolatency \
-color_primaries ${COLOR} -color_trc ${COLOR} -colorspace ${COLOR} \
-f dash \
${HTTP_OPTS} \
${PROTO}://${SERVER}:${PORT}/${ID}/${ID}.mpd \
${TS_OUT_CMD}


# -frag_type every_frame \
# -frag_type duration \
