/*
 * @Author: zy 953725892@qq.com
 * @Date: 2024-10-16 20:49:26
 * @LastEditors: zy 953725892@qq.com
 * @LastEditTime: 2024-10-21 10:21:49
 * @FilePath: \LoL-plus\dash.js\samples\low-latency\abr\MPCRule.js
 * @Description: 
 * 
 * Copyright (c) 2024 by ${git_name_email}, All Rights Reserved. 
 */
/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */

var RMPCRule;

// Rule that selects the lowest possible bitrate
function RMPCRuleClass() {

    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let MetricsModel = factory.getSingletonFactoryByName('MetricsModel');
    let DashMetrics = factory.getSingletonFactoryByName('DashMetrics');
    let StreamController = factory.getSingletonFactoryByName('StreamController');
    let context = this.context;
    let instance;
    let lastQuality = 0;
    let curRequestId = 0;

    function setup() {
        self.lastQuality = 0;
        self.curRequestId = 0;
    }

    function getBytesLength(request) {
        return request.trace.reduce((a, b) => a + b.b[0], 0);
    }

    // Always use lowest bitrate
    function getMaxIndex(rulesContext) {
        // here you can get some informations aboit metrics for example, to implement the rule
        console.log('using rmpc bitrate rule');
        console.log('curRequestId '+self.curRequestId);
        let metricsModel = MetricsModel(context).getInstance();
        var mediaType = rulesContext.getMediaInfo().type;
        var metrics = metricsModel.getMetricsFor(mediaType, true);
        let dashMetrics = DashMetrics(context).getInstance();    
        let segmentDuration = rulesContext.getRepresentationInfo().fragmentDuration;
        // A smarter (real) rule could need analyze playback metrics to take
        // bitrate switching decision. Printing metrics here as a reference
        // console.log(metrics);

        if (self.curRequestId == 0){
            console.log('first request');
            let switchRequest = SwitchRequest(context).create();
            switchRequest.quality = 0;
            switchRequest.reason = 'mpc';
            switchRequest.priority = SwitchRequest.PRIORITY.STRONG;
            self.curRequestId += 1;
            return switchRequest;
        }

        // console.log('start to evaluate');
        // Get current bitrate
        let streamController = StreamController(context).getInstance();
        let abrController = rulesContext.getAbrController();
        let current = abrController.getQualityFor(mediaType, streamController.getActiveStreamInfo());

        // console.log('mediaType '+mediaType);
        let httpRequest = dashMetrics.getCurrentHttpRequest(mediaType, true);
        // console.log('httpRequest '+httpRequest);
        let requests = dashMetrics.getHttpRequests(mediaType);
        // console.log('requests '+requests);
        if (!httpRequest || !requests) {
            return SwitchRequest(context).create();
        }
        //let lastFragmentDownloadTime = (httpRequest.tresponse.getTime() - httpRequest.trequest.getTime())/1000;
        //console.log('lastFragmentDownloadTime '+lastFragmentDownloadTime);
        const currentBufferLevel = dashMetrics.getCurrentBufferLevel(mediaType, true);
        
        //let requests = dashMetrics.getHttpRequests(mediaType);
        let lastRequest = null;
        let currentRequest = null;
        
        if (!requests) {
            return SwitchRequest(context).create();
        }

        // Get last valid request
        i = requests.length - 1;
        while (i >= 0 && lastRequest === null) {
            currentRequest = requests[i];
            if (currentRequest._tfinish && currentRequest.trequest && currentRequest.tresponse && currentRequest.trace && currentRequest.trace.length > 0) {
                lastRequest = requests[i];
            }
            i--;
        }

        if (lastRequest === null) {
            return SwitchRequest(context).create();
        }

        if(lastRequest.type !== 'MediaSegment' ) {
            return SwitchRequest(context).create();
        }
        let lastFragmentDownloadTime = (lastRequest._tfinish.getTime() - lastRequest.trequest.getTime())/1000;
        let chunkSize = getBytesLength(lastRequest);
        console.log('chunkSize '+chunkSize);
        console.log('lastSegmentDownloadTime '+lastFragmentDownloadTime);
        console.log('segmentDuration '+segmentDuration);
        //-----------------------------------------------------------------------------------
        let segmentRebufferTime = lastFragmentDownloadTime>segmentDuration?lastFragmentDownloadTime-segmentDuration:0;
        
        var xhr = new XMLHttpRequest();
        let quality = 0;
        xhr.open("POST", "http://localhost:8333", false);
        xhr.onreadystatechange = function() {
            if ( xhr.readyState == 4 && xhr.status == 200 ) {
                console.log("GOT RESPONSE:" + xhr.responseText + "---");
                if ( xhr.responseText != "REFRESH" ) {
                    console
                    quality = parseInt(xhr.responseText, 10);
                } else {
                    document.location.reload(true);
                }
            }
        }
        data = {'lastquality': self.lastQuality, 'buffer': currentBufferLevel,  'lastRequest': self.curRequestId, 'RebufferTime': segmentRebufferTime*1000, 'lastFragmentDownloadTime': lastFragmentDownloadTime*1000, 'lastChunkSize': chunkSize};
        console.log("SENDING DATA:" + JSON.stringify(data));
        xhr.send(JSON.stringify(data));
        self.lastQuality = quality;
        self.curRequestId += 1;
        let switchRequest = SwitchRequest(context).create();
        switchRequest.quality = quality;
        switchRequest.reason = 'mpc';
        switchRequest.priority = SwitchRequest.PRIORITY.STRONG;
        return switchRequest;
    }

    instance = {
        getMaxIndex: getMaxIndex
    };

    setup();

    return instance;
}

RMPCRuleClass.__dashjs_factory_name = 'RMPCRule';
RMPCRule = dashjs.FactoryMaker.getClassFactory(RMPCRuleClass);

